import { env } from "cloudflare:workers";
import { ensureDatabase, getRawDb } from "@/db";
import { getClientIpAddress, sendMetaConversionEvent } from "@/lib/meta-conversions";
import { markOrderPaidAndSendConfirmation } from "@/lib/orders";
import { getPayPalAccessToken, readPayPalResponse } from "@/lib/paypal";

type PaymentOrder = {
  id: string;
  amount_cents: number;
  currency: string;
  status: string;
  recipient_email: string;
  lead_id: string;
  fbclid: string | null;
  paypal_order_id: string | null;
};

type PayPalCaptureResponse = {
  id?: string;
  status?: string;
  purchase_units?: Array<{
    reference_id?: string;
    custom_id?: string;
    payments?: {
      captures?: Array<{
        id?: string;
        status?: string;
        amount?: { currency_code?: string; value?: string };
      }>;
    };
  }>;
};

export async function POST(request: Request) {
  try {
    await ensureDatabase();
    const body = (await request.json()) as { orderId?: string; paypalOrderId?: string };
    const orderId = body.orderId?.trim();
    const paypalOrderId = body.paypalOrderId?.trim();

    if (!orderId || !paypalOrderId) {
      return Response.json({ error: "Order information is required." }, { status: 400 });
    }

    const db = getRawDb();
    const order = await db
      .prepare(
        "SELECT orders.id, orders.amount_cents, orders.currency, orders.status, orders.paypal_order_id, leads.id AS lead_id, leads.email AS recipient_email, leads.fbclid AS fbclid FROM orders JOIN leads ON leads.id = orders.lead_id WHERE orders.id = ? LIMIT 1"
      )
      .bind(orderId)
      .first<PaymentOrder>();

    if (!order) {
      return Response.json({ error: "Order was not found." }, { status: 404 });
    }

    if (order.status === "paid") {
      return Response.json({ ok: true, alreadyPaid: true, redirectUrl: `/checkout/${order.id}` });
    }

    if (!order.paypal_order_id || order.paypal_order_id !== paypalOrderId) {
      return Response.json({ error: "PayPal order does not match this checkout." }, { status: 409 });
    }

    const runtime = env as typeof env & {
      PAYPAL_CLIENT_ID?: string;
      PAYPAL_CLIENT_SECRET?: string;
      PAYPAL_ENVIRONMENT?: string;
      META_CONVERSIONS_API_ACCESS_TOKEN?: string;
      META_PIXEL_ID?: string;
      META_TEST_EVENT_CODE?: string;
    };
    const paypal = await getPayPalAccessToken(runtime);
    const response = await fetch(
      `${paypal.baseUrl}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${paypal.accessToken}`,
          "Content-Type": "application/json",
          "PayPal-Request-Id": `smtp-${order.id.replaceAll("-", "").slice(0, 12)}-${paypalOrderId}`,
          Prefer: "return=representation",
        },
      }
    );
    let captured: PayPalCaptureResponse;

    try {
      captured = await readPayPalResponse<PayPalCaptureResponse>(response);
    } catch (error) {
      const paypalError = error as Error & { code?: string; status?: number };

      if (paypalError.code === "ORDER_ALREADY_CAPTURED") {
        const lookupResponse = await fetch(
          `${paypal.baseUrl}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}`,
          { headers: { Authorization: `Bearer ${paypal.accessToken}` } }
        );
        captured = await readPayPalResponse<PayPalCaptureResponse>(lookupResponse);
      } else {
        const recoverable = paypalError.code === "INSTRUMENT_DECLINED";
        return Response.json(
          { error: paypalError.message, recoverable },
          { status: paypalError.status ?? 500 }
        );
      }
    }

    const purchaseUnit = captured.purchase_units?.[0];
    const capture = purchaseUnit?.payments?.captures?.[0];

    if (purchaseUnit?.reference_id !== order.id || purchaseUnit.custom_id !== order.id) {
      return Response.json({ error: "PayPal transaction reference does not match this order." }, { status: 409 });
    }

    if (captured.status !== "COMPLETED" || capture?.status !== "COMPLETED" || !capture.id) {
      await db
        .prepare("UPDATE orders SET paypal_payment_status = ? WHERE id = ?")
        .bind(capture?.status ?? captured.status ?? "UNKNOWN", order.id)
        .run();
      return Response.json({ error: "PayPal payment was not completed." }, { status: 402 });
    }

    const capturedAmountCents = Math.round(Number(capture.amount?.value) * 100);

    if (!Number.isFinite(capturedAmountCents) || capturedAmountCents !== order.amount_cents) {
      return Response.json({ error: "PayPal payment amount does not match this order." }, { status: 409 });
    }

    if (capture.amount?.currency_code !== order.currency) {
      return Response.json({ error: "PayPal payment currency does not match this order." }, { status: 409 });
    }

    const result = await markOrderPaidAndSendConfirmation({
      db,
      orderId: order.id,
      origin: new URL(request.url).origin,
      paymentProvider: "paypal",
      paypalOrderId,
      paypalCaptureId: capture.id,
      paypalPaymentStatus: capture.status,
    });

    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    try {
      await sendMetaConversionEvent({
        accessToken: runtime.META_CONVERSIONS_API_ACCESS_TOKEN?.trim() || null,
        pixelId: runtime.META_PIXEL_ID?.trim() || null,
        testEventCode: runtime.META_TEST_EVENT_CODE?.trim() || null,
        eventName: "Purchase",
        eventId: order.id,
        eventSourceUrl: `${new URL(request.url).origin}/checkout/${order.id}`,
        userData: {
          email: order.recipient_email,
          externalId: order.lead_id,
          clientIpAddress: getClientIpAddress(request),
          clientUserAgent: request.headers.get("user-agent"),
          fbclid: order.fbclid,
        },
        customData: {
          currency: order.currency,
          value: order.amount_cents / 100,
          orderId: order.id,
        },
      });
    } catch (error) {
      console.error("Meta Purchase send failed", error);
    }

    return Response.json({
      ok: true,
      confirmationNumber: result.confirmationNumber,
      emailStatus: "emailStatus" in result ? result.emailStatus : undefined,
      redirectUrl: `/checkout/${order.id}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to complete PayPal payment.";
    return Response.json({ error: message }, { status: 500 });
  }
}

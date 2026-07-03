import { env } from "cloudflare:workers";
import { ensureDatabase, getRawDb } from "@/db";
import { markOrderPaidAndSendConfirmation } from "@/lib/orders";

type PaymentOrder = {
  id: string;
  amount_cents: number;
  currency: string;
  status: string;
  recipient_email: string;
};

type SquarePaymentResponse = {
  payment?: {
    id?: string;
    order_id?: string;
    status?: string;
    total_money?: {
      amount?: number;
      currency?: string;
    };
  };
  errors?: Array<{ code?: string; detail?: string }>;
};

export async function POST(request: Request) {
  try {
    await ensureDatabase();

    const runtime = env as typeof env & {
      SQUARE_ACCESS_TOKEN?: string;
      SQUARE_LOCATION_ID?: string;
      SQUARE_ENVIRONMENT?: string;
    };

    if (!runtime.SQUARE_ACCESS_TOKEN || !runtime.SQUARE_LOCATION_ID) {
      return Response.json({ error: "Square payments are not configured." }, { status: 500 });
    }

    const body = (await request.json()) as {
      orderId?: string;
      sourceId?: string;
      verificationToken?: string;
    };
    const orderId = body.orderId?.trim();
    const sourceId = body.sourceId?.trim();

    if (!orderId) {
      return Response.json({ error: "Order ID is required." }, { status: 400 });
    }

    const db = getRawDb();
    const order = await db
      .prepare(
        "SELECT orders.id, orders.amount_cents, orders.currency, orders.status, leads.email AS recipient_email FROM orders JOIN leads ON leads.id = orders.lead_id WHERE orders.id = ? LIMIT 1"
      )
      .bind(orderId)
      .first<PaymentOrder>();

    if (!order) {
      return Response.json({ error: "Order was not found." }, { status: 404 });
    }

    if (order.status === "paid") {
      return Response.json({
        ok: true,
        alreadyPaid: true,
        redirectUrl: `/checkout/${order.id}`,
      });
    }

    if (order.amount_cents <= 0) {
      const result = await markOrderPaidAndSendConfirmation({
        db,
        orderId: order.id,
        origin: new URL(request.url).origin,
        squarePaymentStatus: "NO_CHARGE",
      });

      if (!result.ok) {
        return Response.json({ error: result.error }, { status: result.status });
      }

      return Response.json({
        ok: true,
        confirmationNumber: result.confirmationNumber,
        redirectUrl: `/checkout/${order.id}`,
      });
    }

    if (!sourceId) {
      return Response.json({ error: "Payment token is required." }, { status: 400 });
    }

    const square = await createSquarePayment({
      accessToken: runtime.SQUARE_ACCESS_TOKEN,
      locationId: runtime.SQUARE_LOCATION_ID,
      environment: runtime.SQUARE_ENVIRONMENT ?? "sandbox",
      orderId: order.id,
      sourceId,
      verificationToken: body.verificationToken,
      amountCents: order.amount_cents,
      currency: order.currency,
      buyerEmail: order.recipient_email,
    });

    if (square.status !== "COMPLETED") {
      await db
        .prepare(
          "UPDATE orders SET square_payment_id = COALESCE(?, square_payment_id), square_order_id = COALESCE(?, square_order_id), square_payment_status = COALESCE(?, square_payment_status) WHERE id = ?"
        )
        .bind(square.id, square.orderId, square.status, order.id)
        .run();

      return Response.json(
        { error: `Square payment status is ${square.status ?? "unknown"}.` },
        { status: 402 }
      );
    }

    const result = await markOrderPaidAndSendConfirmation({
      db,
      orderId: order.id,
      origin: new URL(request.url).origin,
      squarePaymentId: square.id,
      squareOrderId: square.orderId,
      squarePaymentStatus: square.status,
    });

    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    return Response.json({
      ok: true,
      confirmationNumber: result.confirmationNumber,
      emailStatus: "emailStatus" in result ? result.emailStatus : undefined,
      redirectUrl: `/checkout/${order.id}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to complete payment.";
    return Response.json({ error: message }, { status: 500 });
  }
}

async function createSquarePayment({
  accessToken,
  locationId,
  environment,
  orderId,
  sourceId,
  verificationToken,
  amountCents,
  currency,
  buyerEmail,
}: {
  accessToken: string;
  locationId: string;
  environment: string;
  orderId: string;
  sourceId: string;
  verificationToken?: string;
  amountCents: number;
  currency: string;
  buyerEmail: string;
}) {
  const baseUrl =
    environment === "production"
      ? "https://connect.squareup.com"
      : "https://connect.squareupsandbox.com";
  const idempotencyKey = `${orderId.slice(0, 8)}-${crypto.randomUUID()}`;

  const response = await fetch(`${baseUrl}/v2/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Square-Version": "2026-06-18",
    },
    body: JSON.stringify({
      source_id: sourceId,
      idempotency_key: idempotencyKey,
      amount_money: {
        amount: amountCents,
        currency,
      },
      autocomplete: true,
      location_id: locationId,
      reference_id: orderId,
      note: `Secret Mouse Tickets access order ${orderId}`,
      buyer_email_address: buyerEmail,
      ...(verificationToken ? { verification_token: verificationToken } : {}),
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as SquarePaymentResponse;

  if (!response.ok || !payload.payment?.id) {
    throw new Error(
      payload.errors?.[0]?.detail ??
        payload.errors?.[0]?.code ??
        "Square payment could not be completed."
    );
  }

  if (
    typeof payload.payment.total_money?.amount === "number" &&
    payload.payment.total_money.amount !== amountCents
  ) {
    throw new Error("Square payment amount does not match this order.");
  }

  if (payload.payment.total_money?.currency && payload.payment.total_money.currency !== currency) {
    throw new Error("Square payment currency does not match this order.");
  }

  return {
    id: payload.payment.id,
    orderId: payload.payment.order_id ?? null,
    status: payload.payment.status ?? null,
  };
}

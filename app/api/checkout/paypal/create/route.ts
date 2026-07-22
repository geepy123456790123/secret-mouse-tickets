import { env } from "cloudflare:workers";
import { ensureDatabase, getRawDb } from "@/db";
import { getPayPalAccessToken, readPayPalResponse } from "@/lib/paypal";

type PaymentOrder = {
  id: string;
  amount_cents: number;
  currency: string;
  status: string;
  recipient_email: string;
};

type PayPalOrderResponse = {
  id?: string;
  status?: string;
};

export async function POST(request: Request) {
  try {
    await ensureDatabase();
    const body = (await request.json()) as { orderId?: string };
    const orderId = body.orderId?.trim();

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
      return Response.json({ error: "This order has already been paid." }, { status: 409 });
    }

    if (order.amount_cents <= 0) {
      return Response.json({ error: "No PayPal payment is required for this order." }, { status: 400 });
    }

    const runtime = env as typeof env & {
      PAYPAL_CLIENT_ID?: string;
      PAYPAL_CLIENT_SECRET?: string;
      PAYPAL_ENVIRONMENT?: string;
    };
    const paypal = await getPayPalAccessToken(runtime);
    const origin = new URL(request.url).origin;
    const response = await fetch(`${paypal.baseUrl}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paypal.accessToken}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": `smtc-${order.id.replaceAll("-", "").slice(0, 24)}-${order.amount_cents}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: order.id,
            custom_id: order.id,
            description: "Secret Mouse Tickets access",
            amount: {
              currency_code: order.currency,
              value: (order.amount_cents / 100).toFixed(2),
            },
          },
        ],
        payment_source: {
          paypal: {
            experience_context: {
              brand_name: "Secret Mouse Tickets",
              shipping_preference: "NO_SHIPPING",
              user_action: "PAY_NOW",
              return_url: `${origin}/checkout/${order.id}`,
              cancel_url: `${origin}/checkout/${order.id}`,
            },
          },
        },
      }),
    });
    const created = await readPayPalResponse<PayPalOrderResponse>(response);

    if (!created.id) {
      throw new Error("PayPal did not return an order ID.");
    }

    await db
      .prepare(
        "UPDATE orders SET payment_provider = 'paypal', paypal_order_id = ?, paypal_payment_status = ? WHERE id = ? AND status = 'pending'"
      )
      .bind(created.id, created.status ?? "CREATED", order.id)
      .run();

    return Response.json({ orderId: created.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start PayPal Checkout.";
    return Response.json({ error: message }, { status: 500 });
  }
}

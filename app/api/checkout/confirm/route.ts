import { env } from "cloudflare:workers";
import { ensureDatabase, getRawDb } from "@/db";
import { buildConfirmationEmail, sendEmail } from "@/lib/email";
import type { EventRecord } from "@/lib/eligibility";

type OrderDetails = EventRecord & {
  order_id: string;
  lead_id: string;
  status: string;
  amount_cents: number;
  coupon_code: string | null;
  recipient_email: string;
};

export async function POST(request: Request) {
  try {
    await ensureDatabase();
    const runtime = env as typeof env & { SQUARE_ACCESS_TOKEN?: string };

    if (runtime.SQUARE_ACCESS_TOKEN) {
      return Response.json(
        { error: "Use Square webhooks to confirm live payments." },
        { status: 409 }
      );
    }

    const body = (await request.json()) as { orderId?: string };
    const orderId = body.orderId?.trim();

    if (!orderId) {
      return Response.json({ error: "Order ID is required." }, { status: 400 });
    }

    const db = getRawDb();
    const details = await db
      .prepare(
        "SELECT orders.id AS order_id, orders.lead_id, orders.status, orders.amount_cents, orders.coupon_code, leads.email AS recipient_email, events.* FROM orders JOIN leads ON leads.id = orders.lead_id JOIN events ON events.id = orders.event_id WHERE orders.id = ? LIMIT 1"
      )
      .bind(orderId)
      .first<OrderDetails>();

    if (!details) {
      return Response.json({ error: "Order was not found." }, { status: 404 });
    }

    if (details.status === "paid") {
      return Response.json({ ok: true, alreadyPaid: true });
    }

    const confirmationNumber = `SMS-${Date.now().toString(36).toUpperCase()}`;
    const paidAt = new Date().toISOString();

    await db
      .prepare("UPDATE orders SET status = 'paid', confirmation_number = ?, paid_at = ? WHERE id = ?")
      .bind(confirmationNumber, paidAt, orderId)
      .run();

    if (details.coupon_code) {
      await db
        .prepare("UPDATE coupons SET redemption_count = redemption_count + 1 WHERE code = ?")
        .bind(details.coupon_code)
        .run();
    }

    const origin = new URL(request.url).origin;
    const message = buildConfirmationEmail({
      recipientEmail: details.recipient_email,
      confirmationNumber,
      event: details,
      origin,
    });
    const emailResult = await sendEmail({
      to: details.recipient_email,
      subject: message.subject,
      text: message.bodyText,
      html: message.html,
    });

    await db
      .prepare(
        "INSERT INTO email_logs (order_id, recipient_email, subject, body_text, provider_message_id, status) VALUES (?, ?, ?, ?, ?, ?)"
      )
      .bind(
        orderId,
        details.recipient_email,
        message.subject,
        message.bodyText,
        emailResult.providerMessageId,
        emailResult.status
      )
      .run();

    return Response.json({
      ok: true,
      confirmationNumber,
      emailStatus: emailResult.status,
      bodyText: message.bodyText,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return Response.json({ error: message }, { status: 500 });
  }
}

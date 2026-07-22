import { getRawDb } from "@/db";
import { buildConfirmationEmail, sendEmail } from "@/lib/email";
import type { EventRecord } from "@/lib/eligibility";

type Db = ReturnType<typeof getRawDb>;

type OrderDetails = EventRecord & {
  order_id: string;
  lead_id: string;
  status: string;
  amount_cents: number;
  confirmation_number: string | null;
  coupon_code: string | null;
  recipient_email: string;
  theme_park_days: number;
};

export type MarkOrderPaidInput = {
  db: Db;
  orderId: string;
  origin: string;
  squarePaymentId?: string | null;
  squareOrderId?: string | null;
  squarePaymentStatus?: string | null;
  paymentProvider?: "square" | "paypal" | "no_charge" | null;
  paypalOrderId?: string | null;
  paypalCaptureId?: string | null;
  paypalPaymentStatus?: string | null;
};

export async function markOrderPaidAndSendConfirmation({
  db,
  orderId,
  origin,
  squarePaymentId = null,
  squareOrderId = null,
  squarePaymentStatus = null,
  paymentProvider = null,
  paypalOrderId = null,
  paypalCaptureId = null,
  paypalPaymentStatus = null,
}: MarkOrderPaidInput) {
  const details = await db
    .prepare(
      "SELECT orders.id AS order_id, orders.lead_id, orders.status, orders.amount_cents, orders.confirmation_number, orders.coupon_code, leads.email AS recipient_email, leads.theme_park_days, events.* FROM orders JOIN leads ON leads.id = orders.lead_id JOIN events ON events.id = orders.event_id WHERE orders.id = ? LIMIT 1"
    )
    .bind(orderId)
    .first<OrderDetails>();

  if (!details) {
    return { ok: false as const, status: 404, error: "Order was not found." };
  }

  if (details.status === "paid") {
    await db
      .prepare(
        "UPDATE orders SET payment_provider = COALESCE(payment_provider, ?), square_payment_id = COALESCE(square_payment_id, ?), square_order_id = COALESCE(square_order_id, ?), square_payment_status = COALESCE(square_payment_status, ?), paypal_order_id = COALESCE(paypal_order_id, ?), paypal_capture_id = COALESCE(paypal_capture_id, ?), paypal_payment_status = COALESCE(paypal_payment_status, ?) WHERE id = ?"
      )
      .bind(
        paymentProvider,
        squarePaymentId,
        squareOrderId,
        squarePaymentStatus,
        paypalOrderId,
        paypalCaptureId,
        paypalPaymentStatus,
        orderId
      )
      .run();

    return { ok: true as const, alreadyPaid: true, confirmationNumber: details.confirmation_number };
  }

  const confirmationNumber = `SMS-${Date.now().toString(36).toUpperCase()}`;
  const paidAt = new Date().toISOString();

  const paidUpdate = await db
    .prepare(
      "UPDATE orders SET status = 'paid', confirmation_number = ?, paid_at = ?, payment_provider = COALESCE(?, payment_provider), square_payment_id = COALESCE(?, square_payment_id), square_order_id = COALESCE(?, square_order_id), square_payment_status = COALESCE(?, square_payment_status), paypal_order_id = COALESCE(?, paypal_order_id), paypal_capture_id = COALESCE(?, paypal_capture_id), paypal_payment_status = COALESCE(?, paypal_payment_status) WHERE id = ? AND status != 'paid'"
    )
    .bind(
      confirmationNumber,
      paidAt,
      paymentProvider,
      squarePaymentId,
      squareOrderId,
      squarePaymentStatus,
      paypalOrderId,
      paypalCaptureId,
      paypalPaymentStatus,
      orderId
    )
    .run();

  if ((paidUpdate.meta.changes ?? 0) === 0) {
    const paidOrder = await db
      .prepare("SELECT confirmation_number FROM orders WHERE id = ? LIMIT 1")
      .bind(orderId)
      .first<{ confirmation_number: string | null }>();

    return {
      ok: true as const,
      alreadyPaid: true,
      confirmationNumber: paidOrder?.confirmation_number ?? confirmationNumber,
    };
  }

  if (details.coupon_code) {
    await db
      .prepare("UPDATE coupons SET redemption_count = redemption_count + 1 WHERE code = ?")
      .bind(details.coupon_code)
      .run();
  }

  const message = buildConfirmationEmail({
    recipientEmail: details.recipient_email,
    confirmationNumber,
    event: details,
    themeParkDays: details.theme_park_days,
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
      "INSERT INTO email_logs (order_id, recipient_email, template, subject, body_text, provider_message_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(
      orderId,
      details.recipient_email,
      "confirmation",
      message.subject,
      message.bodyText,
      emailResult.providerMessageId,
      emailResult.status
    )
    .run();

  return {
    ok: true as const,
    alreadyPaid: false,
    confirmationNumber,
    emailStatus: emailResult.status,
    bodyText: message.bodyText,
  };
}

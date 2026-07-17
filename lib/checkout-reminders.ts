import { getRawDb } from "@/db";
import { priceForCoupon } from "@/lib/coupons";
import { buildCheckoutReminderEmail, sendEmail } from "@/lib/email";
import type { EventRecord } from "@/lib/eligibility";

export const CHECKOUT_REMINDER_DELAY_HOURS = 2;
export const CHECKOUT_REMINDER_COUPON_CODE = "COMEBACK25";

type Db = ReturnType<typeof getRawDb>;

type PendingReminderOrder = EventRecord & {
  order_id: string;
  lead_id: string;
  status: string;
  amount_cents: number;
  coupon_code: string | null;
  checkout_url: string | null;
  checkout_reminder_sent_at: string | null;
  recipient_email: string;
  theme_park_days: number;
};

export async function sendPendingCheckoutReminders({
  db,
  origin,
  limit = 50,
}: {
  db: Db;
  origin: string;
  limit?: number;
}) {
  const rows = await db
    .prepare(
      `SELECT
        orders.id AS order_id,
        orders.lead_id,
        orders.status,
        orders.amount_cents,
        orders.coupon_code,
        orders.checkout_url,
        orders.checkout_reminder_sent_at,
        leads.email AS recipient_email,
        leads.theme_park_days,
        events.*
      FROM orders
      JOIN leads ON leads.id = orders.lead_id
      JOIN events ON events.id = orders.event_id
      WHERE orders.status = 'pending'
        AND orders.paid_at IS NULL
        AND orders.checkout_reminder_sent_at IS NULL
        AND datetime(orders.created_at) <= datetime('now', ?)
      ORDER BY datetime(orders.created_at) ASC
      LIMIT ?`
    )
    .bind(`-${CHECKOUT_REMINDER_DELAY_HOURS} hours`, limit)
    .all<PendingReminderOrder>();

  const candidates = rows.results ?? [];
  let sent = 0;
  let failed = 0;
  const failures: Array<{ orderId: string; error: string }> = [];

  const comebackAmountCents = await priceForCoupon(db, CHECKOUT_REMINDER_COUPON_CODE);

  for (const order of candidates) {
    try {
      let couponCode = order.coupon_code;
      let amountCents = order.amount_cents;

      if (order.amount_cents > comebackAmountCents) {
        couponCode = CHECKOUT_REMINDER_COUPON_CODE;
        amountCents = comebackAmountCents;

        await db
          .prepare(
            "UPDATE orders SET coupon_code = ?, amount_cents = ? WHERE id = ? AND status = 'pending'"
          )
          .bind(couponCode, amountCents, order.order_id)
          .run();
      }

      const checkoutUrl = order.checkout_url ?? `${origin}/checkout/${order.order_id}`;
      const message = buildCheckoutReminderEmail({
        recipientEmail: order.recipient_email,
        checkoutUrl,
        event: order,
        themeParkDays: order.theme_park_days,
        couponCode: CHECKOUT_REMINDER_COUPON_CODE,
      });
      const emailResult = await sendEmail({
        to: order.recipient_email,
        subject: message.subject,
        text: message.bodyText,
        html: message.html,
      });

      await db.batch([
        db
          .prepare(
            "UPDATE orders SET checkout_reminder_sent_at = CURRENT_TIMESTAMP WHERE id = ? AND checkout_reminder_sent_at IS NULL"
          )
          .bind(order.order_id),
        db
          .prepare(
            "INSERT INTO email_logs (order_id, recipient_email, subject, body_text, provider_message_id, status) VALUES (?, ?, ?, ?, ?, ?)"
          )
          .bind(
            order.order_id,
            order.recipient_email,
            message.subject,
            message.bodyText,
            emailResult.providerMessageId,
            emailResult.status
          ),
      ]);

      sent += 1;
    } catch (error) {
      failed += 1;
      failures.push({
        orderId: order.order_id,
        error: error instanceof Error ? error.message : "Unable to send reminder.",
      });
    }
  }

  return {
    ok: true as const,
    considered: candidates.length,
    sent,
    failed,
    failures,
  };
}

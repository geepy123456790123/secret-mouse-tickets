import { getRawDb } from "@/db";
import { priceForCoupon } from "@/lib/coupons";
import { buildCheckoutReminderEmail, sendEmail } from "@/lib/email";
import type { EventRecord } from "@/lib/eligibility";

export const CHECKOUT_REMINDER_DELAY_HOURS = 2;
export const CHECKOUT_REMINDER_FOLLOWUP_DELAY_HOURS = 24;
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
  checkout_reminder_followup_sent_at: string | null;
  recipient_email: string;
  theme_park_days: number;
};

type ReminderStage = "2h" | "24h";

export async function sendPendingCheckoutReminders({
  db,
  origin,
  limit = 50,
}: {
  db: Db;
  origin: string;
  limit?: number;
}) {
  const comebackAmountCents = await priceForCoupon(db, CHECKOUT_REMINDER_COUPON_CODE);

  const firstReminderCandidates = await loadFirstReminderCandidates(db, limit);
  const firstReminderResults = await processReminderStage({
    db,
    origin,
    orders: firstReminderCandidates,
    comebackAmountCents,
    stage: "2h",
  });

  const secondReminderCandidates = await loadSecondReminderCandidates(
    db,
    Math.max(limit - firstReminderResults.sent, 10)
  );
  const secondReminderResults = await processReminderStage({
    db,
    origin,
    orders: secondReminderCandidates,
    comebackAmountCents,
    stage: "24h",
  });

  return {
    ok: true as const,
    considered: firstReminderCandidates.length + secondReminderCandidates.length,
    sent: firstReminderResults.sent + secondReminderResults.sent,
    failed: firstReminderResults.failed + secondReminderResults.failed,
    failures: [...firstReminderResults.failures, ...secondReminderResults.failures],
    firstReminder: firstReminderResults,
    secondReminder: secondReminderResults,
  };
}

async function loadFirstReminderCandidates(db: Db, limit: number) {
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
        orders.checkout_reminder_followup_sent_at,
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

  return rows.results ?? [];
}

async function loadSecondReminderCandidates(db: Db, limit: number) {
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
        orders.checkout_reminder_followup_sent_at,
        leads.email AS recipient_email,
        leads.theme_park_days,
        events.*
      FROM orders
      JOIN leads ON leads.id = orders.lead_id
      JOIN events ON events.id = orders.event_id
      WHERE orders.status = 'pending'
        AND orders.paid_at IS NULL
        AND orders.checkout_reminder_sent_at IS NOT NULL
        AND orders.checkout_reminder_followup_sent_at IS NULL
        AND datetime(orders.created_at) <= datetime('now', ?)
        AND datetime(orders.checkout_reminder_sent_at) <= datetime('now', '-1 hour')
      ORDER BY datetime(orders.created_at) ASC
      LIMIT ?`
    )
    .bind(`-${CHECKOUT_REMINDER_FOLLOWUP_DELAY_HOURS} hours`, limit)
    .all<PendingReminderOrder>();

  return rows.results ?? [];
}

async function processReminderStage({
  db,
  origin,
  orders,
  comebackAmountCents,
  stage,
}: {
  db: Db;
  origin: string;
  orders: PendingReminderOrder[];
  comebackAmountCents: number;
  stage: ReminderStage;
}) {
  let sent = 0;
  let failed = 0;
  const failures: Array<{ orderId: string; error: string }> = [];

  for (const order of orders) {
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
        stage,
      });
      const emailResult = await sendEmail({
        to: order.recipient_email,
        subject: message.subject,
        text: message.bodyText,
        html: message.html,
      });

      const sentColumn =
        stage === "24h"
          ? "checkout_reminder_followup_sent_at"
          : "checkout_reminder_sent_at";
      const template =
        stage === "24h" ? "checkout_reminder_24h" : "checkout_reminder_2h";

      await db.batch([
        db
          .prepare(`UPDATE orders SET ${sentColumn} = CURRENT_TIMESTAMP WHERE id = ?`)
          .bind(order.order_id),
        db
          .prepare(
            "INSERT INTO email_logs (order_id, recipient_email, template, subject, body_text, provider_message_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)"
          )
          .bind(
            order.order_id,
            order.recipient_email,
            template,
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
    considered: orders.length,
    sent,
    failed,
    failures,
  };
}

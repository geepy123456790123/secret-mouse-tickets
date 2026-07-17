import { getRawDb } from "@/db";
import { buildTrustpilotReviewEmail, sendEmail } from "@/lib/email";

export const TRUSTPILOT_REVIEW_REQUEST_DELAY_HOURS = 4;
export const DEFAULT_TRUSTPILOT_REVIEW_URL =
  "https://www.trustpilot.com/evaluate/secretmousetickets.com";

type Db = ReturnType<typeof getRawDb>;

type PaidOrderCandidate = {
  order_id: string;
  recipient_email: string;
  paid_at: string;
};

export async function sendTrustpilotReviewRequests({
  db,
  reviewUrl = DEFAULT_TRUSTPILOT_REVIEW_URL,
  limit = 50,
}: {
  db: Db;
  reviewUrl?: string;
  limit?: number;
}) {
  const candidates = await loadPaidOrderCandidates(db, limit);

  let sent = 0;
  let failed = 0;
  const failures: Array<{ orderId: string; error: string }> = [];

  for (const order of candidates) {
    try {
      const message = buildTrustpilotReviewEmail({
        recipientEmail: order.recipient_email,
        reviewUrl,
      });
      const emailResult = await sendEmail({
        to: order.recipient_email,
        subject: message.subject,
        text: message.bodyText,
        html: message.html,
      });

      await db
        .prepare(
          "INSERT INTO email_logs (order_id, recipient_email, template, subject, body_text, provider_message_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(
          order.order_id,
          order.recipient_email,
          "trustpilot_review_request",
          message.subject,
          message.bodyText,
          emailResult.providerMessageId,
          emailResult.status
        )
        .run();

      sent += 1;
    } catch (error) {
      failed += 1;
      failures.push({
        orderId: order.order_id,
        error:
          error instanceof Error ? error.message : "Unable to send Trustpilot review request.",
      });
    }
  }

  return {
    ok: true as const,
    considered: candidates.length,
    sent,
    failed,
    failures,
    delayHours: TRUSTPILOT_REVIEW_REQUEST_DELAY_HOURS,
    reviewUrl,
  };
}

async function loadPaidOrderCandidates(db: Db, limit: number) {
  const rows = await db
    .prepare(
      `SELECT
        orders.id AS order_id,
        leads.email AS recipient_email,
        orders.paid_at
      FROM orders
      JOIN leads ON leads.id = orders.lead_id
      WHERE orders.status = 'paid'
        AND orders.paid_at IS NOT NULL
        AND datetime(orders.paid_at) <= datetime('now', ?)
        AND NOT EXISTS (
          SELECT 1
          FROM email_logs
          WHERE email_logs.order_id = orders.id
            AND email_logs.template = 'trustpilot_review_request'
        )
      ORDER BY datetime(orders.paid_at) ASC
      LIMIT ?`
    )
    .bind(`-${TRUSTPILOT_REVIEW_REQUEST_DELAY_HOURS} hours`, limit)
    .all<PaidOrderCandidate>();

  return rows.results ?? [];
}

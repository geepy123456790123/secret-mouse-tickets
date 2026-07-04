import { env } from "cloudflare:workers";
import { formatDate } from "./dates";
import type { EventRecord } from "./eligibility";

type ConfirmationEmailInput = {
  recipientEmail: string;
  confirmationNumber: string;
  event: EventRecord;
  themeParkDays: number;
  origin: string;
};

export function buildConfirmationEmail(input: ConfirmationEmailInput) {
  const multiDayBonusText =
    input.themeParkDays > 1
      ? "\n\nBonus: Multi-day Disney tickets purchased through this sale page include an extra Water Park Fun & More Visit pass."
      : "";

  const bodyText = `Secret Mouse Tickets Confirmation #: ${input.confirmationNumber}

Thank you for your purchase.

Your Secret Mouse Tickets order is confirmed. Use the Disney Group & Convention discount ticket sale link below to purchase your actual theme park tickets directly from Disney:

${input.event.event_page_url}

The Disney ticket link is valid from ${formatDate(input.event.valid_start_date)} through ${formatDate(input.event.valid_end_date)}.${multiDayBonusText}

If you have any questions about your order, reply to this email or contact hello@secretmousetickets.com.

Secret Mouse Tickets
www.secretmousetickets.com`;

  const html = `<div style="background:#f5edff;padding:24px;font-family:Arial,sans-serif;color:#120f17">
    <div style="max-width:640px;margin:0 auto;background:#ffffff;border:4px solid #120f17;border-radius:20px;box-shadow:8px 8px 0 #120f17;overflow:hidden">
      <div style="padding:28px 28px 8px">
        <img src="${input.origin}/secret-mouse-tickets-logo.png" alt="Secret Mouse Tickets" width="180" style="display:block;height:auto;margin-bottom:20px" />
        <div style="display:inline-block;background:#efe8ff;border:3px solid #120f17;border-radius:999px;padding:8px 14px;font-size:12px;font-weight:700;letter-spacing:0.02em;color:#5d45b5;text-transform:uppercase">Confirmation</div>
        <h1 style="margin:16px 0 10px;font-size:28px;line-height:1.15">Your order is confirmed</h1>
        <p style="margin:0 0 20px;font-size:16px;line-height:1.6"><strong>Secret Mouse Tickets Confirmation #:</strong> ${escapeHtml(input.confirmationNumber)}</p>
      </div>
      <div style="padding:0 28px 28px">
        <div style="border:3px solid #120f17;border-radius:18px;background:#fff7de;padding:18px 18px 16px;margin-bottom:18px">
          <p style="margin:0 0 14px;font-size:16px;line-height:1.7">Thank you for your purchase. Your Secret Mouse Tickets order is confirmed.</p>
          <p style="margin:0;font-size:16px;line-height:1.7">Use the Disney Group &amp; Convention discount ticket sale link below to purchase your actual theme park tickets directly from Disney.</p>
        </div>
        <div style="border:3px solid #120f17;border-radius:18px;background:#efe8ff;padding:18px;margin-bottom:18px">
          <p style="margin:0 0 8px;font-size:13px;font-weight:700;text-transform:uppercase;color:#5d45b5">Disney ticket link</p>
          <p style="margin:0 0 14px;font-size:15px;line-height:1.7;word-break:break-word"><a href="${escapeHtml(input.event.event_page_url)}" style="color:#5d45b5;text-decoration:underline">${escapeHtml(input.event.event_page_url)}</a></p>
          <p style="margin:0;font-size:15px;line-height:1.7">Valid from <strong>${formatDate(input.event.valid_start_date)}</strong> through <strong>${formatDate(input.event.valid_end_date)}</strong>.</p>
          ${
            input.themeParkDays > 1
              ? '<p style="margin:12px 0 0;font-size:15px;line-height:1.7"><strong>Bonus:</strong> Multi-day Disney tickets purchased through this sale page include an extra Water Park Fun &amp; More Visit pass.</p>'
              : ""
          }
        </div>
        <p style="margin:0;font-size:15px;line-height:1.7">Questions about your order? Reply to this email or contact <a href="mailto:hello@secretmousetickets.com" style="color:#5d45b5;text-decoration:underline">hello@secretmousetickets.com</a>.</p>
        <p style="margin:18px 0 0;font-size:14px;line-height:1.7;color:#6a6170">Secret Mouse Tickets is an independent service and is not affiliated with Disney.</p>
      </div>
    </div>
  </div>`;

  return {
    subject: "Secret Mouse Tickets Confirmation",
    bodyText,
    html,
  };
}

export async function sendEmail({
  to,
  subject,
  text,
  html,
}: {
  to: string;
  subject: string;
  text: string;
  html: string;
}) {
  const runtime = env as typeof env & {
    RESEND_API_KEY?: string;
    FROM_EMAIL?: string;
  };

  if (!runtime.RESEND_API_KEY) {
    return { status: "logged", providerMessageId: null };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${runtime.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: runtime.FROM_EMAIL ?? "Secret Mouse Tickets <hello@secretmousetickets.com>",
      to,
      subject,
      text,
      html,
    }),
  });

  const result = (await response.json().catch(() => ({}))) as { id?: string; message?: string };

  if (!response.ok) {
    throw new Error(result.message ?? "Email provider rejected the message.");
  }

  return { status: "sent", providerMessageId: result.id ?? null };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

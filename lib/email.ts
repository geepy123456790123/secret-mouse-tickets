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
      ? "\n\nBONUS: Multi-day Disney tickets purchased through this sale page include an extra Water Park Fun & More Visit pass."
      : "";

  const bodyText = `Secret Mouse Tickets Confirmation #: ${input.confirmationNumber}

You're on your way to saving BIG on your visit to the Most Magical Place On Earth!

Your purchase gives you access to an eligible Disney discount ticket sale page. Secret Mouse Tickets does not sell the park tickets. To purchase discounted Walt Disney World Group & Convention Theme Park Tickets directly from Disney, click here or copy and paste this URL in your browser: ${input.event.event_page_url}

The Disney tickets available through this link are valid from ${formatDate(input.event.valid_start_date)} to ${formatDate(input.event.valid_end_date)}.${multiDayBonusText}

Secret Mouse Tickets
www.secretmousetickets.com`;

  const html = `<div style="font-family:Arial,sans-serif;line-height:1.55;color:#120f17">
    <img src="${input.origin}/secret-mouse-tickets-logo.png" alt="Secret Mouse Tickets" width="180" style="margin-bottom:20px" />
    <p><strong>Secret Mouse Tickets Confirmation #:</strong> ${escapeHtml(input.confirmationNumber)}</p>
    <p>You're on your way to saving BIG on your visit to the Most Magical Place On Earth!</p>
    <p>Your purchase gives you access to an eligible Disney discount ticket sale page. Secret Mouse Tickets does not sell the park tickets.</p>
    <p>To purchase discounted Walt Disney World Group & Convention Theme Park Tickets directly from Disney, use this URL:<br /><a href="${escapeHtml(input.event.event_page_url)}">${escapeHtml(input.event.event_page_url)}</a></p>
    <p>The Disney tickets available through this link are valid from ${formatDate(input.event.valid_start_date)} to ${formatDate(input.event.valid_end_date)}.</p>
    ${
      input.themeParkDays > 1
        ? "<p><strong>BONUS:</strong> Multi-day Disney tickets purchased through this sale page include an extra Water Park Fun & More Visit pass.</p>"
        : ""
    }
    <p>Secret Mouse Tickets<br />www.secretmousetickets.com</p>
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

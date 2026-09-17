import { env } from "cloudflare:workers";
import { emailBodyStyle, emailButton, emailGuarantee, emailPanel, renderCustomerEmail } from "./email-design";
import { formatDate } from "./dates";
import type { EventRecord } from "./eligibility";

type ConfirmationEmailInput = {
  recipientEmail: string;
  confirmationNumber: string;
  event: EventRecord;
  themeParkDays: number;
  origin: string;
};

type CheckoutReminderEmailInput = {
  recipientEmail: string;
  checkoutUrl: string;
  event: EventRecord;
  themeParkDays: number;
  couponCode?: string;
  stage: "2h" | "24h";
};

type TrustpilotReviewEmailInput = {
  recipientEmail: string;
  reviewUrl: string;
};

type SaleAlertEmailInput = {
  recipientEmail: string;
  confirmationNumber: string;
  orderId: string;
  amountCents: number;
  paymentProvider: string;
  eventName: string;
  eventPageUrl: string;
  themeParkDays: number;
  couponCode?: string | null;
};

export function buildSaleAlertEmail(input: SaleAlertEmailInput) {
  const amount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(input.amountCents / 100);
  const couponLine = input.couponCode ? `Coupon: ${input.couponCode}\n` : "";
  const bodyText = `A Secret Mouse Tickets sale was completed.

Confirmation #: ${input.confirmationNumber}
Order ID: ${input.orderId}
Customer email: ${input.recipientEmail}
Amount paid: ${amount}
Payment provider: ${input.paymentProvider}
Matched offer: ${input.eventName}
Ticket days: ${input.themeParkDays}
${couponLine}Event page: ${input.eventPageUrl}`;

  const html = `<div style="font-family:Arial,sans-serif;color:#120f17">
    <h1>Secret Mouse Tickets sale completed</h1>
    <p>A customer completed a purchase.</p>
    <table style="border-collapse:collapse">
      <tr><td style="padding:6px 18px 6px 0"><strong>Confirmation #</strong></td><td>${escapeHtml(input.confirmationNumber)}</td></tr>
      <tr><td style="padding:6px 18px 6px 0"><strong>Order ID</strong></td><td>${escapeHtml(input.orderId)}</td></tr>
      <tr><td style="padding:6px 18px 6px 0"><strong>Customer email</strong></td><td>${escapeHtml(input.recipientEmail)}</td></tr>
      <tr><td style="padding:6px 18px 6px 0"><strong>Amount paid</strong></td><td>${escapeHtml(amount)}</td></tr>
      <tr><td style="padding:6px 18px 6px 0"><strong>Payment provider</strong></td><td>${escapeHtml(input.paymentProvider)}</td></tr>
      <tr><td style="padding:6px 18px 6px 0"><strong>Matched offer</strong></td><td>${escapeHtml(input.eventName)}</td></tr>
      <tr><td style="padding:6px 18px 6px 0"><strong>Ticket days</strong></td><td>${input.themeParkDays}</td></tr>
      ${input.couponCode ? `<tr><td style="padding:6px 18px 6px 0"><strong>Coupon</strong></td><td>${escapeHtml(input.couponCode)}</td></tr>` : ""}
    </table>
    <p><a href="${escapeHtml(input.eventPageUrl)}">Open matched event page</a></p>
  </div>`;

  return {
    subject: `Sale completed: ${input.confirmationNumber}`,
    bodyText,
    html,
  };
}

export function buildConfirmationEmail(input: ConfirmationEmailInput) {
  const multiDayBonusText =
    input.themeParkDays > 1
      ? "\n\nAdditional Disney Magic: Multi-day tickets include an extra Disney experience."
      : "";

  const bodyText = `Secret Mouse Tickets Confirmation #: ${input.confirmationNumber}

Thank you for your purchase.

Your Secret Mouse Tickets order is confirmed. Use the Disney Group & Convention discount ticket sale link below to purchase your actual theme park tickets directly from Disney:

${input.event.event_page_url}

The Disney ticket link is valid from ${formatDate(input.event.valid_start_date)} through ${formatDate(input.event.valid_end_date)}.${multiDayBonusText}

If you have any questions about your order, reply to this email or contact hello@secretmousetickets.com.

Secret Mouse Tickets
www.secretmousetickets.com`;

  const html = renderCustomerEmail({
    origin: input.origin,
    preheader: "Your order is confirmed. Your Disney ticket purchase link is inside.",
    eyebrow: "Order confirmation",
    heading: "Your next stop: Disney.",
    intro: "Thanks for choosing Secret Mouse Tickets. Your order is confirmed, and your matched Disney ticket link is ready.",
    content: `
      <p style="margin:0 0 24px;font-size:13px;line-height:1.6;color:#696271">Confirmation <strong style="color:#292038">${escapeHtml(input.confirmationNumber)}</strong></p>
      ${emailPanel("Your Disney ticket link", `<p style="margin:0 0 12px;font-size:16px;line-height:1.7;color:#292038">Use your matched sale page to choose and buy your park tickets directly from Disney.</p><p style="margin:0;font-size:14px;line-height:1.7;color:#696271">Valid from <strong>${formatDate(input.event.valid_start_date)}</strong> through <strong>${formatDate(input.event.valid_end_date)}</strong>.</p>`)}
      ${emailButton(input.event.event_page_url, "View my Disney ticket offer")}
      <p style="margin:0 0 20px;font-size:12px;line-height:1.7;color:#696271">You can also open your link here:<br><a href="${escapeHtml(input.event.event_page_url)}" style="color:#6748ad;text-decoration:underline;word-break:break-all;overflow-wrap:anywhere">${escapeHtml(input.event.event_page_url)}</a></p>
      ${input.themeParkDays > 1 ? emailPanel("Additional Disney Magic", '<p style="margin:0;font-size:15px;line-height:1.7;color:#292038">Multi-day tickets include an extra Disney experience.</p>', true) : ""}
      <p style="${emailBodyStyle}">Your park tickets are purchased separately from Disney. If you need help with your link, reply to this email and we'll help you out.</p>
      ${emailGuarantee(input.origin)}
    `,
  });

  return {
    subject: "Secret Mouse Tickets Confirmation",
    bodyText,
    html,
  };
}

export function buildCheckoutReminderEmail(input: CheckoutReminderEmailInput) {
  const multiDayBonusText =
    input.themeParkDays > 1
      ? "\n\nAdditional Disney Magic: Multi-day tickets include an extra Disney experience."
      : "";

  const stageCopy =
    input.stage === "24h"
      ? {
          subject: "Your Secret Mouse Tickets match is still available",
          eyebrow: "Still available",
          heading: "Your Disney ticket match is still waiting",
          intro:
            "Your dates still match an eligible Secret Mouse Tickets offer, and your checkout is still waiting.",
          bodyLead:
            "When you're ready, finish checkout and we'll email your matched Disney ticket purchase link.",
          cta: "Finish checkout",
        }
      : {
          subject: "Complete your Secret Mouse Tickets checkout",
          eyebrow: "Finish checkout",
          heading: "Your Disney ticket match is ready",
          intro:
            "We found an offer for your Walt Disney World dates. Your checkout is saved, so you can pick up where you left off.",
          bodyLead:
            "Complete your purchase and we'll send your matching Disney Group & Convention discount ticket link right away.",
          cta: "Return to checkout",
        };

  const couponText = input.couponCode
    ? `To help you finish checkout, use coupon code ${input.couponCode} for 25% off our fee.`
    : "Your matching checkout link is still available if you'd like to complete your purchase.";

  const bodyText = `Still planning your Disney trip?

We found a Secret Mouse Tickets match for your Walt Disney World dates: ${input.event.info_banner_first}.

${couponText}

Complete your purchase here:
${input.checkoutUrl}

${stageCopy.bodyLead}

Tickets purchased through the matching Disney offer are valid from ${formatDate(input.event.valid_start_date)} through ${formatDate(input.event.valid_end_date)}.${multiDayBonusText}

Secret Mouse Tickets
hello@secretmousetickets.com
www.secretmousetickets.com`;

  const html = renderCustomerEmail({
    origin: new URL(input.checkoutUrl).origin,
    preheader: input.couponCode ? `Your Disney ticket match is waiting. Use ${input.couponCode} for 25% off our fee.` : "Your Disney ticket match is ready whenever you are.",
    eyebrow: stageCopy.eyebrow,
    heading: stageCopy.heading,
    intro: stageCopy.intro,
    content: `
      ${emailPanel("Your matched offer", `<p style="margin:0 0 10px;font-size:18px;font-weight:700;line-height:1.5;color:#292038">${escapeHtml(input.event.info_banner_first)}</p><p style="margin:0;font-size:14px;line-height:1.7;color:#696271">Ticket dates: ${formatDate(input.event.valid_start_date)} &ndash; ${formatDate(input.event.valid_end_date)}</p>`)}
      ${input.couponCode ? emailPanel("A little extra savings", `<p style="margin:0 0 8px;font-size:22px;line-height:1.3;font-weight:700;color:#292038">25% off our matching fee</p><p style="margin:0;font-size:15px;line-height:1.7;color:#696271">Use code <strong style="color:#6748ad">${escapeHtml(input.couponCode)}</strong> at checkout.</p>`, true) : ""}
      <p style="${emailBodyStyle}">${escapeHtml(stageCopy.bodyLead)}</p>
      ${emailButton(input.checkoutUrl, stageCopy.cta)}
      <p style="margin:0 0 20px;text-align:center;font-size:12px;line-height:1.7;color:#696271">One-time matching fee. No subscription.<br>Park tickets are purchased separately from Disney.</p>
      ${input.themeParkDays > 1 ? emailPanel("Additional Disney Magic", '<p style="margin:0;font-size:15px;line-height:1.7;color:#292038">Multi-day tickets include an extra Disney experience.</p>') : ""}
      ${emailGuarantee(new URL(input.checkoutUrl).origin)}
    `,
  });

  return {
    subject: stageCopy.subject,
    bodyText,
    html,
  };
}

export function buildTrustpilotReviewEmail(input: TrustpilotReviewEmailInput) {
  const bodyText = `Thanks again for using Secret Mouse Tickets.

If we helped you save money on your Disney tickets, would you mind leaving a quick Trustpilot review?

Leave a review here:
${input.reviewUrl}

Your feedback helps other families feel confident about checking their dates before they buy.

Questions or need help with your order?
hello@secretmousetickets.com

Secret Mouse Tickets
www.secretmousetickets.com`;

  const html = renderCustomerEmail({
    preheader: "A quick review helps other families plan their Disney trip.",
    eyebrow: "A quick favor",
    heading: "How did we do?",
    intro: "Thanks again for choosing Secret Mouse Tickets. We'd love to hear about your experience.",
    content: `
      <p style="${emailBodyStyle}">Your feedback helps other families feel confident about checking their dates before they buy.</p>
      ${emailButton(input.reviewUrl, "Share my experience")}
      <p style="margin:0;font-size:13px;line-height:1.7;color:#696271">Need help with your order? Email <a href="mailto:hello@secretmousetickets.com" style="color:#6748ad;text-decoration:underline">hello@secretmousetickets.com</a> and we'll help you out.</p>
    `,
  });

  return {
    subject: "How was your Secret Mouse Tickets experience?",
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

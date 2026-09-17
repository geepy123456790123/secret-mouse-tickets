// Email-safe presentation shared by customer messages. Keep layout styles inline
// and use tables so the content also works without web fonts or media queries.
const siteOrigin = "https://secretmousetickets.com";
export const emailBodyStyle = "margin:0 0 20px;font-size:16px;line-height:1.7;color:#696271";

export function escapeEmailHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export function emailButton(url: string, label: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;width:100%"><tr><td align="center" bgcolor="#6748ad" style="border-radius:9px;background:#6748ad;mso-padding-alt:16px 24px"><a href="${escapeEmailHtml(url)}" style="display:block;padding:16px 24px;border:1px solid #6748ad;border-radius:9px;color:#ffffff;font-size:16px;font-weight:700;line-height:24px;text-align:center;text-decoration:none;mso-padding-alt:0">${escapeEmailHtml(label)}</a></td></tr></table>`;
}

export function emailPanel(label: string, content: string, warm = false) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:20px 0;border:1px solid ${warm ? "#eadfbe" : "#e5dfeb"};border-radius:12px;background:${warm ? "#fcf7e9" : "#f5f1fa"}"><tr><td style="padding:20px"><p style="margin:0 0 9px;font-size:11px;font-weight:700;line-height:1.5;letter-spacing:1.2px;text-transform:uppercase;color:#6748ad">${escapeEmailHtml(label)}</p>${content}</td></tr></table>`;
}

export function emailGuarantee(origin = siteOrigin) {
  return `<p style="margin:24px 0 0;padding-top:22px;border-top:1px solid #e5dfeb;font-size:13px;line-height:1.7;color:#696271"><strong style="color:#292038">Save more than our fee. Guaranteed.</strong><br>If you don't come out ahead after our service fee, we'll refund it. <a href="${escapeEmailHtml(origin)}/terms-of-service" style="color:#6748ad;text-decoration:underline">See guarantee details</a>.</p>`;
}

export function renderCustomerEmail({ origin = siteOrigin, preheader, eyebrow, heading, intro, content }: {
  origin?: string; preheader: string; eyebrow: string; heading: string; intro: string; content: string;
}) {
  const base = escapeEmailHtml(origin.replace(/\/$/, ""));
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeEmailHtml(heading)}</title>
<style>@media screen and (max-width:480px){.email-outer{padding:16px 8px!important}.email-content{padding:26px 22px!important}.email-title{font-size:28px!important}.email-footer{padding:22px 14px!important}}</style></head>
<body style="margin:0;padding:0;background:#faf9f6;color:#292038;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all">${escapeEmailHtml(preheader)}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#faf9f6"><tr><td class="email-outer" align="center" style="padding:32px 16px">
<!--[if mso]><table role="presentation" width="600" align="center"><tr><td><![endif]-->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;margin:0 auto">
<tr><td align="center" style="padding:0 0 24px"><a href="${base}" style="text-decoration:none"><img src="${base}/secret-mouse-email-logo.png" alt="Secret Mouse Tickets" width="210" height="117" style="display:block;width:210px;max-width:100%;height:auto;border:0;color:#292038;font-size:18px"></a></td></tr>
<tr><td class="email-content" bgcolor="#ffffff" style="padding:36px;border:1px solid #e5dfeb;border-radius:18px;background:#ffffff">
<p style="margin:0 0 14px;color:#6748ad;font-size:11px;line-height:1.5;font-weight:700;letter-spacing:1.6px;text-transform:uppercase">${escapeEmailHtml(eyebrow)}</p>
<h1 class="email-title" style="margin:0 0 16px;color:#292038;font-size:32px;line-height:1.15;letter-spacing:-1px;font-weight:700">${escapeEmailHtml(heading)}</h1>
<p style="${emailBodyStyle}">${escapeEmailHtml(intro)}</p>
${content}
</td></tr>
<tr><td class="email-footer" align="center" style="padding:26px 28px;font-size:12px;line-height:1.7;color:#696271">
<p style="margin:0 0 8px">Questions? Email <a href="mailto:hello@secretmousetickets.com" style="color:#6748ad;text-decoration:underline">hello@secretmousetickets.com</a>.</p>
<p style="margin:0 0 8px">Secret Mouse Tickets is an independent matching service<br>and isn't affiliated with Disney.</p>
<a href="${base}" style="color:#6748ad;text-decoration:none">secretmousetickets.com</a>
</td></tr></table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`;
}

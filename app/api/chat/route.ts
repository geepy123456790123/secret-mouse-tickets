import { env } from "cloudflare:workers";
import { sendEmail } from "@/lib/email";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  role: ChatRole;
  content: string;
};

type ChatRequestBody = {
  messages?: ChatMessage[];
};

type ChatCompletionPayload = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

type RuntimeEnv = typeof env & {
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  OPENAI_MODEL?: string;
};

type SupportIntent = "refund" | "access" | "general";

type SupportDetails = {
  name: string | null;
  email: string | null;
  orderReference: string | null;
  description: string;
};

const SUPPORT_PROMPT = `You are the friendly FAQ assistant for Secret Mouse Tickets.

Answer only questions about Secret Mouse Tickets, Walt Disney World discount ticket access, eligibility basics, pricing, checkout, confirmation emails, refunds, and the purchase process.

Core facts:
- Secret Mouse Tickets is an independent service and is not affiliated with Disney.
- Secret Mouse Tickets sells access for $57 to eligible Walt Disney World discount ticket sale pages.
- Customers buy actual theme park tickets directly from Disney through the link sent after purchase.
- The site tracks group and convention Walt Disney World ticket discounts that are not broadly advertised to the public.
- The form checks visit start date, visit end date, number of park days, guest counts, and email.
- The chat cannot check live eligibility, process payment, look up orders, or resend confirmations.
- Direct users to the form for eligibility checks.
- If someone wants a refund because they did not come out ahead, or they have an access/order issue the chat cannot resolve, ask for their full name, best email, order confirmation number if they have it, and a short description of the issue so support can follow up at hello@secretmousetickets.com.
- Do not promise an exact savings amount in advance because Disney uses dynamic pricing.
- You may say Secret Mouse Tickets will refund the service fee if the customer does not come out ahead versus Disney's non-discounted price for the same tickets after the fee, or if the paid link cannot be accessed.
- Multi-day Disney tickets purchased through eligible sale pages include an extra Water Park Fun & More Visit pass.
- Secret Mouse Tickets currently focuses on Walt Disney World discounts, not Disneyland.
- Hotel discounts are not part of the current offer.

Style:
- Keep answers warm, concise, and practical.
- Use 2-4 short sentences.
- If the visitor asks something outside this scope, briefly say you can help with Secret Mouse Tickets questions and offer to open a support ticket.`;

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as ChatRequestBody;
    const messages = normalizeMessages(body.messages);

    if (!messages.length) {
      return Response.json({ error: "Message is required." }, { status: 400 });
    }

    const runtime = env as RuntimeEnv;
    const latestUserMessage = getLatestUserMessage(messages);

    const supportReply = await maybeHandleSupportTicket(messages);
    if (supportReply) {
      return Response.json({ reply: supportReply });
    }

    const faqReply = getFaqReply(latestUserMessage);
    if (!runtime.OPENAI_API_KEY) {
      return Response.json({ configured: false, reply: faqReply ?? defaultFallbackReply() });
    }

    const modelReply = await askModel(runtime, messages);
    return Response.json({ reply: modelReply ?? faqReply ?? defaultFallbackReply() });
  } catch {
    return Response.json(
      { error: "The chat assistant is unavailable right now. Please try again shortly." },
      { status: 500 }
    );
  }
}

async function askModel(runtime: RuntimeEnv, messages: ChatMessage[]) {
  const baseUrl = (runtime.OPENAI_BASE_URL ?? "https://openrouter.ai/api/v1").replace(/\/+$/, "");
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${runtime.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://secretmousetickets.com",
      "X-Title": "Secret Mouse Tickets",
    },
    body: JSON.stringify({
      model: runtime.OPENAI_MODEL ?? "openai/gpt-4.1-mini",
      messages: [{ role: "system", content: SUPPORT_PROMPT }, ...messages],
      max_tokens: 350,
      temperature: 0.3,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as ChatCompletionPayload;

  if (!response.ok) {
    return "";
  }

  return extractReply(payload);
}

async function maybeHandleSupportTicket(messages: ChatMessage[]) {
  const latestUserMessage = getLatestUserMessage(messages).toLowerCase();
  const intent = detectSupportIntent(messages);

  if (!intent) {
    return "";
  }

  const details = extractSupportDetails(messages);
  const missingFields = getMissingFields(intent, details);

  if (missingFields.length > 0) {
    return buildMissingDetailsReply(intent, missingFields);
  }

  const subject =
    intent === "refund"
      ? `Refund request: ${details.name ?? details.email ?? "Secret Mouse Tickets customer"}`
      : intent === "access"
        ? `Access issue: ${details.name ?? details.email ?? "Secret Mouse Tickets customer"}`
        : `Support request: ${details.name ?? details.email ?? "Secret Mouse Tickets customer"}`;

  const summaryLine =
    intent === "refund"
      ? "Customer says they may not have come out ahead after the Secret Mouse Tickets fee."
      : intent === "access"
        ? "Customer says they cannot access the link or is having a checkout/order issue."
        : "Customer needs help with an issue that the chatbot could not fully resolve.";

  const conversation = messages
    .filter((message) => message.role === "user")
    .map((message) => `- ${message.content}`)
    .join("\n");

  const text = `${summaryLine}

Name: ${details.name ?? "Not provided"}
Email: ${details.email ?? "Not provided"}
Order reference: ${details.orderReference ?? "Not provided"}

Issue details:
${details.description}

Recent customer messages:
${conversation}`;

  const html = `<div style="font-family:Arial,sans-serif;color:#120f17">
    <p>${escapeHtml(summaryLine)}</p>
    <p><strong>Name:</strong> ${escapeHtml(details.name ?? "Not provided")}<br />
    <strong>Email:</strong> ${escapeHtml(details.email ?? "Not provided")}<br />
    <strong>Order reference:</strong> ${escapeHtml(details.orderReference ?? "Not provided")}</p>
    <p><strong>Issue details:</strong><br />${escapeHtml(details.description).replaceAll("\n", "<br />")}</p>
    <p><strong>Recent customer messages:</strong><br />${escapeHtml(conversation).replaceAll("\n", "<br />")}</p>
  </div>`;

  await sendEmail({
    to: "hello@secretmousetickets.com",
    subject,
    text,
    html,
  });

  if (latestUserMessage.includes("refund")) {
    return "Thanks - I've opened a support ticket for the refund review and sent the details to our team at hello@secretmousetickets.com. They'll follow up using the email you provided after reviewing your order and ticket pricing.";
  }

  return "Thanks - I've opened a support ticket and sent your details to our team at hello@secretmousetickets.com. They'll follow up using the email you provided as soon as they review the issue.";
}

function detectSupportIntent(messages: ChatMessage[]): SupportIntent | null {
  const text = messages
    .filter((message) => message.role === "user")
    .map((message) => message.content.toLowerCase())
    .join("\n");

  if (/\brefund|money back|didn['’]?t save|did not save|come out ahead|overpaid\b/.test(text)) {
    return "refund";
  }

  if (
    /\bcan['’]?t access|cannot access|link doesn['’]?t work|link not working|page not working|error|issue|problem|order help|checkout help|didn['’]?t get email|did not get email|not received\b/.test(
      text
    )
  ) {
    return "access";
  }

  if (/\bhelp|support|contact|someone call|someone email|talk to a person|human\b/.test(text)) {
    return "general";
  }

  return null;
}

function extractSupportDetails(messages: ChatMessage[]): SupportDetails {
  const userMessages = messages.filter((message) => message.role === "user").map((message) => message.content);
  const joined = userMessages.join("\n");
  const emailMatch = joined.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const orderMatch = joined.match(
    /\b(?:confirmation|order|conf(?:irmation)?)[\s#:.-]*([A-Z0-9-]{6,})\b/i
  );
  const nameMatch = joined.match(
    /\b(?:my name is|i am|this is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/
  );

  return {
    name: nameMatch?.[1]?.trim() ?? null,
    email: emailMatch?.[0]?.trim() ?? null,
    orderReference: orderMatch?.[1]?.trim() ?? null,
    description: userMessages.slice(-4).join("\n\n").trim(),
  };
}

function getMissingFields(intent: SupportIntent, details: SupportDetails) {
  const missing: string[] = [];

  if (!details.name) {
    missing.push("full name");
  }

  if (!details.email) {
    missing.push("best email");
  }

  if (intent === "refund") {
    if (!details.orderReference) {
      missing.push("order confirmation number if you have it");
    }
    if (!/\bvisit|date|ticket|price|saved|save|ahead|fee|cost\b/i.test(details.description)) {
      missing.push("a short note explaining why you did not come out ahead");
    }
  } else if (intent === "access") {
    if (!details.orderReference) {
      missing.push("order confirmation number if you have it");
    }
    if (!/\baccess|link|page|email|checkout|error|issue|problem|work\b/i.test(details.description)) {
      missing.push("a short description of what is not working");
    }
  } else if (details.description.length < 20) {
    missing.push("a short description of the issue");
  }

  return missing;
}

function buildMissingDetailsReply(intent: SupportIntent, missingFields: string[]) {
  const prefix =
    intent === "refund"
      ? "I can help open a refund review ticket for our team."
      : intent === "access"
        ? "I can help open a support ticket for the access issue."
        : "I can help open a support ticket for our team.";

  const missingList = joinHumanList(missingFields);
  const intentSpecific =
    intent === "refund"
      ? "Please send your full name, the best email for follow-up, your order confirmation number if you have it, and a quick note explaining why you did not come out ahead after our fee."
      : intent === "access"
        ? "Please send your full name, the best email for follow-up, your order confirmation number if you have it, and a short description of what is not working."
        : "Please send your full name, the best email for follow-up, and a short description of the issue.";

  return `${prefix} I still need ${missingList}. ${intentSpecific}`;
}

function getFaqReply(input: string) {
  const text = input.toLowerCase();

  if (/\bwhat am i buying|what do i get|what is this\b/.test(text)) {
    return "You are buying Secret Mouse Tickets access to a Disney Group & Convention discount ticket sale page that matches your Walt Disney World visit dates, when one is available. After checkout, we email you the link, and you purchase your actual theme park tickets directly from Disney.";
  }

  if (/\baffiliated|disney partner|official disney\b/.test(text)) {
    return "Secret Mouse Tickets is an independent service and is not affiliated with Disney. We help customers find eligible Disney Group & Convention ticket offers that are not broadly advertised to the public.";
  }

  if (/\bcheck my dates|how do i check|qualify|eligib/.test(text)) {
    return "Use the Visit Details form on the homepage to enter your dates, number of park days, guest counts, and email. If your trip matches an eligible Disney offer and the trip is large enough to make sense financially, we'll show you the checkout option right away.";
  }

  if (/\bhow much|price|cost|57\b/.test(text)) {
    return "Secret Mouse Tickets access is $57 before any coupon code. That fee covers our matching service and delivery of the eligible Disney discount link, while your actual theme park tickets are purchased separately from Disney.";
  }

  if (/\brefund|money back|guarantee|come out ahead|save money\b/.test(text)) {
    return "Because Disney uses dynamic pricing, we cannot promise an exact savings amount in advance. If you do not come out ahead versus Disney's non-discounted price for the same tickets after our fee, or if you cannot access the paid link, we will review it for a refund.";
  }

  if (/\bwater park|fun & more|bonus\b/.test(text)) {
    return "Eligible multi-day Disney tickets purchased through these sale pages include an extra Water Park Fun & More Visit pass. That bonus comes from Disney's offer itself, not from a separate Secret Mouse Tickets add-on.";
  }

  if (/\bhotel\b/.test(text)) {
    return "Hotel discounts are not part of the current Secret Mouse Tickets offer. Right now the service is focused on eligible Walt Disney World ticket discounts.";
  }

  return "";
}

function defaultFallbackReply() {
  return "I can help with Secret Mouse Tickets questions about pricing, what access includes, how the Disney discount link works, and how to check your dates. If you need order help, a refund review, or anything more specific, I can also open a support ticket for our team.";
}

function normalizeMessages(messages: unknown): ChatMessage[] {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .filter((message): message is ChatMessage => {
      if (!message || typeof message !== "object") {
        return false;
      }

      const candidate = message as Partial<ChatMessage>;
      return (
        (candidate.role === "user" || candidate.role === "assistant") &&
        typeof candidate.content === "string" &&
        candidate.content.trim().length > 0
      );
    })
    .slice(-8)
    .map((message) => ({
      role: message.role,
      content: message.content.trim().slice(0, 1200),
    }));
}

function getLatestUserMessage(messages: ChatMessage[]) {
  return [...messages].reverse().find((message) => message.role === "user")?.content ?? "";
}

function extractReply(payload: ChatCompletionPayload) {
  return payload.choices?.[0]?.message?.content?.trim() ?? "";
}

function joinHumanList(items: string[]) {
  if (items.length <= 1) {
    return items[0] ?? "";
  }

  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }

  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

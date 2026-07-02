import { env } from "cloudflare:workers";

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

const SUPPORT_PROMPT = `You are the friendly FAQ assistant for Secret Mouse Tickets.

Answer only questions about Secret Mouse Tickets, Walt Disney World discount ticket access, eligibility basics, pricing, checkout, confirmation emails, and the purchase process.

Core facts:
- Secret Mouse Tickets is an independent service and is not affiliated with Disney.
- Secret Mouse Tickets sells access for $57 to eligible Walt Disney World discount ticket sale pages.
- Customers buy actual theme park tickets directly from Disney through the link sent after purchase.
- The site tracks group and convention Walt Disney World ticket discounts that are not broadly advertised to the public.
- The form checks visit start date, visit end date, number of park days, guest counts, and email.
- The chat cannot check live eligibility, process payment, look up orders, or resend confirmations. Direct users to the form for eligibility and to hello@secretmousetickets.com for account, payment, or order help.
- Do not guarantee savings. You may say a typical family of 4 doing 5 park days saves over $300 on tickets alone.
- Multi-day Disney tickets purchased through eligible sale pages include an extra Water Park Fun & More Visit pass.
- Secret Mouse Tickets currently focuses on Walt Disney World discounts, not Disneyland.
- Hotel discounts are not part of the current offer.

Style:
- Keep answers warm, concise, and practical.
- Use 2-4 short sentences.
- If the visitor asks something outside this scope, briefly say you can help with Secret Mouse Tickets questions and point them to the visit-details form.`;

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as ChatRequestBody;
    const messages = normalizeMessages(body.messages);

    if (!messages.length) {
      return Response.json({ error: "Message is required." }, { status: 400 });
    }

    const runtime = env as typeof env & {
      OPENAI_API_KEY?: string;
      OPENAI_BASE_URL?: string;
      OPENAI_MODEL?: string;
    };

    if (!runtime.OPENAI_API_KEY) {
      return Response.json({
        configured: false,
        reply:
          "I can help with Secret Mouse Tickets questions once chat is connected. For now, use the visit-details form to check your dates, or email hello@secretmousetickets.com for help.",
      });
    }

    const baseUrl = (runtime.OPENAI_BASE_URL ?? "https://openrouter.ai/api/v1").replace(
      /\/+$/,
      ""
    );
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
      return Response.json(
        {
          error:
            payload.error?.message ??
            "The chat assistant is unavailable right now. Please try again shortly.",
        },
        { status: 502 }
      );
    }

    const reply = extractReply(payload);

    return Response.json({
      reply:
        reply ||
        "I can help with Secret Mouse Tickets questions. Try asking about pricing, what access includes, or how to check your dates.",
    });
  } catch {
    return Response.json(
      { error: "The chat assistant is unavailable right now. Please try again shortly." },
      { status: 500 }
    );
  }
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

function extractReply(payload: ChatCompletionPayload) {
  return payload.choices?.[0]?.message?.content?.trim() ?? "";
}

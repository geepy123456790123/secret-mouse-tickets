import { env } from "cloudflare:workers";
import { ensureDatabase, getRawDb } from "@/db";
import {
  DEFAULT_TRUSTPILOT_REVIEW_URL,
  sendTrustpilotReviewRequests,
} from "@/lib/trustpilot-review-requests";

export async function POST(request: Request) {
  const auth = authorize(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    await ensureDatabase();
    const db = getRawDb();
    const runtime = env as typeof env & { TRUSTPILOT_REVIEW_URL?: string };
    const reviewUrl = runtime.TRUSTPILOT_REVIEW_URL?.trim() || DEFAULT_TRUSTPILOT_REVIEW_URL;

    const result = await sendTrustpilotReviewRequests({
      db,
      reviewUrl,
    });

    return Response.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to send Trustpilot review requests.";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

function authorize(request: Request) {
  const runtime = env as typeof env & { ADMIN_INGEST_TOKEN?: string };

  if (!runtime.ADMIN_INGEST_TOKEN) {
    return { ok: true as const };
  }

  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${runtime.ADMIN_INGEST_TOKEN}`) {
    return { ok: true as const };
  }

  return {
    ok: false as const,
    response: Response.json({ error: "Unauthorized" }, { status: 401 }),
  };
}

import { env } from "cloudflare:workers";
import { ensureDatabase, getRawDb } from "@/db";
import { sendPendingCheckoutReminders } from "@/lib/checkout-reminders";

export async function POST(request: Request) {
  const auth = authorize(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    await ensureDatabase();
    const db = getRawDb();
    const origin = new URL(request.url).origin;
    const result = await sendPendingCheckoutReminders({ db, origin });
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to send reminders.";
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

import { env } from "cloudflare:workers";
import { ensureDatabase, getRawDb } from "@/db";
import { markOrderPaidAndSendConfirmation } from "@/lib/orders";

export async function POST(request: Request) {
  try {
    await ensureDatabase();
    const runtime = env as typeof env & { SQUARE_ACCESS_TOKEN?: string };

    if (runtime.SQUARE_ACCESS_TOKEN) {
      return Response.json(
        { error: "Use Square webhooks to confirm live payments." },
        { status: 409 }
      );
    }

    const body = (await request.json()) as { orderId?: string };
    const orderId = body.orderId?.trim();

    if (!orderId) {
      return Response.json({ error: "Order ID is required." }, { status: 400 });
    }

    const db = getRawDb();
    const origin = new URL(request.url).origin;
    const result = await markOrderPaidAndSendConfirmation({
      db,
      orderId,
      origin,
    });

    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return Response.json({ error: message }, { status: 500 });
  }
}

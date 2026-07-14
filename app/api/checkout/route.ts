import { env } from "cloudflare:workers";
import { ensureDatabase, getRawDb } from "@/db";
import { priceForCoupon } from "@/lib/coupons";
import { getClientIpAddress, sendMetaConversionEvent } from "@/lib/meta-conversions";

type LeadWithEvent = {
  lead_id: string;
  email: string;
  theme_park_days: number;
  event_id: number;
  event_page_url: string;
  fbclid: string | null;
};

export async function POST(request: Request) {
  try {
    await ensureDatabase();
    const db = getRawDb();
    const body = (await request.json()) as { leadId?: string; couponCode?: string };
    const leadId = body.leadId?.trim();

    if (!leadId) {
      return Response.json({ error: "Lead ID is required." }, { status: 400 });
    }

    const lead = await db
      .prepare(
        "SELECT leads.id AS lead_id, leads.email AS email, leads.theme_park_days, leads.fbclid AS fbclid, events.id AS event_id, events.event_page_url AS event_page_url FROM leads JOIN events ON events.id = leads.matched_event_id WHERE leads.id = ? AND leads.status = 'matched' LIMIT 1"
      )
      .bind(leadId)
      .first<LeadWithEvent>();

    if (!lead) {
      return Response.json({ error: "This offer is no longer available." }, { status: 404 });
    }

    const paidToday = await db
      .prepare("SELECT COUNT(*) AS count FROM orders WHERE status = 'paid' AND substr(paid_at, 1, 10) = ?")
      .bind(new Date().toISOString().slice(0, 10))
      .first<{ count: number }>();
    const runtime = env as typeof env & {
      DAILY_PURCHASE_LIMIT?: string;
      META_CONVERSIONS_API_ACCESS_TOKEN?: string;
      META_PIXEL_ID?: string;
      META_TEST_EVENT_CODE?: string;
    };
    const dailyLimit = Number(runtime.DAILY_PURCHASE_LIMIT ?? 25);

    if ((paidToday?.count ?? 0) >= dailyLimit) {
      return Response.json({ error: "Daily purchase limit has been reached." }, { status: 409 });
    }

    const couponCode = body.couponCode?.trim().toUpperCase() || null;
    const amountCents = await priceForCoupon(db, couponCode);
    const orderId = crypto.randomUUID();
    const requestUrl = new URL(request.url);
    const checkoutUrl = `${requestUrl.origin}/checkout/${orderId}`;

    await db
      .prepare(
        "INSERT INTO orders (id, lead_id, event_id, amount_cents, coupon_code, square_payment_link_id, square_order_id, checkout_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .bind(
        orderId,
        lead.lead_id,
        lead.event_id,
        amountCents,
        couponCode,
        null,
        null,
        checkoutUrl
      )
      .run();

    try {
      await sendMetaConversionEvent({
        accessToken: runtime.META_CONVERSIONS_API_ACCESS_TOKEN?.trim() || null,
        pixelId: runtime.META_PIXEL_ID?.trim() || null,
        testEventCode: runtime.META_TEST_EVENT_CODE?.trim() || null,
        eventName: "InitiateCheckout",
        eventId: orderId,
        eventSourceUrl: checkoutUrl,
        userData: {
          email: lead.email,
          externalId: lead.lead_id,
          clientIpAddress: getClientIpAddress(request),
          clientUserAgent: request.headers.get("user-agent"),
          fbclid: lead.fbclid,
        },
        customData: {
          currency: "USD",
          value: amountCents / 100,
          orderId,
        },
      });
    } catch (error) {
      console.error("Meta InitiateCheckout send failed", error);
    }

    return Response.json({ checkoutUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return Response.json({ error: message }, { status: 500 });
  }
}

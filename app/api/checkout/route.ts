import { env } from "cloudflare:workers";
import { ensureDatabase, getRawDb } from "@/db";

const PRICE_CENTS = 5700;

type LeadWithEvent = {
  lead_id: string;
  email: string;
  theme_park_days: number;
  event_id: number;
  event_page_url: string;
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
        "SELECT leads.id AS lead_id, leads.email AS email, leads.theme_park_days, events.id AS event_id, events.event_page_url AS event_page_url FROM leads JOIN events ON events.id = leads.matched_event_id WHERE leads.id = ? AND leads.status = 'matched' LIMIT 1"
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

    return Response.json({ checkoutUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return Response.json({ error: message }, { status: 500 });
  }
}

async function priceForCoupon(
  db: ReturnType<typeof getRawDb>,
  couponCode: string | null
) {
  if (!couponCode) {
    return PRICE_CENTS;
  }

  const coupon = await db
    .prepare(
      "SELECT discount_cents, max_redemptions, redemption_count, expires_at FROM coupons WHERE code = ? AND active = 1 LIMIT 1"
    )
    .bind(couponCode)
    .first<{
      discount_cents: number;
      max_redemptions: number | null;
      redemption_count: number;
      expires_at: string | null;
    }>();

  if (!coupon) {
    throw new Error("Coupon or access code was not found.");
  }

  if (coupon.max_redemptions !== null && coupon.redemption_count >= coupon.max_redemptions) {
    throw new Error("Coupon or access code has reached its limit.");
  }

  if (coupon.expires_at && coupon.expires_at < new Date().toISOString().slice(0, 10)) {
    throw new Error("Coupon or access code has expired.");
  }

  return Math.max(0, PRICE_CENTS - coupon.discount_cents);
}

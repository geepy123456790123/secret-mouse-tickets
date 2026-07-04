import { env } from "cloudflare:workers";
import { ensureDatabase, getRawDb } from "@/db";

type SummaryRow = {
  total_leads: number;
  matched_leads: number;
  not_found_leads: number;
  checkout_starts: number;
  paid_orders: number;
  pending_orders: number;
  revenue_cents: number;
  average_order_cents: number;
};

type EventPerformanceRow = {
  event_name: string;
  matched_leads: number;
  checkout_starts: number;
  paid_orders: number;
  revenue_cents: number;
  average_order_cents: number;
};

type CouponRow = {
  coupon_code: string | null;
  checkout_starts: number;
  paid_orders: number;
  revenue_cents: number;
  average_order_cents: number;
};

type AttributionRow = {
  source: string;
  campaign: string;
  leads: number;
  matched_leads: number;
  checkout_starts: number;
  paid_orders: number;
  revenue_cents: number;
};

type DailyRow = {
  date: string;
  leads: number;
  matched_leads: number;
  checkout_starts: number;
  paid_orders: number;
  revenue_cents: number;
};

type RecentOrderRow = {
  order_id: string;
  status: string;
  amount_cents: number;
  coupon_code: string | null;
  created_at: string;
  paid_at: string | null;
  email: string;
  theme_park_days: number;
  guests_10_plus: number;
  guests_3_to_9: number;
  utm_source: string | null;
  utm_campaign: string | null;
  event_name: string;
};

type TimingRow = {
  lead_created_at: string;
  order_created_at: string;
  paid_at: string | null;
  status: string;
};

type CheckoutAgingRow = {
  under_1_hour: number;
  over_24_hours: number;
  over_7_days: number;
};

export async function GET(request: Request) {
  const auth = authorize(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    await ensureDatabase();

    const { startDate, endDate, endExclusive } = parseDateWindow(request.url);
    const db = getRawDb();

    const summary = await db
      .prepare(
        `SELECT
          COUNT(DISTINCT leads.id) AS total_leads,
          COUNT(DISTINCT CASE WHEN leads.status = 'matched' THEN leads.id END) AS matched_leads,
          COUNT(DISTINCT CASE WHEN leads.status != 'matched' THEN leads.id END) AS not_found_leads,
          COUNT(orders.id) AS checkout_starts,
          SUM(CASE WHEN orders.status = 'paid' THEN 1 ELSE 0 END) AS paid_orders,
          SUM(CASE WHEN orders.status != 'paid' AND orders.id IS NOT NULL THEN 1 ELSE 0 END) AS pending_orders,
          SUM(CASE WHEN orders.status = 'paid' THEN orders.amount_cents ELSE 0 END) AS revenue_cents,
          AVG(CASE WHEN orders.status = 'paid' THEN orders.amount_cents END) AS average_order_cents
        FROM leads
        LEFT JOIN orders ON orders.lead_id = leads.id
        WHERE leads.created_at >= ? AND leads.created_at < ?`
      )
      .bind(startDate, endExclusive)
      .first<SummaryRow>();

    const couponRows = await db
      .prepare(
        `SELECT
          orders.coupon_code,
          COUNT(orders.id) AS checkout_starts,
          SUM(CASE WHEN orders.status = 'paid' THEN 1 ELSE 0 END) AS paid_orders,
          SUM(CASE WHEN orders.status = 'paid' THEN orders.amount_cents ELSE 0 END) AS revenue_cents,
          AVG(CASE WHEN orders.status = 'paid' THEN orders.amount_cents END) AS average_order_cents
        FROM orders
        JOIN leads ON leads.id = orders.lead_id
        WHERE leads.created_at >= ? AND leads.created_at < ?
        GROUP BY orders.coupon_code
        ORDER BY revenue_cents DESC, paid_orders DESC, checkout_starts DESC
        LIMIT 20`
      )
      .bind(startDate, endExclusive)
      .all<CouponRow>();

    const eventPerformanceRows = await db
      .prepare(
        `SELECT
          events.info_banner_first AS event_name,
          COUNT(DISTINCT CASE WHEN leads.status = 'matched' THEN leads.id END) AS matched_leads,
          COUNT(orders.id) AS checkout_starts,
          SUM(CASE WHEN orders.status = 'paid' THEN 1 ELSE 0 END) AS paid_orders,
          SUM(CASE WHEN orders.status = 'paid' THEN orders.amount_cents ELSE 0 END) AS revenue_cents,
          AVG(CASE WHEN orders.status = 'paid' THEN orders.amount_cents END) AS average_order_cents
        FROM events
        JOIN leads ON leads.matched_event_id = events.id
        LEFT JOIN orders ON orders.lead_id = leads.id
        WHERE leads.created_at >= ? AND leads.created_at < ?
        GROUP BY events.id, events.info_banner_first
        ORDER BY revenue_cents DESC, paid_orders DESC, checkout_starts DESC, matched_leads DESC
        LIMIT 20`
      )
      .bind(startDate, endExclusive)
      .all<EventPerformanceRow>();

    const attributionRows = await db
      .prepare(
        `SELECT
          COALESCE(NULLIF(leads.utm_source, ''), 'direct') AS source,
          COALESCE(NULLIF(leads.utm_campaign, ''), '(none)') AS campaign,
          COUNT(DISTINCT leads.id) AS leads,
          COUNT(DISTINCT CASE WHEN leads.status = 'matched' THEN leads.id END) AS matched_leads,
          COUNT(orders.id) AS checkout_starts,
          SUM(CASE WHEN orders.status = 'paid' THEN 1 ELSE 0 END) AS paid_orders,
          SUM(CASE WHEN orders.status = 'paid' THEN orders.amount_cents ELSE 0 END) AS revenue_cents
        FROM leads
        LEFT JOIN orders ON orders.lead_id = leads.id
        WHERE leads.created_at >= ? AND leads.created_at < ?
        GROUP BY source, campaign
        ORDER BY revenue_cents DESC, paid_orders DESC, leads DESC
        LIMIT 20`
      )
      .bind(startDate, endExclusive)
      .all<AttributionRow>();

    const checkoutAging = await db
      .prepare(
        `SELECT
          SUM(CASE WHEN orders.status != 'paid' AND ((julianday('now') - julianday(orders.created_at)) * 24) < 1 THEN 1 ELSE 0 END) AS under_1_hour,
          SUM(CASE WHEN orders.status != 'paid' AND ((julianday('now') - julianday(orders.created_at)) * 24) >= 24 THEN 1 ELSE 0 END) AS over_24_hours,
          SUM(CASE WHEN orders.status != 'paid' AND ((julianday('now') - julianday(orders.created_at)) * 24) >= 168 THEN 1 ELSE 0 END) AS over_7_days
        FROM orders
        JOIN leads ON leads.id = orders.lead_id
        WHERE leads.created_at >= ? AND leads.created_at < ?`
      )
      .bind(startDate, endExclusive)
      .first<CheckoutAgingRow>();

    const dailyRows = await db
      .prepare(
        `SELECT
          substr(leads.created_at, 1, 10) AS date,
          COUNT(DISTINCT leads.id) AS leads,
          COUNT(DISTINCT CASE WHEN leads.status = 'matched' THEN leads.id END) AS matched_leads,
          COUNT(orders.id) AS checkout_starts,
          SUM(CASE WHEN orders.status = 'paid' THEN 1 ELSE 0 END) AS paid_orders,
          SUM(CASE WHEN orders.status = 'paid' THEN orders.amount_cents ELSE 0 END) AS revenue_cents
        FROM leads
        LEFT JOIN orders ON orders.lead_id = leads.id
        WHERE leads.created_at >= ? AND leads.created_at < ?
        GROUP BY date
        ORDER BY date ASC`
      )
      .bind(startDate, endExclusive)
      .all<DailyRow>();

    const timingRows = await db
      .prepare(
        `SELECT
          leads.created_at AS lead_created_at,
          orders.created_at AS order_created_at,
          orders.paid_at,
          orders.status
        FROM orders
        JOIN leads ON leads.id = orders.lead_id
        WHERE leads.created_at >= ? AND leads.created_at < ?
        ORDER BY orders.created_at ASC`
      )
      .bind(startDate, endExclusive)
      .all<TimingRow>();

    const recentOrders = await db
      .prepare(
        `SELECT
          orders.id AS order_id,
          orders.status,
          orders.amount_cents,
          orders.coupon_code,
          orders.created_at,
          orders.paid_at,
          leads.email,
          leads.theme_park_days,
          leads.guests_10_plus,
          leads.guests_3_to_9,
          leads.utm_source,
          leads.utm_campaign,
          events.info_banner_first AS event_name
        FROM orders
        JOIN leads ON leads.id = orders.lead_id
        JOIN events ON events.id = orders.event_id
        WHERE leads.created_at >= ? AND leads.created_at < ?
        ORDER BY orders.created_at DESC
        LIMIT 25`
      )
      .bind(startDate, endExclusive)
      .all<RecentOrderRow>();

    return Response.json({
      ok: true,
      window: { startDate, endDate },
      summary: normalizeSummary(summary),
      eventPerformance: (eventPerformanceRows.results ?? []).map(normalizeEventPerformance),
      coupons: (couponRows.results ?? []).map(normalizeCoupon),
      attribution: (attributionRows.results ?? []).map(normalizeAttribution),
      checkoutAging: normalizeCheckoutAging(checkoutAging),
      timings: normalizeTimings(timingRows.results ?? []),
      daily: (dailyRows.results ?? []).map(normalizeDaily),
      recentOrders: (recentOrders.results ?? []).map(normalizeRecentOrder),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return Response.json({ error: message }, { status: 500 });
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

function parseDateWindow(url: string) {
  const requestUrl = new URL(url);
  const today = new Date();
  const defaultStart = new Date(today);
  defaultStart.setUTCDate(today.getUTCDate() - 29);

  const startDate = parseIsoDate(requestUrl.searchParams.get("start")) ?? toIsoDate(defaultStart);
  const endDate = parseIsoDate(requestUrl.searchParams.get("end")) ?? toIsoDate(today);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + 1);

  return {
    startDate,
    endDate,
    endExclusive: toIsoDate(end),
  };
}

function parseIsoDate(value: string | null) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function normalizeSummary(row: SummaryRow | null) {
  const summary = row ?? {
    total_leads: 0,
    matched_leads: 0,
    not_found_leads: 0,
    checkout_starts: 0,
    paid_orders: 0,
    pending_orders: 0,
    revenue_cents: 0,
    average_order_cents: 0,
  };

  const totalLeads = Number(summary.total_leads ?? 0);
  const matchedLeads = Number(summary.matched_leads ?? 0);
  const revenueCents = Number(summary.revenue_cents ?? 0);

  return {
    totalLeads,
    matchedLeads,
    notFoundLeads: Number(summary.not_found_leads ?? 0),
    checkoutStarts: Number(summary.checkout_starts ?? 0),
    paidOrders: Number(summary.paid_orders ?? 0),
    pendingOrders: Number(summary.pending_orders ?? 0),
    revenueCents,
    averageOrderCents: Math.round(Number(summary.average_order_cents ?? 0)),
    revenuePerLeadCents: totalLeads ? Math.round(revenueCents / totalLeads) : 0,
    revenuePerMatchedLeadCents: matchedLeads ? Math.round(revenueCents / matchedLeads) : 0,
  };
}

function normalizeEventPerformance(row: EventPerformanceRow) {
  return {
    eventName: row.event_name,
    matchedLeads: Number(row.matched_leads ?? 0),
    checkoutStarts: Number(row.checkout_starts ?? 0),
    paidOrders: Number(row.paid_orders ?? 0),
    revenueCents: Number(row.revenue_cents ?? 0),
    averageOrderCents: Math.round(Number(row.average_order_cents ?? 0)),
  };
}

function normalizeCoupon(row: CouponRow) {
  return {
    couponCode: row.coupon_code ?? "No coupon",
    checkoutStarts: Number(row.checkout_starts ?? 0),
    paidOrders: Number(row.paid_orders ?? 0),
    revenueCents: Number(row.revenue_cents ?? 0),
    averageOrderCents: Math.round(Number(row.average_order_cents ?? 0)),
  };
}

function normalizeAttribution(row: AttributionRow) {
  const leads = Number(row.leads ?? 0);
  const matchedLeads = Number(row.matched_leads ?? 0);
  const checkoutStarts = Number(row.checkout_starts ?? 0);
  const paidOrders = Number(row.paid_orders ?? 0);
  const revenueCents = Number(row.revenue_cents ?? 0);

  return {
    source: row.source,
    campaign: row.campaign,
    leads,
    matchedLeads,
    checkoutStarts,
    paidOrders,
    revenueCents,
    revenuePerLeadCents: leads ? Math.round(revenueCents / leads) : 0,
  };
}

function normalizeCheckoutAging(row: CheckoutAgingRow | null) {
  return {
    under1Hour: Number(row?.under_1_hour ?? 0),
    over24Hours: Number(row?.over_24_hours ?? 0),
    over7Days: Number(row?.over_7_days ?? 0),
  };
}

function normalizeTimings(rows: TimingRow[]) {
  const leadToCheckoutHours: number[] = [];
  const checkoutToPaidHours: number[] = [];

  for (const row of rows) {
    const leadCreatedAt = Date.parse(row.lead_created_at);
    const orderCreatedAt = Date.parse(row.order_created_at);

    if (Number.isFinite(leadCreatedAt) && Number.isFinite(orderCreatedAt)) {
      leadToCheckoutHours.push((orderCreatedAt - leadCreatedAt) / 36e5);
    }

    if (row.status === "paid" && row.paid_at) {
      const paidAt = Date.parse(row.paid_at);
      if (Number.isFinite(orderCreatedAt) && Number.isFinite(paidAt)) {
        checkoutToPaidHours.push((paidAt - orderCreatedAt) / 36e5);
      }
    }
  }

  return {
    medianLeadToCheckoutHours: median(leadToCheckoutHours),
    medianCheckoutToPaidHours: median(checkoutToPaidHours),
  };
}

function normalizeDaily(row: DailyRow) {
  return {
    date: row.date,
    leads: Number(row.leads ?? 0),
    matchedLeads: Number(row.matched_leads ?? 0),
    checkoutStarts: Number(row.checkout_starts ?? 0),
    paidOrders: Number(row.paid_orders ?? 0),
    revenueCents: Number(row.revenue_cents ?? 0),
  };
}

function normalizeRecentOrder(row: RecentOrderRow) {
  return {
    orderId: row.order_id,
    status: row.status,
    amountCents: Number(row.amount_cents ?? 0),
    couponCode: row.coupon_code,
    createdAt: row.created_at,
    paidAt: row.paid_at,
    email: row.email,
    themeParkDays: Number(row.theme_park_days ?? 0),
    guests10Plus: Number(row.guests_10_plus ?? 0),
    guests3To9: Number(row.guests_3_to_9 ?? 0),
    source: row.utm_source ?? "direct",
    campaign: row.utm_campaign ?? "(none)",
    eventName: row.event_name,
  };
}

function median(values: number[]) {
  if (!values.length) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return roundHours((sorted[middle - 1] + sorted[middle]) / 2);
  }

  return roundHours(sorted[middle]);
}

function roundHours(value: number) {
  return Math.round(value * 10) / 10;
}

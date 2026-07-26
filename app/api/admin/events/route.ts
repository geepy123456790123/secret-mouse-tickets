import { ensureDatabase, getRawDb } from "@/db";
import { isIsoDate, todayIso } from "@/lib/dates";
import { env } from "cloudflare:workers";

type EventDestination = "disney_world" | "disneyland" | "unknown";

type IncomingEvent = {
  eventPageUrl: string;
  infoBannerFirst: string;
  infoBannerSecond: string;
  eventStartDate: string;
  eventEndDate: string;
  validStartDate: string;
  validEndDate: string;
  destination?: EventDestination;
  ticketBookingUrl?: string | null;
  ticketCampaignCode?: string | null;
  ticketPriceStatus?: "not_configured" | "collected" | "empty" | "failed";
  ticketPricesJson?: string | null;
  ticketPricesCollectedAt?: string | null;
  ticketPriceError?: string | null;
  excluded?: boolean;
};

export async function GET() {
  await ensureDatabase();
  const rows = await getRawDb()
    .prepare("SELECT * FROM events ORDER BY event_start_date ASC LIMIT 100")
    .all();
  return Response.json({ events: rows.results });
}

export async function POST(request: Request) {
  const auth = authorize(request);
  if (!auth.ok) {
    return auth.response;
  }

  await ensureDatabase();
  const payload = (await request.json()) as IncomingEvent | IncomingEvent[];
  const events = Array.isArray(payload) ? payload : [payload];
  const db = getRawDb();
  const today = todayIso();
  let upserted = 0;
  let ignored = 0;

  await cleanupNonProductionEvents(db);

  for (const event of events) {
    validateIncomingEvent(event);
    const destination = event.destination ?? "disney_world";

    if (event.excluded || destination !== "disney_world" || event.eventStartDate <= today) {
      await db
        .prepare("DELETE FROM events WHERE event_page_url = ?")
        .bind(event.eventPageUrl)
        .run();
      ignored += 1;
      continue;
    }

    await db
      .prepare(
        "INSERT INTO events (event_page_url, info_banner_first, info_banner_second, event_start_date, event_end_date, valid_start_date, valid_end_date, destination, ticket_booking_url, ticket_campaign_code, ticket_price_status, ticket_prices_json, ticket_prices_collected_at, ticket_price_error, hotel_special_rate_available, hotel_name, hotel_booking_url, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(event_page_url) DO UPDATE SET info_banner_first = excluded.info_banner_first, info_banner_second = excluded.info_banner_second, event_start_date = excluded.event_start_date, event_end_date = excluded.event_end_date, valid_start_date = excluded.valid_start_date, valid_end_date = excluded.valid_end_date, destination = excluded.destination, ticket_booking_url = excluded.ticket_booking_url, ticket_campaign_code = excluded.ticket_campaign_code, ticket_price_status = CASE WHEN excluded.ticket_price_status = 'not_configured' AND events.ticket_prices_json IS NOT NULL THEN events.ticket_price_status ELSE excluded.ticket_price_status END, ticket_prices_json = COALESCE(excluded.ticket_prices_json, events.ticket_prices_json), ticket_prices_collected_at = COALESCE(excluded.ticket_prices_collected_at, events.ticket_prices_collected_at), ticket_price_error = excluded.ticket_price_error, hotel_special_rate_available = excluded.hotel_special_rate_available, hotel_name = excluded.hotel_name, hotel_booking_url = excluded.hotel_booking_url, updated_at = CURRENT_TIMESTAMP"
      )
      .bind(
        event.eventPageUrl,
        event.infoBannerFirst,
        event.infoBannerSecond,
        event.eventStartDate,
        event.eventEndDate,
        event.validStartDate,
        event.validEndDate,
        destination,
        event.ticketBookingUrl ?? null,
        event.ticketCampaignCode ?? null,
        event.ticketPriceStatus ?? "not_configured",
        event.ticketPricesJson ?? null,
        event.ticketPricesCollectedAt ?? null,
        event.ticketPriceError ?? null,
        0,
        null,
        null
      )
      .run();
    upserted += 1;
  }

  await db
    .prepare(
      "INSERT INTO scrape_runs (status, candidate_count, upserted_count, ignored_count) VALUES (?, ?, ?, ?)"
    )
    .bind("completed", events.length, upserted, ignored)
    .run();

  return Response.json({ ok: true, upserted, ignored });
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

async function cleanupNonProductionEvents(db: ReturnType<typeof getRawDb>) {
  await db.batch([
    db
      .prepare("DELETE FROM events WHERE event_page_url IN (?, ?)")
      .bind("https://disneyevent.com/example-convention", "https://disneyevent.com/test-event"),
    db.prepare("DELETE FROM events WHERE event_page_url LIKE ?").bind("%/know-before-you-go%"),
  ]);
}

function validateIncomingEvent(event: IncomingEvent) {
  if (!event.eventPageUrl || !URL.canParse(event.eventPageUrl)) {
    throw new Error("eventPageUrl must be a valid URL.");
  }

  for (const field of ["eventStartDate", "eventEndDate", "validStartDate", "validEndDate"] as const) {
    if (!isIsoDate(event[field])) {
      throw new Error(`${field} must be YYYY-MM-DD.`);
    }
  }

  if (!event.infoBannerFirst || !event.infoBannerSecond) {
    throw new Error("Event banner fields are required.");
  }

  if (
    event.destination &&
    !["disney_world", "disneyland", "unknown"].includes(event.destination)
  ) {
    throw new Error("destination must be disney_world, disneyland, or unknown.");
  }

  if (event.ticketBookingUrl && !URL.canParse(event.ticketBookingUrl)) {
    throw new Error("ticketBookingUrl must be a valid URL.");
  }

  if (
    event.ticketPriceStatus &&
    !["not_configured", "collected", "empty", "failed"].includes(event.ticketPriceStatus)
  ) {
    throw new Error("ticketPriceStatus is invalid.");
  }

  if (
    event.ticketPricesCollectedAt &&
    Number.isNaN(Date.parse(event.ticketPricesCollectedAt))
  ) {
    throw new Error("ticketPricesCollectedAt must be an ISO timestamp.");
  }

  if (event.ticketPricesJson) {
    JSON.parse(event.ticketPricesJson);
  }
}

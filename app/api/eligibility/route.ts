import { ensureDatabase, getRawDb } from "@/db";
import {
  disqualificationReason,
  parseEligibilityInput,
  type EventRecord,
} from "@/lib/eligibility";
import { todayIso } from "@/lib/dates";

type AttributionInput = {
  visitId: string | null;
  sessionId: string | null;
  visitorId: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  landingPage: string | null;
  referrer: string | null;
  referrerDomain: string | null;
  gclid: string | null;
  fbclid: string | null;
  msclkid: string | null;
};

export async function POST(request: Request) {
  try {
    await ensureDatabase();

    const body = await request.json();
    const parsed = parseEligibilityInput(body);
    if (!parsed.ok) {
      return Response.json({ error: parsed.error }, { status: 400 });
    }

    const db = getRawDb();
    const input = parsed.input;
    const attribution = parseAttribution(body);
    const today = todayIso();
    const event = await db
      .prepare(
        "SELECT * FROM events WHERE destination = 'disney_world' AND valid_start_date <= ? AND valid_end_date >= ? AND event_start_date > ? ORDER BY event_start_date ASC LIMIT 1"
      )
      .bind(input.visitStartDate, input.visitEndDate, today)
      .first<EventRecord>();

    const reason = disqualificationReason(input, event ?? null);
    const leadId = crypto.randomUUID();
    const status = reason ? "not_found" : "matched";

    await db
      .prepare(
        "INSERT INTO leads (id, visit_start_date, visit_end_date, theme_park_days, park_hopper, guests_10_plus, guests_3_to_9, florida_resident, email, status, matched_event_id, visit_id, session_id, visitor_id, utm_source, utm_medium, utm_campaign, utm_content, utm_term, landing_page, referrer, referrer_domain, gclid, fbclid, msclkid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .bind(
        leadId,
        input.visitStartDate,
        input.visitEndDate,
        input.themeParkDays,
        0,
        input.guests10Plus,
        input.guests3To9,
        0,
        input.email,
        status,
        event?.id ?? null,
        attribution.visitId,
        attribution.sessionId,
        attribution.visitorId,
        attribution.utmSource,
        attribution.utmMedium,
        attribution.utmCampaign,
        attribution.utmContent,
        attribution.utmTerm,
        attribution.landingPage,
        attribution.referrer,
        attribution.referrerDomain,
        attribution.gclid,
        attribution.fbclid,
        attribution.msclkid
      )
      .run();

    if (reason || !event) {
      return Response.json({ outcome: "not_found", message: reason });
    }

    return Response.json({
      outcome: "matched",
      leadId,
      event: {
        eventPageUrl: event.event_page_url,
        infoBannerFirst: event.info_banner_first,
        eventStartDate: event.event_start_date,
        eventEndDate: event.event_end_date,
        validStartDate: event.valid_start_date,
        validEndDate: event.valid_end_date,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return Response.json({ error: message }, { status: 500 });
  }
}

function parseAttribution(payload: unknown): AttributionInput {
  const attribution =
    payload && typeof payload === "object"
      ? (payload as { attribution?: unknown }).attribution
      : null;
  const record =
    attribution && typeof attribution === "object"
      ? (attribution as Record<string, unknown>)
      : {};

  return {
    visitId: normalizeAttribution(record.visitId),
    sessionId: normalizeAttribution(record.sessionId),
    visitorId: normalizeAttribution(record.visitorId),
    utmSource: normalizeAttribution(record.utmSource),
    utmMedium: normalizeAttribution(record.utmMedium),
    utmCampaign: normalizeAttribution(record.utmCampaign),
    utmContent: normalizeAttribution(record.utmContent),
    utmTerm: normalizeAttribution(record.utmTerm),
    landingPage: normalizeAttribution(record.landingPage),
    referrer: normalizeAttribution(record.referrer),
    referrerDomain: normalizeAttribution(record.referrerDomain),
    gclid: normalizeAttribution(record.gclid),
    fbclid: normalizeAttribution(record.fbclid),
    msclkid: normalizeAttribution(record.msclkid),
  };
}

function normalizeAttribution(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 500) : null;
}

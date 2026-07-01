import { ensureDatabase, getRawDb } from "@/db";
import {
  disqualificationReason,
  parseEligibilityInput,
  type EventRecord,
} from "@/lib/eligibility";
import { todayIso } from "@/lib/dates";

export async function POST(request: Request) {
  try {
    await ensureDatabase();

    const parsed = parseEligibilityInput(await request.json());
    if (!parsed.ok) {
      return Response.json({ error: parsed.error }, { status: 400 });
    }

    const db = getRawDb();
    const input = parsed.input;
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
        "INSERT INTO leads (id, visit_start_date, visit_end_date, theme_park_days, park_hopper, guests_10_plus, guests_3_to_9, florida_resident, email, status, matched_event_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
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
        event?.id ?? null
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

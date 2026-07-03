import { env } from "cloudflare:workers";
import { load } from "cheerio";
import { ensureDatabase, getRawDb } from "@/db";
import { todayIso } from "@/lib/dates";
import {
  DEFAULT_RESULT_PAGES,
  SearchProvider,
  clampNumber,
  discoverDisneyEventLinks,
  getSearchProvider,
  isCandidateEventUrl,
} from "@/lib/disneyevent-search";

type EventDestination = "disney_world" | "disneyland" | "unknown";

type ScrapedEvent = {
  eventPageUrl: string;
  infoBannerFirst: string;
  infoBannerSecond: string;
  eventStartDate: string;
  eventEndDate: string;
  validStartDate: string;
  validEndDate: string;
  destination: EventDestination;
  excluded?: boolean;
};

type SkippedUrl = {
  url: string;
  reason: string;
  status?: number;
};

const DEFAULT_CONCURRENCY = 6;
const DEFAULT_RESULTS_PER_PAGE = 10;
const EXCLUDED_BROCHURE_SRC =
  "https://258ade6f769e5102661c-d0ee5722296a6e07a9b11bb4054abd10.ssl.cf2.rackcdn.com/thumbs/yBcDUZZON5KjxryAb3o2uizUnHfloBHeBrochure.png";

export async function POST(request: Request) {
  const auth = authorize(request);
  if (!auth.ok) {
    return auth.response;
  }

  const runtime = env as typeof env & { SERPER_API_KEY?: string };
  if (!runtime.SERPER_API_KEY) {
    return Response.json({ error: "SERPER_API_KEY is not configured." }, { status: 500 });
  }

  const options = await request.json().catch(() => ({}));
  const pages = clampNumber(options.pages, 1, DEFAULT_RESULT_PAGES, DEFAULT_RESULT_PAGES);
  const concurrency = clampNumber(options.concurrency, 1, 10, DEFAULT_CONCURRENCY);
  const provider = getSearchProvider(options.provider ?? runtime.SEARCH_NORMALIZER_PROVIDER);
  const query =
    typeof options.query === "string" && options.query.trim() ? options.query.trim() : undefined;
  const googleSearchUrl =
    typeof options.googleSearchUrl === "string" && options.googleSearchUrl.trim()
      ? options.googleSearchUrl.trim()
      : runtime.GOOGLE_SEARCH_URL;

  await ensureDatabase();
  const db = getRawDb();
  const runStart = await db
    .prepare("INSERT INTO scrape_runs (status, provider, query, source_url) VALUES (?, ?, ?, ?)")
    .bind("running", provider, query ?? null, googleSearchUrl ?? null)
    .run();
  const runId = Number(runStart.meta.last_row_id);

  try {
    const discovery = await discoverCandidateUrls({
      apiKey: runtime.SERPER_API_KEY,
      provider,
      query,
      pages,
      googleSearchUrl,
    });
    const urls = discovery.items.map((item) => item.link);
    await logRunItems(
      db,
      runId,
      urls.map((url) => ({ url, status: "candidate", reason: null }))
    );
    const { events, skipped } = await scrapeCandidateUrls(urls, concurrency);
    const ingest = await upsertEvents(db, events);
    const reasonSummary = summarizeReasons([
      ...skipped.map((item) => item.reason),
      ...ingest.ignoredItems.map((item) => item.reason),
    ]);

    await logRunItems(
      db,
      runId,
      skipped.map((item) => ({
        url: item.url,
        status: "skipped",
        reason: item.reason,
      }))
    );
    await logRunItems(
      db,
      runId,
      ingest.ignoredItems.map((item) => ({
        url: item.url,
        status: "ignored",
        reason: item.reason,
      }))
    );
    await logRunItems(
      db,
      runId,
      ingest.upsertedUrls.map((url) => ({
        url,
        status: "upserted",
        reason: null,
      }))
    );

    await db
      .prepare(
        "UPDATE scrape_runs SET status = ?, provider = ?, query = ?, source_url = ?, candidate_count = ?, parsed_count = ?, skipped_count = ?, upserted_count = ?, ignored_count = ?, error = NULL WHERE id = ?"
      )
      .bind(
        "completed",
        discovery.provider,
        discovery.query,
        discovery.sourceUrl,
        urls.length,
        events.length,
        skipped.length,
        ingest.upserted,
        ingest.ignored,
        runId
      )
      .run();

    return Response.json({
      ok: true,
      runId,
      provider: discovery.provider,
      sourceUrl: discovery.sourceUrl,
      query: discovery.query,
      discovered: urls.length,
      parsed: events.length,
      skipped: skipped.length,
      ingest,
      skipReasonSummary: reasonSummary,
      warnings: discovery.warnings,
      sampleEvents: events.slice(0, 5).map((event) => ({
        eventPageUrl: event.eventPageUrl,
        infoBannerFirst: event.infoBannerFirst,
        eventStartDate: event.eventStartDate,
        eventEndDate: event.eventEndDate,
        destination: event.destination,
      })),
      sampleSkipped: skipped.slice(0, 10),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db
      .prepare("UPDATE scrape_runs SET status = ?, error = ? WHERE id = ?")
      .bind("failed", message, runId)
      .run();

    return Response.json({ ok: false, runId, error: message }, { status: 500 });
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

async function discoverCandidateUrls({
  apiKey,
  provider,
  query,
  pages,
  googleSearchUrl,
}: {
  apiKey?: string;
  provider: SearchProvider;
  query?: string;
  pages: number;
  googleSearchUrl?: string;
}) {
  const discovery = await discoverDisneyEventLinks({
    apiKey,
    provider,
    query,
    num: DEFAULT_RESULTS_PER_PAGE,
    page: 1,
    pages,
    googleSearchUrlValue: googleSearchUrl,
  });

  return {
    ...discovery,
    items: discovery.items.filter((item) => isCandidateEventUrl(item.link)),
  };
}

async function scrapeCandidateUrls(urls: string[], concurrency: number) {
  const events: ScrapedEvent[] = [];
  const skipped: SkippedUrl[] = [];
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < urls.length) {
      const url = urls[nextIndex];
      nextIndex += 1;

      try {
        const response = await fetch(url, {
          headers: {
            "User-Agent":
              "SecretMouseTicketsBot/0.1 authorized event indexing contact=hello@secretmousetickets.com",
          },
        });

        if (!response.ok) {
          skipped.push({ url, reason: `HTTP ${response.status}`, status: response.status });
          continue;
        }

        const html = await response.text();
        const event = parseEventPage(url, html);
        if (!event) {
          skipped.push({ url, reason: "No event date payload found." });
          continue;
        }

        events.push(event);
      } catch (error) {
        skipped.push({
          url,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  return { events, skipped };
}

async function upsertEvents(db: ReturnType<typeof getRawDb>, events: ScrapedEvent[]) {
  const today = todayIso();
  let upserted = 0;
  let ignored = 0;
  const ignoredItems: SkippedUrl[] = [];
  const upsertedUrls: string[] = [];

  await cleanupNonProductionEvents(db);

  for (const event of events) {
    let ignoreReason: string | null = null;

    if (event.excluded) {
      ignoreReason = "Excluded by brochure image or destination filter.";
    } else if (event.destination !== "disney_world") {
      ignoreReason = `Destination ${event.destination} is not Disney World.`;
    } else if (event.eventStartDate <= today) {
      ignoreReason = `Event start ${event.eventStartDate} is not in the future.`;
    }

    if (ignoreReason) {
      await db.prepare("DELETE FROM events WHERE event_page_url = ?").bind(event.eventPageUrl).run();
      ignored += 1;
      ignoredItems.push({ url: event.eventPageUrl, reason: ignoreReason });
      continue;
    }

    await db
      .prepare(
        "INSERT INTO events (event_page_url, info_banner_first, info_banner_second, event_start_date, event_end_date, valid_start_date, valid_end_date, destination, hotel_special_rate_available, hotel_name, hotel_booking_url, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(event_page_url) DO UPDATE SET info_banner_first = excluded.info_banner_first, info_banner_second = excluded.info_banner_second, event_start_date = excluded.event_start_date, event_end_date = excluded.event_end_date, valid_start_date = excluded.valid_start_date, valid_end_date = excluded.valid_end_date, destination = excluded.destination, hotel_special_rate_available = excluded.hotel_special_rate_available, hotel_name = excluded.hotel_name, hotel_booking_url = excluded.hotel_booking_url, updated_at = CURRENT_TIMESTAMP"
      )
      .bind(
        event.eventPageUrl,
        event.infoBannerFirst,
        event.infoBannerSecond,
        event.eventStartDate,
        event.eventEndDate,
        event.validStartDate,
        event.validEndDate,
        event.destination,
        0,
        null,
        null
      )
      .run();

    upserted += 1;
    upsertedUrls.push(event.eventPageUrl);
  }

  return { ok: true, upserted, ignored, ignoredItems, upsertedUrls };
}

async function cleanupNonProductionEvents(db: ReturnType<typeof getRawDb>) {
  await db.batch([
    db
      .prepare("DELETE FROM events WHERE event_page_url IN (?, ?)")
      .bind("https://disneyevent.com/example-convention", "https://disneyevent.com/test-event"),
    db.prepare("DELETE FROM events WHERE event_page_url LIKE ?").bind("%/know-before-you-go%"),
  ]);
}

function parseEventPage(url: string, html: string): ScrapedEvent | null {
  const $ = load(html);

  if ($(`img[src="${EXCLUDED_BROCHURE_SRC}"]`).length) {
    return {
      eventPageUrl: url,
      infoBannerFirst: "Excluded brochure page",
      infoBannerSecond: "Excluded brochure page",
      eventStartDate: "1970-01-01",
      eventEndDate: "1970-01-01",
      validStartDate: "1970-01-01",
      validEndDate: "1970-01-01",
      destination: "unknown",
      excluded: true,
    };
  }

  return parseNextEventPage($, url, html);
}

function parseNextEventPage($: ReturnType<typeof load>, url: string, html: string) {
  const payload = extractNextFlightText(html) || html;
  const infoBannerFirst =
    extractNextEventName(payload) ??
    $("meta[property='og:title']").attr("content")?.trim();
  const eventStart = extractNextDateField(payload, "eventStart");
  const eventEnd = extractNextDateField(payload, "eventEnd");

  if (!infoBannerFirst || !eventStart || !eventEnd) {
    return null;
  }

  const eventStartDate = isoFromTimestamp(eventStart);
  const eventEndDate = isoFromTimestamp(eventEnd);
  const infoBannerSecond = formatDateRange(eventStartDate, eventEndDate);
  const destination = classifyDestination(`${payload}\n${html}\n${infoBannerFirst}`);

  return {
    eventPageUrl: url,
    infoBannerFirst,
    infoBannerSecond,
    eventStartDate,
    eventEndDate,
    validStartDate: addDays(eventStartDate, -7),
    validEndDate: addDays(eventEndDate, 7),
    destination,
    excluded: destination !== "disney_world",
  };
}

function classifyDestination(text: string): EventDestination {
  const lower = text.toLowerCase();
  const disneylandMarkers = [
    "disneyland.disney.go.com",
    "disneyland resort",
    "disneyland park",
    "disney california adventure",
    "downtown disney district",
    "anaheim, california",
    "bolt_dlr",
    "dlr_conv",
  ];
  const disneyWorldMarkers = [
    "disneyworld.disney.go.com",
    "walt disney world",
    "disney world",
    "magic kingdom",
    "epcot",
    "disney's hollywood studios",
    "disney hollywood studios",
    "disney's animal kingdom",
    "disney animal kingdom",
    "disney springs",
    "central florida",
    "bolt_wdw",
    "wdw_conv",
  ];

  const disneylandScore = countMarkers(lower, disneylandMarkers);
  const disneyWorldScore = countMarkers(lower, disneyWorldMarkers);

  if (disneylandScore > disneyWorldScore) {
    return "disneyland";
  }

  if (disneyWorldScore > 0) {
    return "disney_world";
  }

  return "unknown";
}

function countMarkers(text: string, markers: string[]) {
  return markers.reduce((count, marker) => count + (text.includes(marker) ? 1 : 0), 0);
}

function isoFromTimestamp(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Unable to parse timestamp: ${value}`);
  }

  return date.toISOString().slice(0, 10);
}

function addDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatDateRange(startIso: string, endIso: string) {
  const start = formatDisplayDate(startIso);
  const end = formatDisplayDate(endIso);

  return start === end ? start : `${start} - ${end}`;
}

function formatDisplayDate(isoDate: string) {
  const date = new Date(`${isoDate}T00:00:00.000Z`);

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function extractNextFlightText(html: string) {
  const pattern = /self\.__next_f\.push\(\[1,"((?:\\.|[^"\\])*)"\]\)<\/script>/g;
  let match;
  let payload = "";

  while ((match = pattern.exec(html))) {
    payload += decodeEscapedValue(match[1]);
  }

  return payload;
}

function extractNextDateField(text: string, field: string) {
  const value = extractNextStringField(text, field);

  if (!value) {
    return null;
  }

  return value.startsWith("$D") ? value.slice(2) : value;
}

function extractNextEventName(text: string) {
  return (
    extractNearestFieldBefore(text, `\\"eventStart\\":\\"`, `\\"name\\":\\"`, `\\"`) ??
    extractNearestFieldBefore(text, `"eventStart":"`, `"name":"`, `"`)
  );
}

function extractNextStringField(text: string, field: string) {
  return (
    extractDelimitedField(text, `\\"${field}\\":\\"`, `\\"`) ??
    extractDelimitedField(text, `"${field}":"`, `"`)
  );
}

function extractDelimitedField(text: string, prefix: string, suffix: string) {
  const start = text.indexOf(prefix);

  if (start === -1) {
    return null;
  }

  const valueStart = start + prefix.length;
  const valueEnd = text.indexOf(suffix, valueStart);

  if (valueEnd === -1) {
    return null;
  }

  return decodeEscapedValue(text.slice(valueStart, valueEnd));
}

function extractNearestFieldBefore(text: string, marker: string, prefix: string, suffix: string) {
  const markerStart = text.indexOf(marker);

  if (markerStart === -1) {
    return null;
  }

  const start = text.lastIndexOf(prefix, markerStart);

  if (start === -1) {
    return null;
  }

  const valueStart = start + prefix.length;
  const valueEnd = text.indexOf(suffix, valueStart);

  if (valueEnd === -1 || valueEnd > markerStart) {
    return null;
  }

  return decodeEscapedValue(text.slice(valueStart, valueEnd));
}

function decodeEscapedValue(value: string) {
  try {
    return JSON.parse(`"${value}"`);
  } catch {
    return value.replace(/\\u0026/g, "&").replace(/\\"/g, "\"").replace(/\\\\/g, "\\");
  }
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

async function logRunItems(
  db: ReturnType<typeof getRawDb>,
  runId: number,
  items: Array<{ url: string; status: string; reason: string | null }>
) {
  if (!items.length) {
    return;
  }

  const statements = items.map((item) =>
    db
      .prepare("INSERT INTO scrape_run_items (scrape_run_id, url, status, reason) VALUES (?, ?, ?, ?)")
      .bind(runId, item.url, item.status, item.reason)
  );

  await db.batch(statements);
}

function summarizeReasons(reasons: string[]) {
  const counts = new Map<string, number>();

  for (const reason of reasons) {
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 10)
    .map(([reason, count]) => ({ reason, count }));
}

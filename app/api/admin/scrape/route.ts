import { env } from "cloudflare:workers";
import { load } from "cheerio";
import { ensureDatabase, getRawDb } from "@/db";
import { todayIso } from "@/lib/dates";

type SerperOrganicResult = {
  link?: string;
};

type SerperResponse = {
  organic?: SerperOrganicResult[];
  message?: string;
  error?: string;
};

type ScrapedEvent = {
  eventPageUrl: string;
  infoBannerFirst: string;
  infoBannerSecond: string;
  eventStartDate: string;
  eventEndDate: string;
  validStartDate: string;
  validEndDate: string;
  excluded?: boolean;
};

type SkippedUrl = {
  url: string;
  reason: string;
};

const DEFAULT_QUERY = "site:disneyevent.com";
const DEFAULT_RESULT_PAGES = 15;
const DEFAULT_CONCURRENCY = 6;
const SERPER_SEARCH_URL = "https://google.serper.dev/search";
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
  const query = typeof options.query === "string" && options.query.trim() ? options.query.trim() : DEFAULT_QUERY;

  await ensureDatabase();
  const db = getRawDb();

  try {
    const urls = await discoverCandidateUrls(runtime.SERPER_API_KEY, query, pages);
    const { events, skipped } = await scrapeCandidateUrls(urls, concurrency);
    const ingest = await upsertEvents(db, events);

    await db
      .prepare(
        "INSERT INTO scrape_runs (status, candidate_count, upserted_count, ignored_count) VALUES (?, ?, ?, ?)"
      )
      .bind("completed", urls.length, ingest.upserted, ingest.ignored)
      .run();

    return Response.json({
      ok: true,
      discovered: urls.length,
      parsed: events.length,
      skipped: skipped.length,
      ingest,
      sampleEvents: events.slice(0, 5).map((event) => ({
        eventPageUrl: event.eventPageUrl,
        infoBannerFirst: event.infoBannerFirst,
        eventStartDate: event.eventStartDate,
        eventEndDate: event.eventEndDate,
      })),
      sampleSkipped: skipped.slice(0, 10),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db
      .prepare("INSERT INTO scrape_runs (status, error) VALUES (?, ?)")
      .bind("failed", message)
      .run();

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

async function discoverCandidateUrls(apiKey: string, query: string, pages: number) {
  const results = await Promise.all(
    Array.from({ length: pages }, (_, index) => fetchSerperPage(apiKey, query, index + 1))
  );

  return dedupeLinks(
    results
      .flatMap((payload) => payload.organic ?? [])
      .map((result) => result.link)
      .filter((link): link is string => typeof link === "string")
      .filter((link) => link.startsWith("https://disneyevent.com/"))
      .map(normalizeEventPageUrl)
      .filter(isCandidateEventUrl)
  );
}

async function fetchSerperPage(apiKey: string, query: string, page: number) {
  const response = await fetch(SERPER_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
    },
    body: JSON.stringify({
      q: query,
      gl: "us",
      hl: "en",
      num: 10,
      page,
      filter: "0",
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as SerperResponse;

  if (!response.ok) {
    throw new Error(
      payload.message ?? payload.error ?? `Serper returned status ${response.status} on page ${page}.`
    );
  }

  return payload;
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
          skipped.push({ url, reason: `HTTP ${response.status}` });
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

  await cleanupNonProductionEvents(db);

  for (const event of events) {
    if (event.excluded || event.eventStartDate <= today) {
      await db.prepare("DELETE FROM events WHERE event_page_url = ?").bind(event.eventPageUrl).run();
      ignored += 1;
      continue;
    }

    await db
      .prepare(
        "INSERT INTO events (event_page_url, info_banner_first, info_banner_second, event_start_date, event_end_date, valid_start_date, valid_end_date, hotel_special_rate_available, hotel_name, hotel_booking_url, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(event_page_url) DO UPDATE SET info_banner_first = excluded.info_banner_first, info_banner_second = excluded.info_banner_second, event_start_date = excluded.event_start_date, event_end_date = excluded.event_end_date, valid_start_date = excluded.valid_start_date, valid_end_date = excluded.valid_end_date, hotel_special_rate_available = excluded.hotel_special_rate_available, hotel_name = excluded.hotel_name, hotel_booking_url = excluded.hotel_booking_url, updated_at = CURRENT_TIMESTAMP"
      )
      .bind(
        event.eventPageUrl,
        event.infoBannerFirst,
        event.infoBannerSecond,
        event.eventStartDate,
        event.eventEndDate,
        event.validStartDate,
        event.validEndDate,
        0,
        null,
        null
      )
      .run();

    upserted += 1;
  }

  return { ok: true, upserted, ignored };
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

  return {
    eventPageUrl: url,
    infoBannerFirst,
    infoBannerSecond,
    eventStartDate,
    eventEndDate,
    validStartDate: addDays(eventStartDate, -7),
    validEndDate: addDays(eventEndDate, 7),
  };
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

function normalizeEventPageUrl(value: string) {
  const url = new URL(value);

  url.hash = "";

  for (const key of [...url.searchParams.keys()]) {
    if (key.startsWith("utm_") || key === "mc_cid" || key === "mc_eid") {
      url.searchParams.delete(key);
    }
  }

  return url.toString();
}

function isCandidateEventUrl(value: string) {
  const url = new URL(value);

  return url.hostname === "disneyevent.com" && !url.pathname.endsWith("/know-before-you-go");
}

function dedupeLinks(links: string[]) {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const link of links) {
    if (!seen.has(link)) {
      seen.add(link);
      deduped.push(link);
    }
  }

  return deduped;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

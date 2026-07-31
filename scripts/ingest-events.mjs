import { load } from "cheerio";
import { collectBrowserlessTicketPrices } from "./browserless-ticket-price-collector.mjs";

const EXCLUDED_BROCHURE_SRC =
  "https://258ade6f769e5102661c-d0ee5722296a6e07a9b11bb4054abd10.ssl.cf2.rackcdn.com/thumbs/yBcDUZZON5KjxryAb3o2uizUnHfloBHeBrochure.png";

const MONTHS = new Map(
  Object.entries({
    jan: 0,
    january: 0,
    feb: 1,
    february: 1,
    mar: 2,
    march: 2,
    apr: 3,
    april: 3,
    may: 4,
    jun: 5,
    june: 5,
    jul: 6,
    july: 6,
    aug: 7,
    august: 7,
    sep: 8,
    sept: 8,
    september: 8,
    oct: 9,
    october: 9,
    nov: 10,
    november: 10,
    dec: 11,
    december: 11,
  })
);

async function main() {
  const urls = await discoverCandidateUrls();
  const events = [];
  const skipped = [];
  const concurrency = normalizeConcurrency(process.env.EVENT_SCRAPE_CONCURRENCY);
  const endpoint = process.env.INGEST_ENDPOINT;
  const existingPrices = endpoint ? await loadExistingPriceState(endpoint) : new Map();
  const priceCollectionLimiter = createPriceCollectionLimiter(process.env.EVENT_PRICE_COLLECTION_LIMIT);
  let nextIndex = 0;
  let completed = 0;

  console.log(`Discovered ${urls.length} candidate URLs; processing ${concurrency} at a time.`);

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
        if (!hasBuyTicketsButton(html)) {
          skipped.push({ url, reason: "No Buy Tickets button found." });
          continue;
        }

        const event = parseEventPage(normalizeEventPageUrl(url), html);

        if (!event) {
          skipped.push({ url, reason: "No event date payload found." });
          continue;
        }

        const priceCollection = await collectTicketPrices(
          event,
          existingPrices.get(event.eventPageUrl),
          priceCollectionLimiter
        );
        events.push({ ...event, ...priceCollection });
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        skipped.push({ url, reason });
        console.warn(`Skipped ${url}: ${reason}`);
      } finally {
        completed += 1;
        console.log(`Processed ${completed}/${urls.length}: ${url}`);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  if (!events.length) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          discovered: urls.length,
          parsed: 0,
          skipped: skipped.length,
          sampleSkipped: skipped.slice(0, 10),
        },
        null,
        2
      )
    );
    return;
  }

  if (!endpoint) {
    console.log(JSON.stringify(events, null, 2));
    return;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...ingestRequestHeaders(),
    },
    body: JSON.stringify(events),
  });
  const responseText = await response.text();
  const payload = (() => {
    try {
      return JSON.parse(responseText);
    } catch {
      return null;
    }
  })();

  if (!response.ok || !payload || typeof payload !== "object" || payload.ok !== true) {
    throw new Error(
      payload?.error ??
        `Ingest API returned an invalid response (${response.status}): ${responseText.slice(0, 200)}`
    );
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        discovered: urls.length,
        parsed: events.length,
        skipped: skipped.length,
        ingest: payload,
        sampleEvents: events.slice(0, 5).map((event) => ({
          eventPageUrl: event.eventPageUrl,
          infoBannerFirst: event.infoBannerFirst,
          eventStartDate: event.eventStartDate,
          eventEndDate: event.eventEndDate,
          destination: event.destination,
          ticketBookingUrl: event.ticketBookingUrl,
          ticketCampaignCode: event.ticketCampaignCode,
          ticketPriceStatus: event.ticketPriceStatus,
          ticketPricesCollectedAt: event.ticketPricesCollectedAt,
          ticketPriceError: event.ticketPriceError,
        })),
        sampleSkipped: skipped.slice(0, 10),
      },
      null,
      2
    )
  );
}

function normalizeConcurrency(value) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) ? Math.min(Math.max(parsed, 1), 5) : 1;
}

function createPriceCollectionLimiter(value) {
  const parsed = Number.parseInt(value ?? "", 10);
  const limit = Number.isInteger(parsed) ? Math.max(parsed, 0) : 5;
  let attempts = 0;

  return {
    limit,
    get attempts() {
      return attempts;
    },
    tryReserve(eventPageUrl) {
      if (limit === 0) {
        console.log(`Ticket pricing collection disabled; leaving ${eventPageUrl} not configured.`);
        return false;
      }

      if (attempts >= limit) {
        console.log(
          `Ticket pricing collection limit reached (${limit}); leaving ${eventPageUrl} not configured.`
        );
        return false;
      }

      attempts += 1;
      console.log(`Collecting ticket pricing ${attempts}/${limit}: ${eventPageUrl}`);
      return true;
    },
  };
}

async function loadExistingPriceState(endpoint) {
  const response = await fetch(endpoint, {
    headers: ingestRequestHeaders(),
  });

  if (!response.ok) {
    console.warn(`Unable to load existing event pricing state: HTTP ${response.status}`);
    return new Map();
  }

  const payload = await response.json().catch(() => null);
  const rows = Array.isArray(payload?.events) ? payload.events : [];
  const state = new Map();

  for (const row of rows) {
    if (typeof row.event_page_url !== "string") {
      continue;
    }

    state.set(row.event_page_url, {
      ticketBookingUrl: firstString(row.ticket_booking_url),
      ticketPriceStatus: firstString(row.ticket_price_status) ?? "not_configured",
      ticketPricesJson: firstString(row.ticket_prices_json),
      ticketPricesCollectedAt: firstString(row.ticket_prices_collected_at),
      ticketPriceError: firstString(row.ticket_price_error),
    });
  }

  console.log(`Loaded existing pricing state for ${state.size} events.`);
  return state;
}

function ingestRequestHeaders() {
  return {
    ...(process.env.ADMIN_INGEST_TOKEN
      ? { Authorization: `Bearer ${process.env.ADMIN_INGEST_TOKEN}` }
      : {}),
    ...(process.env.OAI_SITES_AUTHORIZATION
      ? { "OAI-Sites-Authorization": process.env.OAI_SITES_AUTHORIZATION }
      : {}),
  };
}

async function discoverCandidateUrls() {
  const explicitUrls = (process.env.EVENT_URLS ?? "")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean)
    .map(normalizeEventPageUrl)
    .filter(isCandidateEventUrl);

  if (explicitUrls.length) {
    return [...new Set(explicitUrls)];
  }

  if (process.env.SEARCH_PROVIDER_ENDPOINT) {
    const response = await fetch(process.env.SEARCH_PROVIDER_ENDPOINT, {
      headers: {
        ...(process.env.ADMIN_INGEST_TOKEN
          ? { Authorization: `Bearer ${process.env.ADMIN_INGEST_TOKEN}` }
          : {}),
        ...(process.env.OAI_SITES_AUTHORIZATION
          ? { "OAI-Sites-Authorization": process.env.OAI_SITES_AUTHORIZATION }
          : {}),
      },
    });
    if (!response.ok) {
      throw new Error(`Search provider returned ${response.status}`);
    }
    const payload = await response.json();
    const links = (payload.items ?? payload.results ?? [])
      .map((item) => item.link ?? item.url)
      .filter((url) => typeof url === "string" && url.startsWith("https://disneyevent.com/"))
      .map(normalizeEventPageUrl)
      .filter(isCandidateEventUrl);
    return [...new Set(links)];
  }

  throw new Error("Set EVENT_URLS or SEARCH_PROVIDER_ENDPOINT. Don't scrape Google HTML results.");
}

function parseEventPage(url, html) {
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
      ticketBookingUrl: null,
      ticketCampaignCode: null,
      ticketPriceStatus: "not_configured",
      ticketPricesJson: null,
      ticketPricesCollectedAt: null,
      ticketPriceError: null,
      excluded: true,
    };
  }

  const infoBannerFirst = $("h3.info-banner--first-inline").first().text().trim();
  const infoBannerSecond = $("h3.info-banner--second-inline").first().text().trim();

  if (!infoBannerFirst || !infoBannerSecond) {
    return parseNextEventPage($, url, html);
  }

  const [eventStartDate, eventEndDate] = parseDateRange(infoBannerSecond);
  const destination = classifyDestination(`${html}\n${infoBannerFirst}\n${infoBannerSecond}`);
  const ticketBookingUrl = extractTicketBookingUrl(html);

  return {
    eventPageUrl: url,
    infoBannerFirst,
    infoBannerSecond,
    eventStartDate,
    eventEndDate,
    validStartDate: addDays(eventStartDate, -7),
    validEndDate: addDays(eventEndDate, 7),
    destination,
    ticketBookingUrl,
    ticketCampaignCode: extractTicketCampaignCode(ticketBookingUrl),
    ticketPriceStatus: "not_configured",
    ticketPricesJson: null,
    ticketPricesCollectedAt: null,
    ticketPriceError: null,
    excluded: destination !== "disney_world",
  };
}

function hasBuyTicketsButton(html) {
  return /Buy Tickets/i.test(html);
}

function parseNextEventPage($, url, html) {
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
  const ticketBookingUrl = extractTicketBookingUrl(payload) ?? extractTicketBookingUrl(html);

  return {
    eventPageUrl: url,
    infoBannerFirst,
    infoBannerSecond,
    eventStartDate,
    eventEndDate,
    validStartDate: addDays(eventStartDate, -7),
    validEndDate: addDays(eventEndDate, 7),
    destination,
    ticketBookingUrl,
    ticketCampaignCode: extractTicketCampaignCode(ticketBookingUrl),
    ticketPriceStatus: "not_configured",
    ticketPricesJson: null,
    ticketPricesCollectedAt: null,
    ticketPriceError: null,
    excluded: destination !== "disney_world",
  };
}

function extractTicketBookingUrl(text) {
  const decoded = decodeEscapedValue(text);
  const match = decoded.match(
    /https:\/\/disneyworld\.disney\.go\.com\/reservations\/[^"'\\\s<]+/i
  );

  if (!match) {
    return null;
  }

  const value = match[0].replace(/\\u0026/gi, "&").replace(/\\\//g, "/");
  return URL.canParse(value) ? value : null;
}

function extractTicketCampaignCode(ticketBookingUrl) {
  if (!ticketBookingUrl) {
    return null;
  }

  const url = new URL(ticketBookingUrl);
  return url.searchParams.get("CMP") ?? url.searchParams.get("cmp");
}

async function collectTicketPrices(event, existingPriceState, priceCollectionLimiter) {
  const endpoint = process.env.TICKET_PRICE_COLLECTOR_ENDPOINT;
  const browserlessToken = process.env.BROWSERLESS_API_TOKEN;

  if ((!endpoint && !browserlessToken) || !event.ticketBookingUrl) {
    return emptyPriceCollection("not_configured");
  }

  const reusablePriceCollection = getReusablePriceCollection(
    event,
    existingPriceState,
    isEnabled(process.env.FORCE_TICKET_PRICE_REFRESH)
  );
  if (reusablePriceCollection) {
    return reusablePriceCollection;
  }

  if (!priceCollectionLimiter.tryReserve(event.eventPageUrl)) {
    return emptyPriceCollection("not_configured");
  }

  try {
    const collectorInput = {
      eventPageUrl: event.eventPageUrl,
      eventName: event.infoBannerFirst,
      eventStartDate: event.eventStartDate,
      eventEndDate: event.eventEndDate,
      validStartDate: event.validStartDate,
      validEndDate: event.validEndDate,
      ticketBookingUrl: event.ticketBookingUrl,
      ticketCampaignCode: event.ticketCampaignCode,
    };
    const payload = endpoint
      ? await collectFromEndpoint(endpoint, collectorInput)
      : await collectBrowserlessTicketPrices(collectorInput, browserlessToken);

    const rawPrices = Array.isArray(payload?.prices)
      ? payload.prices
      : Array.isArray(payload?.products)
        ? payload.products
        : null;

    if (!rawPrices) {
      throw new Error("Price collector response must include a prices array.");
    }

    const prices = rawPrices.map(normalizeTicketPrice);
    const collectedAt =
      typeof payload.collectedAt === "string" && !Number.isNaN(Date.parse(payload.collectedAt))
        ? new Date(payload.collectedAt).toISOString()
        : new Date().toISOString();

    return {
      ticketPriceStatus: prices.length ? "collected" : "empty",
      ticketPricesJson: JSON.stringify({
        sourceUrl: payload.sourceUrl ?? event.ticketBookingUrl,
        campaignCode: event.ticketCampaignCode,
        prices,
      }),
      ticketPricesCollectedAt: collectedAt,
      ticketPriceError: null,
    };
  } catch (error) {
    return {
      ticketPriceStatus: "failed",
      ticketPricesJson: null,
      ticketPricesCollectedAt: new Date().toISOString(),
      ticketPriceError: String(error instanceof Error ? error.message : error).slice(0, 2000),
    };
  }
}

function getReusablePriceCollection(event, existingPriceState, forceRefresh = false) {
  if (!existingPriceState || existingPriceState.ticketBookingUrl !== event.ticketBookingUrl) {
    return null;
  }

  const status = existingPriceState.ticketPriceStatus;
  const collectedAt = existingPriceState.ticketPricesCollectedAt;

  if (forceRefresh) {
    console.log(`Force-refreshing ticket pricing for ${event.eventPageUrl}`);
    return null;
  }

  if ((status === "collected" || status === "empty") && isWithinDays(collectedAt, 14)) {
    console.log(`Reusing ${status} ticket pricing for ${event.eventPageUrl}`);
    return {
      ticketPriceStatus: status,
      ticketPricesJson: existingPriceState.ticketPricesJson,
      ticketPricesCollectedAt: collectedAt,
      ticketPriceError: existingPriceState.ticketPriceError,
    };
  }

  if (status === "failed" && isWithinDays(collectedAt, 7)) {
    console.log(`Skipping recent failed ticket pricing attempt for ${event.eventPageUrl}`);
    return {
      ticketPriceStatus: status,
      ticketPricesJson: existingPriceState.ticketPricesJson,
      ticketPricesCollectedAt: collectedAt,
      ticketPriceError: existingPriceState.ticketPriceError,
    };
  }

  return null;
}

function isEnabled(value) {
  return /^(1|true|yes|on)$/i.test(String(value ?? "").trim());
}

function isWithinDays(value, days) {
  if (!value) {
    return false;
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return false;
  }

  return Date.now() - timestamp < days * 24 * 60 * 60 * 1000;
}

function normalizeTicketPrice(value, index) {
  if (!value || typeof value !== "object") {
    throw new Error(`Price row ${index + 1} is not an object.`);
  }

  const productName = firstString(value.productName, value.name, value.ticketType);
  const cents = Number(value.priceCents);
  const dollars = Number(value.price);
  const priceCents =
    Number.isInteger(cents) && cents >= 0
      ? cents
      : Number.isFinite(dollars) && dollars >= 0
        ? Math.round(dollars * 100)
        : null;

  if (!productName || priceCents === null) {
    throw new Error(`Price row ${index + 1} must include productName and priceCents.`);
  }

  return {
    productName,
    priceCents,
    currency: firstString(value.currency)?.toUpperCase() ?? "USD",
    priceBasis: normalizePriceBasis(value.priceBasis),
    ticketDays: positiveInteger(value.ticketDays),
    park: firstString(value.park),
    parkHopper: optionalBoolean(value.parkHopper),
    ageBand: firstString(value.ageBand),
    validDate: firstString(value.validDate),
    details: firstString(value.details, value.description, value.restrictions),
  };
}

async function collectFromEndpoint(endpoint, event) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.TICKET_PRICE_COLLECTOR_TOKEN
        ? { Authorization: `Bearer ${process.env.TICKET_PRICE_COLLECTOR_TOKEN}` }
        : {}),
    },
    body: JSON.stringify(event),
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      payload?.error ?? payload?.message ?? `Price collector returned HTTP ${response.status}.`
    );
  }

  return payload;
}

function normalizePriceBasis(value) {
  return value === "per_day" || value === "per_ticket" ? value : "from";
}

function emptyPriceCollection(ticketPriceStatus) {
  return {
    ticketPriceStatus,
    ticketPricesJson: null,
    ticketPricesCollectedAt: null,
    ticketPriceError: null,
  };
}

function firstString(...values) {
  return values.find((value) => typeof value === "string" && value.trim())?.trim() ?? null;
}

function positiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function optionalBoolean(value) {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === 1) return true;
  if (value === "false" || value === 0) return false;
  return null;
}

function classifyDestination(text) {
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

function countMarkers(text, markers) {
  return markers.reduce((count, marker) => count + (text.includes(marker) ? 1 : 0), 0);
}

function parseDateRange(text) {
  const normalized = text
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/\./g, "")
    .trim();
  const month = "(January|February|March|April|May|June|July|August|September|Sept|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)";

  let match = normalized.match(new RegExp(`${month}\\s+(\\d{1,2}),?\\s+(\\d{4})\\s*-\\s*${month}\\s+(\\d{1,2}),?\\s+(\\d{4})`, "i"));
  if (match) {
    return [iso(match[1], match[2], match[3]), iso(match[4], match[5], match[6])];
  }

  match = normalized.match(new RegExp(`${month}\\s+(\\d{1,2})\\s*-\\s*(\\d{1,2}),?\\s+(\\d{4})`, "i"));
  if (match) {
    return [iso(match[1], match[2], match[4]), iso(match[1], match[3], match[4])];
  }

  match = normalized.match(new RegExp(`${month}\\s+(\\d{1,2})\\s*-\\s*${month}\\s+(\\d{1,2}),?\\s+(\\d{4})`, "i"));
  if (match) {
    return [iso(match[1], match[2], match[5]), iso(match[3], match[4], match[5])];
  }

  match = normalized.match(new RegExp(`${month}\\s+(\\d{1,2}),?\\s+(\\d{4})`, "i"));
  if (match) {
    const single = iso(match[1], match[2], match[3]);
    return [single, single];
  }

  throw new Error(`Unable to parse event date range: ${text}`);
}

function iso(monthName, day, year) {
  const monthIndex = MONTHS.get(monthName.toLowerCase());
  if (monthIndex === undefined) {
    throw new Error(`Unknown month ${monthName}`);
  }

  return new Date(Date.UTC(Number(year), monthIndex, Number(day))).toISOString().slice(0, 10);
}

function addDays(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function isoFromTimestamp(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Unable to parse timestamp: ${value}`);
  }

  return date.toISOString().slice(0, 10);
}

function formatDateRange(startIso, endIso) {
  const start = formatDisplayDate(startIso);
  const end = formatDisplayDate(endIso);

  return start === end ? start : `${start} - ${end}`;
}

function formatDisplayDate(isoDate) {
  const date = new Date(`${isoDate}T00:00:00.000Z`);

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function decodeEscapedValue(value) {
  try {
    return JSON.parse(`"${value}"`);
  } catch {
    return value.replace(/\\u0026/g, "&").replace(/\\"/g, "\"").replace(/\\\\/g, "\\");
  }
}

function extractNextDateField(text, field) {
  const value = extractNextStringField(text, field);

  if (!value) {
    return null;
  }

  return value.startsWith("$D") ? value.slice(2) : value;
}

function extractNextFlightText(html) {
  const pattern = /self\.__next_f\.push\(\[1,"((?:\\.|[^"\\])*)"\]\)<\/script>/g;
  let match;
  let payload = "";

  while ((match = pattern.exec(html))) {
    payload += decodeEscapedValue(match[1]);
  }

  return payload;
}

function extractNextEventName(text) {
  return (
    extractNearestFieldBefore(text, `\\"eventStart\\":\\"`, `\\"name\\":\\"`, `\\"`) ??
    extractNearestFieldBefore(text, `"eventStart":"`, `"name":"`, `"`)
  );
}

function extractNextStringField(text, field) {
  return (
    extractDelimitedField(text, `\\"${field}\\":\\"`, `\\"`) ??
    extractDelimitedField(text, `"${field}":"`, `"`)
  );
}

function extractDelimitedField(text, prefix, suffix) {
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

function extractNearestFieldBefore(text, marker, prefix, suffix) {
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

function normalizeEventPageUrl(value) {
  const url = new URL(value);

  url.hash = "";

  for (const key of [...url.searchParams.keys()]) {
    if (key.startsWith("utm_") || key === "mc_cid" || key === "mc_eid") {
      url.searchParams.delete(key);
    }
  }

  return url.toString();
}

function isCandidateEventUrl(value) {
  const url = new URL(value);

  return url.hostname === "disneyevent.com" && !url.pathname.endsWith("/know-before-you-go");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

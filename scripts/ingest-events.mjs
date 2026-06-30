import { load } from "cheerio";

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

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "SecretMouseSaversBot/0.1 authorized event indexing contact=hello@secretmousesavers.com",
        },
      });

      if (!response.ok) {
        console.warn(`Skipped ${url}: ${response.status}`);
        continue;
      }

      const html = await response.text();
      events.push(parseEventPage(url, html));
    } catch (error) {
      console.warn(`Skipped ${url}: ${error instanceof Error ? error.message : error}`);
    }
  }

  if (!events.length) {
    console.log("No candidate events were parsed.");
    return;
  }

  const endpoint = process.env.INGEST_ENDPOINT;
  if (!endpoint) {
    console.log(JSON.stringify(events, null, 2));
    return;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.ADMIN_INGEST_TOKEN
        ? { Authorization: `Bearer ${process.env.ADMIN_INGEST_TOKEN}` }
        : {}),
    },
    body: JSON.stringify(events),
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error ?? `Ingest API returned ${response.status}`);
  }

  console.log(payload);
}

async function discoverCandidateUrls() {
  const explicitUrls = (process.env.EVENT_URLS ?? "")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);

  if (explicitUrls.length) {
    return [...new Set(explicitUrls)];
  }

  if (process.env.SEARCH_PROVIDER_ENDPOINT) {
    const response = await fetch(process.env.SEARCH_PROVIDER_ENDPOINT);
    if (!response.ok) {
      throw new Error(`Search provider returned ${response.status}`);
    }
    const payload = await response.json();
    const links = (payload.items ?? payload.results ?? [])
      .map((item) => item.link ?? item.url)
      .filter((url) => typeof url === "string" && url.startsWith("https://disneyevent.com/"));
    return [...new Set(links)];
  }

  throw new Error("Set EVENT_URLS or SEARCH_PROVIDER_ENDPOINT. Do not scrape Google HTML results.");
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
      hotelSpecialRateAvailable: false,
      excluded: true,
    };
  }

  const infoBannerFirst = $("h3.info-banner--first-inline").first().text().trim();
  const infoBannerSecond = $("h3.info-banner--second-inline").first().text().trim();

  if (!infoBannerFirst || !infoBannerSecond) {
    throw new Error("Required event banner fields were missing.");
  }

  const [eventStartDate, eventEndDate] = parseDateRange(infoBannerSecond);
  const roomButton = $("button.btn.btn-primary.btn-rooms, a.btn.btn-primary.btn-rooms").first();
  const hotelBookingUrl = resolveHotelTarget($, roomButton, url);

  return {
    eventPageUrl: url,
    infoBannerFirst,
    infoBannerSecond,
    eventStartDate,
    eventEndDate,
    validStartDate: addDays(eventStartDate, -7),
    validEndDate: addDays(eventEndDate, 7),
    hotelSpecialRateAvailable: Boolean(roomButton.length),
    hotelName: null,
    hotelBookingUrl,
  };
}

function resolveHotelTarget($, button, pageUrl) {
  if (!button.length) {
    return null;
  }

  const href =
    button.attr("href") ??
    button.attr("data-href") ??
    button.attr("data-url") ??
    button.closest("form").attr("action");

  if (!href) {
    return pageUrl;
  }

  return new URL(href, pageUrl).toString();
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

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

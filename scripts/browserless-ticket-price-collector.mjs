import puppeteer from "puppeteer-core";

const BROWSERLESS_HOST =
  process.env.BROWSERLESS_HOST ?? "https://production-sfo.browserless.io";
const SESSION_TIMEOUT_MS = 120_000;
const BQL_REQUEST_TIMEOUT_MS = 90_000;
const COLLECTION_TIMEOUT_MS = 180_000;

export async function collectBrowserlessTicketPrices(event, token) {
  if (!token || !event?.eventPageUrl) {
    throw new Error("Browserless price collection requires a token and event page URL.");
  }

  let browser;
  let timeoutId;

  const collection = (async () => {
    const browserWSEndpoint = await openReferralSession(event.eventPageUrl, token);
    browser = await puppeteer.connect({
      browserWSEndpoint: appendToken(browserWSEndpoint, token),
      protocolTimeout: SESSION_TIMEOUT_MS,
    });

    try {
      const networkOffers = attachNetworkOfferCollector(browser);
      const referralPage = await findPage(browser, (page) =>
        page.url().includes("disneyworld.disney.go.com/reservations/")
      );

      if (!referralPage) {
        throw new Error("Disney ticket page did not open from the event referral.");
      }

      await clickContinue(referralPage, browser);
      const admissionPage = await waitForAdmissionPage(browser);
      await clickTicketSelection(admissionPage);
      const ticketPage = await waitForTicketPage(browser);
      const offers = await extractOfferMenu(ticketPage, networkOffers);

      return {
        collectedAt: new Date().toISOString(),
        sourceUrl: ticketPage.url(),
        prices: offers,
      };
    } finally {
      await browser?.close().catch(() => undefined);
    }
  })();

  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(async () => {
      await browser?.close().catch(() => undefined);
      reject(new Error("Browserless ticket price collection timed out."));
    }, COLLECTION_TIMEOUT_MS);
  });

  try {
    return await Promise.race([collection, timeout]);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function openReferralSession(eventPageUrl, token) {
  const endpoint = new URL("/stealth/bql", BROWSERLESS_HOST);
  endpoint.searchParams.set("token", token);
  endpoint.searchParams.set("humanlike", "true");
  endpoint.searchParams.set("timeout", String(SESSION_TIMEOUT_MS));

  const query = `
    mutation OpenTicketReferral($eventUrl: String!) {
      event: goto(url: $eventUrl, waitUntil: networkIdle, timeout: 15000) {
        status
      }
      ticketLink: waitForSelector(
        selector: "a[href*='disneyworld.disney.go.com/reservations/']"
        visible: true
        timeout: 10000
      ) {
        time
      }
      sameTab: evaluate(content: """
        const link = document.querySelector(
          "a[href*='disneyworld.disney.go.com/reservations/']"
        );
        if (!link) throw new Error("Ticket link missing");
        link.target = "_self";
        return link.href;
      """) {
        value
      }
      openDisney: click(
        selector: "a[href*='disneyworld.disney.go.com/reservations/']"
        visible: true
        timeout: 10000
      ) {
        time
      }
      disneyReady: waitForTimeout(time: 5000) {
        time
      }
      reconnect(timeout: 10000) {
        browserWSEndpoint
      }
    }
  `;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BQL_REQUEST_TIMEOUT_MS);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: controller.signal,
    body: JSON.stringify({
      query,
      variables: { eventUrl: eventPageUrl },
      operationName: "OpenTicketReferral",
    }),
  }).catch((error) => {
    if (error?.name === "AbortError") {
      throw new Error("Browserless referral session timed out.");
    }
    throw error;
  }).finally(() => clearTimeout(timeout));
  const responseText = await response.text();
  const payload = (() => {
    try {
      return JSON.parse(responseText);
    } catch {
      return null;
    }
  })();

  if (!response.ok || payload?.errors?.length) {
    throw new Error(
      payload?.errors?.[0]?.message ??
        `Browserless referral session returned HTTP ${response.status}: ${
          payload ? JSON.stringify(payload) : responseText.slice(0, 500)
        }`
    );
  }

  const value = payload?.data?.reconnect?.browserWSEndpoint;
  if (typeof value !== "string" || !value) {
    throw new Error("Browserless did not return a reconnect endpoint.");
  }

  return value;
}

async function clickContinue(page, browser) {
  const popupPromise = browser
    .waitForTarget(
      (target) =>
        target.type() === "page" &&
        target.url().includes("disneyworld.disney.go.com/reservations/"),
      { timeout: 12_000 }
    )
    .catch(() => null);

  for (const frame of page.frames()) {
    const clicked = await frame
      .evaluate(() => {
        const controls = [
          ...document.querySelectorAll("button, a, input[type='button'], input[type='submit']"),
        ];
        const control = controls.find((element) => {
          const text = (
            element.textContent ||
            element.getAttribute("aria-label") ||
            element.value ||
            ""
          )
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();
          return text === "continue" || text.startsWith("continue ");
        });

        if (!control) return false;
        control.click();
        return true;
      })
      .catch(() => false);

    if (clicked) {
      await popupPromise;
      return;
    }
  }

  throw new Error("Disney Continue button was not found.");
}

async function waitForAdmissionPage(browser) {
  const deadline = Date.now() + 25_000;

  while (Date.now() < deadline) {
    const pages = await browser.pages();
    for (const page of pages) {
      const state = await getPageState(page);
      if (
        state.url.includes("/admission") ||
        (state.text.includes("Select Tickets") && state.text.includes("$")) ||
        (state.text.includes("Theme Park Ticket") && state.text.includes("$"))
      ) {
        await page.bringToFront().catch(() => undefined);
        await page.waitForNetworkIdle({ idleTime: 800, timeout: 8_000 }).catch(() => undefined);
        return page;
      }
    }
    await sleep(750);
  }

  const states = await Promise.all((await browser.pages()).map(getPageState));
  throw new Error(
    `Disney admission catalog did not load. Last pages: ${states
      .map((state) => state.url)
      .join(", ")}`
  );
}

async function clickTicketSelection(page) {
  const deadline = Date.now() + 25_000;
  const originalUrl = page.url();

  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      const clicked = await frame
        .evaluate(() => {
          const controls = [
            ...document.querySelectorAll("button, a, input[type='button'], input[type='submit']"),
          ];
          const control = controls.find((element) => {
            const text = (
              element.textContent ||
              element.getAttribute("aria-label") ||
              element.value ||
              ""
            )
              .replace(/\s+/g, " ")
              .trim()
              .toLowerCase();
            return (
              text === "select tickets" ||
              text.startsWith("select tickets ") ||
              text === "add tickets" ||
              text.startsWith("add tickets ")
            );
          });

          if (!control) return false;
          if (control.href && /\/admission\/tickets\/?/.test(control.href)) {
            window.location.assign(control.href);
            return true;
          }
          control.click();
          return true;
        })
        .catch(() => false);

      if (clicked) {
        await sleep(3_000);
        if (!page.url().includes("/admission/tickets")) {
          await openTicketSelectionPage(page, originalUrl);
        }
        return;
      }
    }

    await sleep(750);
  }

  await openTicketSelectionPage(page, originalUrl);
}

async function openTicketSelectionPage(page, fallbackUrl) {
  const currentUrl = page.url() || fallbackUrl;
  const ticketUrl = buildTicketSelectionUrl(currentUrl);
  if (!ticketUrl) {
    const state = await getPageState(page);
    throw new Error(
      `Disney Select Tickets button was not found. Page: ${state.url}; visible text: ${state.text.slice(
        0,
        350
      )}`
    );
  }

  await page.goto(ticketUrl, { waitUntil: "domcontentloaded", timeout: 25_000 }).catch(() => {
    // waitForTicketPage will report the last loaded Disney pages if this fallback does not land.
  });
  await page.waitForNetworkIdle({ idleTime: 1_000, timeout: 12_000 }).catch(() => undefined);
}

function buildTicketSelectionUrl(value) {
  try {
    const url = new URL(value);
    if (!url.hostname.includes("disneyworld.disney.go.com")) {
      return null;
    }

    url.hash = "";
    url.search = "";
    url.pathname = url.pathname.replace(/\/+$/, "");
    if (url.pathname.endsWith("/admission/tickets")) {
      return `${url.origin}${url.pathname}/`;
    }
    if (url.pathname.endsWith("/admission")) {
      return `${url.origin}${url.pathname}/tickets/`;
    }
    return null;
  } catch {
    return null;
  }
}

async function waitForTicketPage(browser) {
  const deadline = Date.now() + 35_000;

  while (Date.now() < deadline) {
    const pages = await browser.pages();
    for (const page of pages) {
      const state = await getPageState(page);
      if (
        state.url.includes("/admission/tickets") ||
        (state.text.includes("Theme Park Ticket") && state.text.includes("$")) ||
        (state.text.includes("1-Day") && state.text.includes("$"))
      ) {
        await page.bringToFront().catch(() => undefined);
        await page.waitForNetworkIdle({ idleTime: 1_000, timeout: 12_000 }).catch(() => undefined);
        return page;
      }
    }
    await sleep(750);
  }

  const states = await Promise.all((await browser.pages()).map(getPageState));
  throw new Error(
    `Disney ticket pricing page did not load. Last pages: ${states
      .map((state) => state.url)
      .join(", ")}`
  );
}

function attachNetworkOfferCollector(browser) {
  const payloads = [];
  const seenResponses = new Set();
  const interestingUrls = [];
  const cachedOffers = [];
  const seenOfferKeys = new Set();
  let parsedPayloadIndex = 0;
  let parsedPayloadCount = 0;
  let priceLikeValueCount = 0;
  let textPriceSnippetCount = 0;
  const pageDiagnostics = {
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
  };

  const parseResponse = async (response) => {
    const url = response.url();
    if (seenResponses.has(url) || !isPotentialTicketDataUrl(url)) {
      return;
    }
    seenResponses.add(url);

    const headers = response.headers();
    const contentType = headers["content-type"] || "";
    if (!/(json|javascript|text|html)/i.test(contentType) && !isLikelyTicketDataUrl(url)) {
      return;
    }

    try {
      const text = await response.text();
      if (!text || text.length > 2_000_000 || !containsPriceOrTicketSignal(text)) {
        return;
      }

      interestingUrls.push(url);
      payloads.push(text);
    } catch {
      // Some streaming/opaque responses can't be read after the browser consumes them.
    }
  };

  const attachPage = (page) => {
    page.on("console", (message) => {
      if (!["error", "warning"].includes(message.type())) return;
      const text = normalizeText(message.text()).slice(0, 240);
      if (text && !pageDiagnostics.consoleErrors.includes(text)) {
        pageDiagnostics.consoleErrors.push(text);
      }
    });
    page.on("pageerror", (error) => {
      const text = normalizeText(error?.message || String(error)).slice(0, 240);
      if (text && !pageDiagnostics.pageErrors.includes(text)) {
        pageDiagnostics.pageErrors.push(text);
      }
    });
    page.on("requestfailed", (request) => {
      const failure = request.failure()?.errorText || "request failed";
      const text = `${failure}: ${request.url()}`.slice(0, 300);
      if (!pageDiagnostics.failedRequests.includes(text)) {
        pageDiagnostics.failedRequests.push(text);
      }
    });
    page.on("response", (response) => {
      void parseResponse(response);
    });
  };

  browser.pages().then((pages) => pages.forEach(attachPage)).catch(() => undefined);
  browser.on("targetcreated", async (target) => {
    if (target.type() !== "page") return;
    const page = await target.page().catch(() => null);
    if (page) attachPage(page);
  });

  return {
    getOffers() {
      while (parsedPayloadIndex < payloads.length) {
        const payload = payloads[parsedPayloadIndex];
        parsedPayloadIndex += 1;
        textPriceSnippetCount += countDollarPriceSnippets(payload);
        for (const offer of extractOffersFromSourceText(payload)) {
          const key = `${offer.productName.toLowerCase()}|${offer.price}`;
          if (seenOfferKeys.has(key)) continue;
          seenOfferKeys.add(key);
          cachedOffers.push(offer);
        }

        const result = extractOffersFromPageData({
          scripts: [payload],
          bodyText: payload.length <= 250_000 ? payload : extractPriceWindows(payload).join(" "),
        });
        parsedPayloadCount += result.payloadCount;
        priceLikeValueCount += result.priceLikeValues;
        for (const offer of result.offers) {
          const key = `${offer.productName.toLowerCase()}|${offer.price}`;
          if (seenOfferKeys.has(key)) continue;
          seenOfferKeys.add(key);
          cachedOffers.push(offer);
        }
      }

      let summary = `Captured ${payloads.length} candidate network payloads.`;
      summary = `${summary} Parsed ${parsedPayloadCount} payloads, found ${priceLikeValueCount} structured price-like values, and saw ${textPriceSnippetCount} dollar-price snippets.`;
      if (pageDiagnostics.consoleErrors.length) {
        summary = `${summary} Console: ${pageDiagnostics.consoleErrors.slice(0, 4).join(" || ")}`;
      }
      if (pageDiagnostics.pageErrors.length) {
        summary = `${summary} Page errors: ${pageDiagnostics.pageErrors.slice(0, 4).join(" || ")}`;
      }
      if (pageDiagnostics.failedRequests.length) {
        summary = `${summary} Failed requests: ${pageDiagnostics.failedRequests.slice(0, 4).join(" || ")}`;
      }
      if (interestingUrls.length) {
        summary = `${summary} Candidate URLs: ${interestingUrls.slice(0, 5).join(", ")}`;
      }

      return { offers: cachedOffers.sort(compareTicketOffers).slice(0, 12), summary };
    },
  };
}

function isPotentialTicketDataUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (!/disney|go\.com|registerdisney/i.test(url.hostname)) {
    return false;
  }

  return isLikelyTicketDataUrl(value) || /\.(json|js)(?:$|\?)/i.test(url.pathname);
}

function isLikelyTicketDataUrl(value) {
  return /(admission|ticket|product|price|offer|cart|reservation|commerce|availability|entitlement|inventory|catalog|api|graphql|bolt)/i.test(
    value
  );
}

function containsPriceOrTicketSignal(value) {
  return /\$|price|amount|ticket|admission|park|offer|product|catalog/i.test(value);
}

async function extractOfferMenu(page, networkOffers) {
  const deadline = Date.now() + 15_000;
  let lastFrameSummary = "";
  let lastDataSummary = "";

  while (Date.now() < deadline) {
    const networkResult = networkOffers?.getOffers();
    if (networkResult?.offers.length) {
      return networkResult.offers;
    }

    for (const frame of page.frames()) {
      const frameText = await frame
        .evaluate(() => (document.body?.innerText || "").replace(/\s+/g, " ").trim())
        .catch(() => "");

      const offers = frameText.includes("$") ? await extractRenderedOffers(frame) : [];
      if (offers.length) {
        return offers;
      }

      const dataResult = await frame
        .evaluate(() => {
          const scripts = [...document.scripts].map((script) => script.textContent || "");
          const bodyText = document.body?.innerText || "";
          return { scripts, bodyText };
        })
        .catch(() => null);
      if (dataResult) {
        const parsedOffers = extractOffersFromPageData(dataResult);
        lastDataSummary = parsedOffers.summary;
        if (parsedOffers.offers.length) {
          return parsedOffers.offers;
        }
      }
    }

    lastFrameSummary = (
      await Promise.all(
        page.frames().map((frame) =>
          frame
            .evaluate(() => (document.body?.innerText || "").replace(/\s+/g, " ").slice(0, 500))
            .catch(() => "")
        )
      )
    )
      .filter(Boolean)
      .join(" | ");
    await sleep(750);
  }

  const networkResult = networkOffers?.getOffers();
  if (networkResult) {
    lastDataSummary = `${lastDataSummary} ${networkResult.summary}`.trim();
    if (networkResult.offers.length) {
      return networkResult.offers;
    }
  }

  throw new Error(
    `Disney admission catalog loaded, but no offer prices were found. Visible page text: ${lastFrameSummary.slice(
      0,
      350
    )} ${lastDataSummary}`
  );
}

async function extractRenderedOffers(frame) {
  return frame.evaluate(() => {
    const normalize = (value) => value.replace(/\s+/g, " ").trim();
    const pricePattern = /\$\s?(\d{1,4}(?:,\d{3})*(?:\.\d{2})?)/;
    const candidates = [
      ...document.querySelectorAll(
        "article, li, [role='listitem'], [class*='card'], [class*='product'], [class*='ticket']"
      ),
    ];
    const rows = [];
    const seen = new Set();

    for (const element of candidates) {
      const text = normalize(element.innerText || "");
      const priceMatch = text.match(pricePattern);
      if (!priceMatch || text.length < 15 || text.length > 1800) continue;

      const heading = element.querySelector("h1,h2,h3,h4,h5,h6,[role='heading']");
      const productName = normalize(heading?.textContent || text.split(/\$|From /i)[0] || "");
      if (!productName || productName.length > 180) continue;

      const key = `${productName.toLowerCase()}|${priceMatch[1]}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const lower = text.toLowerCase();
      rows.push({
        productName,
        price: Number(priceMatch[1].replace(/,/g, "")),
        currency: "USD",
        priceBasis: lower.includes("per day")
          ? "per_day"
          : lower.includes("per ticket")
            ? "per_ticket"
            : "from",
        ticketDays:
          Number(text.match(/\b(\d{1,2})-day\b/i)?.[1] || text.match(/\b(\d{1,2}) day\b/i)?.[1]) ||
          null,
        park: null,
        parkHopper: lower.includes("park hopper") ? true : null,
        ageBand: null,
        validDate: null,
        details: text.slice(0, 700),
      });
    }

    return rows.slice(0, 12);
  });
}

function extractOffersFromPageData({ scripts, bodyText, html }) {
  const payloads = [];
  let priceLikeValues = 0;

  for (const rawSource of [...scripts, bodyText || "", html || ""]) {
    const decodedSource = decodeEscapedJsonText(rawSource);
    const sources = decodedSource === rawSource ? [rawSource] : [rawSource, decodedSource];

    for (const source of sources) {
      for (const jsonText of extractJsonArguments(source, "setInitialData")) {
        const parsed = parseJsonLoose(jsonText);
        if (parsed) payloads.push(parsed);
      }
      for (const jsonText of extractJsonScriptObjects(source)) {
        const parsed = parseJsonLoose(jsonText);
        if (parsed) payloads.push(parsed);
      }
    }
  }

  const offers = [];
  const seen = new Set();
  for (const payload of payloads) {
    const result = collectOfferCandidates(payload);
    priceLikeValues += result.priceLikeValues;
    for (const offer of result.offers) {
      const key = `${offer.productName.toLowerCase()}|${offer.price}`;
      if (seen.has(key)) continue;
      seen.add(key);
      offers.push(offer);
    }

    for (const offer of extractOffersFromPayloadText(payload)) {
      const key = `${offer.productName.toLowerCase()}|${offer.price}`;
      if (seen.has(key)) continue;
      seen.add(key);
      offers.push(offer);
    }
  }

  if (!offers.length && bodyText) {
    const textOffers = extractOffersFromText(bodyText);
    for (const offer of textOffers) {
      const key = `${offer.productName.toLowerCase()}|${offer.price}`;
      if (seen.has(key)) continue;
      seen.add(key);
      offers.push(offer);
    }
  }

  const sortedOffers = offers.sort(compareTicketOffers).slice(0, 12);
  return {
    offers: sortedOffers,
    payloadCount: payloads.length,
    priceLikeValues,
    summary: `Parsed ${payloads.length} embedded data payloads and found ${priceLikeValues} price-like values.`,
  };
}

function extractJsonArguments(source, functionName) {
  const results = [];
  let searchFrom = 0;
  const needle = `${functionName}(`;

  while (searchFrom < source.length) {
    const start = source.indexOf(needle, searchFrom);
    if (start === -1) break;
    const argStart = start + needle.length;
    const extracted = extractBalanced(source, argStart, "(", ")");
    if (extracted) {
      results.push(extracted);
      searchFrom = argStart + extracted.length;
    } else {
      searchFrom = argStart;
    }
  }

  return results;
}

function extractJsonScriptObjects(source) {
  const trimmed = source.trim();
  if (!trimmed || (!trimmed.startsWith("{") && !trimmed.startsWith("["))) return [];
  return [trimmed];
}

function extractBalanced(source, start, open, close) {
  let depth = 0;
  let quote = "";
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const char = source[index];

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = "";
      }
      continue;
    }

    if (char === "\"" || char === "'" || char === "`") {
      quote = char;
      continue;
    }

    if (char === open) {
      depth += 1;
      continue;
    }

    if (char === close) {
      if (depth === 0) return source.slice(start, index).trim();
      depth -= 1;
    }
  }

  return "";
}

function parseJsonLoose(value) {
  try {
    return JSON.parse(value);
  } catch {
    const decoded = decodeEscapedJsonText(value);
    if (decoded !== value) {
      try {
        return JSON.parse(decoded);
      } catch {
        return parseObjectLiteral(decoded);
      }
    }
    return parseObjectLiteral(value);
  }
}

function parseObjectLiteral(value) {
  const source = String(value ?? "").trim();
  if (!source || (!source.startsWith("{") && !source.startsWith("["))) {
    return null;
  }

  try {
    return Function(`"use strict"; return (${source});`)();
  } catch {
    return null;
  }
}

function decodeEscapedJsonText(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed.includes('\\"')) {
    return trimmed;
  }

  return trimmed
    .replace(/\\"/g, "\"")
    .replace(/\\\//g, "/")
    .replace(/\\u0026/gi, "&");
}

function collectOfferCandidates(payload) {
  const offers = [];
  let priceLikeValues = 0;
  const visited = new Set();

  function visit(value, path = [], context = []) {
    if (!value || typeof value !== "object") return;
    if (visited.has(value)) return;
    visited.add(value);

    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, [...path, String(index)], context));
      return;
    }

    const textValues = getObjectTextValues(value);
    const localContext = [...context, ...textValues].filter(Boolean).slice(-18);
    const prices = getObjectPrices(value);
    priceLikeValues += prices.length;

    if (prices.length && hasTicketContext(localContext)) {
      const name = pickProductName(value, localContext);
      if (name) {
        const details = normalizeText(localContext.join(" "));
        for (const price of prices) {
          offers.push(buildOffer({ productName: name, price, details }));
        }
      }
    }

    for (const [key, child] of Object.entries(value)) {
      if (child && typeof child === "object") {
        visit(child, [...path, key], localContext);
      }
    }
  }

  visit(payload);
  return { offers: dedupeOffers(offers), priceLikeValues };
}

function extractOffersFromPayloadText(payload) {
  const text = collectTextLeaves(payload).join(" ");
  return extractOffersFromText(text);
}

function collectTextLeaves(value, visited = new Set()) {
  if (typeof value === "string") {
    return [normalizeText(value)];
  }

  if (!value || typeof value !== "object" || visited.has(value)) {
    return [];
  }

  visited.add(value);
  const results = [];

  if (Array.isArray(value)) {
    for (const item of value) {
      results.push(...collectTextLeaves(item, visited));
    }
    return results;
  }

  for (const child of Object.values(value)) {
    results.push(...collectTextLeaves(child, visited));
  }

  return results.filter((text) => text.length >= 2 && text.length <= 500);
}

function getObjectTextValues(object) {
  return Object.entries(object)
    .filter(([, value]) => typeof value === "string")
    .map(([, value]) => normalizeText(value))
    .filter((value) => value.length >= 2 && value.length <= 300);
}

function getObjectPrices(object) {
  const prices = [];
  for (const [key, value] of Object.entries(object)) {
    const keyLower = key.toLowerCase();
    if (typeof value === "string") {
      const matches = [...value.matchAll(/\$\s?(\d{1,4}(?:,\d{3})*(?:\.\d{2})?)/g)];
      for (const match of matches) {
        prices.push(Number(match[1].replace(/,/g, "")));
      }
      continue;
    }

    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    if (!/(price|amount|cost|fare|total|subtotal|value|adult|child|base|from)/i.test(key)) continue;
    if (/(id|timestamp|time|date|year|quantity|count|index|code)/i.test(key)) continue;
    if (value <= 0 || value > 100_000) continue;

    const normalized = /cent|cents|minor|pennies/i.test(key) || (Number.isInteger(value) && value >= 1_000)
      ? value / 100
      : value;
    if (normalized >= 10 && normalized <= 1_500) prices.push(normalized);
  }

  return prices;
}

function pickProductName(object, context) {
  const preferredKeys = [
    "productName",
    "displayName",
    "shortName",
    "name",
    "title",
    "label",
    "description",
    "type",
  ];

  for (const key of preferredKeys) {
    const value = object[key];
    if (typeof value === "string") {
      const normalized = cleanProductName(value);
      if (isUsefulProductName(normalized)) return normalized;
    }
  }

  for (const value of context) {
    const normalized = cleanProductName(value);
    if (isUsefulProductName(normalized)) return normalized;
  }

  return "";
}

function isUsefulProductName(value) {
  if (!value || value.length < 4 || value.length > 140) return false;
  return /(ticket|park|magic|after|admission|hopper|water|visit|pass|day)/i.test(value);
}

function hasTicketContext(values) {
  const joined = values.join(" ").toLowerCase();
  return /(ticket|theme park|magic ticket|after [14] p\.?m\.?|after [14]pm|park hopper|admission|water park|multi-day|one-day|1-day|2-day|3-day|4-day|5-day)/i.test(joined);
}

function buildOffer({ productName, price, details }) {
  const lower = `${productName} ${details}`.toLowerCase();
  return {
    productName,
    price: Number(price.toFixed(2)),
    currency: "USD",
    priceBasis:
      lower.includes("per day") || /\b\d{1,2}-day\b/.test(lower) ? "per_day" : "from",
    ticketDays:
      Number(lower.match(/\b(\d{1,2})-day\b/)?.[1] || lower.match(/\b(\d{1,2}) day\b/)?.[1]) ||
      null,
    park: null,
    parkHopper: lower.includes("park hopper") ? true : null,
    ageBand: lower.includes("child") ? "child" : lower.includes("adult") ? "adult" : null,
    validDate: null,
    details: normalizeText(details).slice(0, 700),
  };
}

function extractOffersFromText(text) {
  const normalized = normalizeText(text);
  const chunks = normalized.split(
    /(?=(?:After [14] ?P\.?M\.?|[1-9]-Day|[1-9] Day|4-Park|Theme Park|Magic Ticket|Standard\s+1\s*-\s*to\s*10|Water Park))/i
  );
  const offers = [];

  for (const chunk of chunks) {
    const priceMatch = chunk.match(/\$\s?(\d{1,4}(?:,\d{3})*(?:\.\d{2})?)/);
    if (!priceMatch || !hasTicketContext([chunk])) continue;
    const name = cleanProductName(extractLikelyProductName(chunk));
    if (!isUsefulProductName(name)) continue;
    offers.push(buildOffer({
      productName: name,
      price: Number(priceMatch[1].replace(/,/g, "")),
      details: chunk,
    }));
  }

  return dedupeOffers(offers);
}

function extractOffersFromSourceText(source) {
  const windows = extractPriceWindows(source);
  const offers = [];
  for (const window of windows) {
    offers.push(...extractOffersFromText(window));
  }
  return dedupeOffers(offers);
}

function extractPriceWindows(source) {
  const value = decodeEscapedJsonText(String(source ?? ""));
  const windows = [];
  const pricePattern = /\$\s?(?:\d{2,4}(?:,\d{3})*(?:\.\d{2})?|\d\.\d{2})/g;
  for (const match of value.matchAll(pricePattern)) {
    const index = match.index ?? 0;
    const start = Math.max(0, index - 700);
    const end = Math.min(value.length, index + 700);
    const window = normalizeText(value.slice(start, end));
    if (hasTicketContext([window])) {
      windows.push(window);
    }
  }
  return windows.slice(0, 80);
}

function countDollarPriceSnippets(source) {
  return [...String(source ?? "").matchAll(/\$\s?(?:\d{2,4}(?:,\d{3})*(?:\.\d{2})?|\d\.\d{2})/g)].length;
}

function extractLikelyProductName(chunk) {
  const beforePrice = chunk.split(/\$\s?\d/)[0];
  const knownName = beforePrice.match(
    /(After [14] ?P\.?M\.?[^$]{0,80}?Ticket|[1-9]-Day[^$]{0,120}?Ticket|[1-9] Day[^$]{0,120}?Ticket|4-Park[^$]{0,120}?Ticket|Standard\s+1\s*-\s*to\s*10[^$]{0,120}?Ticket|Theme Park[^$]{0,120}?Ticket|Water Park[^$]{0,120}?Ticket)/i
  )?.[1];

  if (knownName) return knownName;

  const sentence = beforePrice
    .split(/(?<=[.!?])\s+|[|]/)
    .reverse()
    .find((part) => hasTicketContext([part]));

  return sentence || beforePrice;
}

function cleanProductName(value) {
  return normalizeText(value)
    .replace(/\$\s?\d{1,4}(?:,\d{3})*(?:\.\d{2})?.*$/, "")
    .replace(/\b(from|starting at|as low as)\b$/i, "")
    .replace(/[:\-–—]+$/g, "")
    .trim();
}

function normalizeText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function dedupeOffers(offers) {
  const seen = new Set();
  return offers.filter((offer) => {
    if (!offer.productName || !Number.isFinite(offer.price)) return false;
    const key = `${offer.productName.toLowerCase()}|${offer.price}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function compareTicketOffers(a, b) {
  const rank = (offer) => {
    const name = offer.productName.toLowerCase();
    if (name.includes("after 4")) return 0;
    if (name.includes("after 1")) return 1;
    if (name.includes("2-day") || name.includes("2 day")) return 2;
    if (name.includes("4-park") || name.includes("4 park")) return 3;
    if (name.includes("theme park") || name.includes("standard")) return 4;
    return 10;
  };
  return rank(a) - rank(b) || a.price - b.price;
}

async function findPage(browser, predicate) {
  const pages = await browser.pages();
  return pages.find(predicate) ?? null;
}

async function getPageState(page) {
  return page
    .evaluate(() => ({
      url: location.href,
      text: (document.body?.innerText || "").replace(/\s+/g, " ").slice(0, 8000),
    }))
    .catch(() => ({ url: page.url(), text: "" }));
}

function appendToken(endpoint, token) {
  const url = new URL(endpoint);
  if (!url.searchParams.has("token")) {
    url.searchParams.set("token", token);
  }
  return url.toString();
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

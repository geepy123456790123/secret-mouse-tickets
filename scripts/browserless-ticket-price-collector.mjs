import puppeteer from "puppeteer-core";

const BROWSERLESS_HOST =
  process.env.BROWSERLESS_HOST ?? "https://production-sfo.browserless.io";
const SESSION_TIMEOUT_MS = 60_000;

export async function collectBrowserlessTicketPrices(event, token) {
  if (!token || !event?.eventPageUrl) {
    throw new Error("Browserless price collection requires a token and event page URL.");
  }

  const browserWSEndpoint = await openReferralSession(event.eventPageUrl, token);
  const browser = await puppeteer.connect({
    browserWSEndpoint: appendToken(browserWSEndpoint, token),
    protocolTimeout: SESSION_TIMEOUT_MS,
  });

  try {
    const referralPage = await findPage(browser, (page) =>
      page.url().includes("disneyworld.disney.go.com/reservations/")
    );

    if (!referralPage) {
      throw new Error("Disney ticket page did not open from the event referral.");
    }

    await clickContinue(referralPage, browser);
    const admissionPage = await waitForAdmissionPage(browser);
    const offers = await extractOfferMenu(admissionPage);

    return {
      collectedAt: new Date().toISOString(),
      sourceUrl: admissionPage.url(),
      prices: offers,
    };
  } finally {
    await browser.close().catch(() => undefined);
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
      disneyReady: waitForTimeout(time: 2500) {
        time
      }
      reconnect(timeout: 10000) {
        browserWSEndpoint
      }
    }
  `;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      variables: { eventUrl: eventPageUrl },
      operationName: "OpenTicketReferral",
    }),
  });
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

async function extractOfferMenu(page) {
  const deadline = Date.now() + 15_000;
  let lastFrameSummary = "";

  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      const frameText = await frame
        .evaluate(() => (document.body?.innerText || "").replace(/\s+/g, " ").trim())
        .catch(() => "");
      if (!frameText.includes("$")) continue;

      const offers = await frame.evaluate(() => {
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

      if (offers.length) {
        return offers;
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

  throw new Error(
    `Disney admission catalog loaded, but no offer prices were found. ${lastFrameSummary.slice(
      0,
      1200
    )}`
  );
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

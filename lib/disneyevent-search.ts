import { load } from "cheerio";

export type SearchProvider = "serper" | "google-html";

type SerperOrganicResult = {
  link?: string;
};

type SerperResponse = {
  organic?: SerperOrganicResult[];
  message?: string;
  error?: string;
};

export const DEFAULT_QUERY = "site:disneyevent.com";
export const DEFAULT_GOOGLE_SEARCH_URL =
  "https://www.google.com/search?q=site:disneyevent.com&client=safari&sca_esv=2802dad21c2aa82f&sca_upv=1&hl=en-us&prmd=bsivn&sxsrf=ACQVn09cFK7nJ-G_9_qmduXCndQf3zYNyw:1709145310580&filter=0&biw=393&bih=741&dpr=3#ip=1";
export const DEFAULT_RESULT_PAGES = 15;
const SERPER_SEARCH_URL = "https://google.serper.dev/search";

export type SearchDiscoveryResult = {
  provider: SearchProvider;
  sourceUrl: string;
  query: string;
  filter: string;
  page: number;
  pages: number;
  items: Array<{ link: string }>;
  count: number;
  warnings: string[];
};

export async function discoverDisneyEventLinks({
  apiKey,
  provider,
  query,
  num,
  page,
  pages,
  googleSearchUrlValue,
}: {
  apiKey?: string;
  provider: SearchProvider;
  query?: string | null;
  num: number;
  page: number;
  pages: number;
  googleSearchUrlValue?: string | null;
}): Promise<SearchDiscoveryResult> {
  const googleSearchUrl = buildGoogleSearchUrl({
    value: googleSearchUrlValue ?? DEFAULT_GOOGLE_SEARCH_URL,
    num,
    page,
  });
  const resolvedQuery = query?.trim() || googleSearchUrl.searchParams.get("q")?.trim() || DEFAULT_QUERY;
  const filter = googleSearchUrl.searchParams.get("filter") ?? "0";

  if (provider === "serper") {
    if (!apiKey) {
      throw new Error("SERPER_API_KEY is not configured.");
    }

    const payloads: SerperResponse[] = [];

    for (
      let currentPage = page;
      currentPage < page + pages && currentPage <= DEFAULT_RESULT_PAGES;
      currentPage++
    ) {
      const response = await fetch(SERPER_SEARCH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": apiKey,
        },
        body: JSON.stringify({
          q: resolvedQuery,
          gl: "us",
          hl: "en",
          num,
          page: currentPage,
          filter,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as SerperResponse;

      if (!response.ok) {
        throw new Error(
          payload.message ??
            payload.error ??
            `Serper returned status ${response.status} on page ${currentPage}.`
        );
      }

      payloads.push(payload);

      if (!payload.organic?.length) {
        break;
      }
    }

    const items = dedupeLinks(
      payloads
        .flatMap((payload) => payload.organic ?? [])
        .map((result) => result.link)
        .filter((link): link is string => isDisneyEventUrl(link))
    ).map((link) => ({ link }));

    return {
      provider,
      sourceUrl: googleSearchUrl.toString(),
      query: resolvedQuery,
      filter,
      page,
      pages: payloads.length,
      items,
      count: items.length,
      warnings: [],
    };
  }

  const links: string[] = [];
  const warnings: string[] = [];

  for (
    let currentPage = page;
    currentPage < page + pages && currentPage <= DEFAULT_RESULT_PAGES;
    currentPage++
  ) {
    const pageUrl = new URL(googleSearchUrl);
    pageUrl.searchParams.set("start", String((currentPage - 1) * num));

    const response = await fetch(pageUrl, {
      headers: {
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
      },
    });

    const html = await response.text();

    if (!response.ok) {
      throw new Error(`Google returned status ${response.status} on page ${currentPage}.`);
    }

    links.push(...parseGoogleResultLinks(html));
  }

  const items = dedupeLinks(links).map((link) => ({ link }));

  if (!items.length) {
    warnings.push(
      "No result links were found in the Google HTML. Google may have returned bot-protection or fallback markup."
    );
  }

  return {
    provider,
    sourceUrl: googleSearchUrl.toString(),
    query: resolvedQuery,
    filter,
    page,
    pages,
    items,
    count: items.length,
    warnings,
  };
}

export function clampNumber(
  value: string | number | null | undefined,
  min: number,
  max: number,
  fallback: number
) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

export function getSearchProvider(value: string | null | undefined): SearchProvider {
  return value === "serper" ? "serper" : "google-html";
}

export function buildGoogleSearchUrl({
  value,
  num,
  page,
}: {
  value: string;
  num: number;
  page: number;
}) {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    url = new URL(DEFAULT_GOOGLE_SEARCH_URL);
  }

  if (url.hostname !== "www.google.com" || url.pathname !== "/search") {
    url = new URL(DEFAULT_GOOGLE_SEARCH_URL);
  }

  if (!url.searchParams.get("q")) {
    url.searchParams.set("q", DEFAULT_QUERY);
  }

  url.searchParams.set("filter", "0");
  url.searchParams.set("num", String(num));
  url.searchParams.set("start", String((page - 1) * num));
  url.hash = "ip=1";

  return url;
}

export function isDisneyEventUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "disneyevent.com";
  } catch {
    return false;
  }
}

export function normalizeEventPageUrl(value: string) {
  const url = new URL(value);

  url.hash = "";

  for (const key of [...url.searchParams.keys()]) {
    if (key.startsWith("utm_") || key === "mc_cid" || key === "mc_eid") {
      url.searchParams.delete(key);
    }
  }

  if (url.pathname !== "/") {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }

  return url.toString();
}

export function isCandidateEventUrl(value: string) {
  const url = new URL(value);
  const segments = url.pathname.split("/").filter(Boolean);

  if (url.hostname !== "disneyevent.com" || segments.length !== 1) {
    return false;
  }

  const slug = segments[0].toLowerCase();

  if (!slug || slug === "know-before-you-go" || slug.includes(".")) {
    return false;
  }

  return true;
}

function parseGoogleResultLinks(html: string) {
  const $ = load(html);
  const links: string[] = [];

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    const resultUrl = extractGoogleHref(href);

    if (resultUrl && isDisneyEventUrl(resultUrl)) {
      links.push(resultUrl);
    }
  });

  for (const match of html.matchAll(/https:\\?\/\\?\/disneyevent\.com[^"'<>\\\s&]*/g)) {
    const resultUrl = match[0].replaceAll("\\/", "/");

    if (isDisneyEventUrl(resultUrl)) {
      links.push(resultUrl);
    }
  }

  return dedupeLinks(links);
}

function extractGoogleHref(value: string | undefined) {
  if (!value) {
    return null;
  }

  if (value.startsWith("https://disneyevent.com/")) {
    return value;
  }

  const absoluteValue = value.startsWith("/") ? `https://www.google.com${value}` : value;

  try {
    const url = new URL(absoluteValue);

    if (url.hostname === "www.google.com" && url.pathname === "/url") {
      return url.searchParams.get("q");
    }

    return null;
  } catch {
    return null;
  }
}

function dedupeLinks(links: string[]) {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const link of links) {
    let normalized: string;

    try {
      normalized = normalizeEventPageUrl(link);
    } catch {
      continue;
    }

    if (seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    deduped.push(normalized);
  }

  return deduped;
}

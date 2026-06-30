import { env } from "cloudflare:workers";
import { load } from "cheerio";

type SerperOrganicResult = {
  link?: string;
  title?: string;
  position?: number;
};

type SerperResponse = {
  organic?: SerperOrganicResult[];
  message?: string;
  error?: string;
};

const DEFAULT_QUERY = "site:disneyevent.com";
const DEFAULT_GOOGLE_SEARCH_URL =
  "https://www.google.com/search?q=site:disneyevent.com&client=safari&sca_esv=2802dad21c2aa82f&sca_upv=1&hl=en-us&prmd=bsivn&sxsrf=ACQVn09cFK7nJ-G_9_qmduXCndQf3zYNyw:1709145310580&filter=0&biw=393&bih=741&dpr=3#ip=1";
const DEFAULT_RESULT_PAGES = 15;
const SERPER_SEARCH_URL = "https://google.serper.dev/search";

export async function GET(request: Request) {
  const auth = authorize(request);
  if (!auth.ok) {
    return auth.response;
  }

  const runtime = env as typeof env & {
    SERPER_API_KEY?: string;
    GOOGLE_SEARCH_URL?: string;
    SEARCH_NORMALIZER_PROVIDER?: string;
  };

  const requestUrl = new URL(request.url);
  const pageParam = requestUrl.searchParams.get("page");
  const num = clampNumber(requestUrl.searchParams.get("num"), 10, 100, 10);
  const page = clampNumber(pageParam, 1, DEFAULT_RESULT_PAGES, 1);
  const pages = clampNumber(
    requestUrl.searchParams.get("pages"),
    1,
    DEFAULT_RESULT_PAGES,
    pageParam ? 1 : DEFAULT_RESULT_PAGES
  );
  const googleSearchUrl = buildGoogleSearchUrl({
    value:
      requestUrl.searchParams.get("googleUrl") ??
      requestUrl.searchParams.get("url") ??
      runtime.GOOGLE_SEARCH_URL ??
      DEFAULT_GOOGLE_SEARCH_URL,
    num,
    page,
  });
  const query =
    requestUrl.searchParams.get("q")?.trim() ??
    googleSearchUrl.searchParams.get("q")?.trim() ??
    DEFAULT_QUERY;
  const filter = googleSearchUrl.searchParams.get("filter") ?? "0";
  const provider = getProvider(
    requestUrl.searchParams.get("provider") ?? runtime.SEARCH_NORMALIZER_PROVIDER
  );

  if (provider === "serper") {
    return searchWithSerper({
      runtime,
      query,
      num,
      page,
      pages,
      filter,
      googleSearchUrl,
    });
  }

  return searchGoogleHtml({ googleSearchUrl, query, num, page, pages, filter });
}

async function searchWithSerper({
  runtime,
  query,
  num,
  page,
  pages,
  filter,
  googleSearchUrl,
}: {
  runtime: typeof env & { SERPER_API_KEY?: string };
  query: string;
  num: number;
  page: number;
  pages: number;
  filter: string;
  googleSearchUrl: URL;
}) {
  if (!runtime.SERPER_API_KEY) {
    return Response.json(
      { error: "SERPER_API_KEY is not configured." },
      { status: 500 }
    );
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
        "X-API-KEY": runtime.SERPER_API_KEY,
      },
      body: JSON.stringify({
        q: query,
        gl: "us",
        hl: "en",
        num,
        page: currentPage,
        filter,
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as SerperResponse;

    if (!response.ok) {
      return Response.json(
        {
          error:
            payload.message ??
            payload.error ??
            `Serper returned status ${response.status}.`,
          page: currentPage,
        },
        { status: 502 }
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

  return Response.json({
    provider: "serper",
    sourceUrl: googleSearchUrl.toString(),
    query,
    filter,
    page,
    pages: payloads.length,
    items,
    count: items.length,
  });
}

async function searchGoogleHtml({
  googleSearchUrl,
  query,
  num,
  page,
  pages,
  filter,
}: {
  googleSearchUrl: URL;
  query: string;
  num: number;
  page: number;
  pages: number;
  filter: string;
}) {
  const links: string[] = [];

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
      return Response.json(
        { error: `Google returned status ${response.status}.`, page: currentPage },
        { status: 502 }
      );
    }

    links.push(...parseGoogleResultLinks(html));
  }

  const items = dedupeLinks(links).map((link) => ({ link }));
  const warnings: string[] = [];

  if (!items.length) {
    warnings.push(
      "No result links were found in the Google HTML. Google may have returned bot-protection or fallback markup."
    );
  }

  return Response.json({
    provider: "google-html",
    sourceUrl: googleSearchUrl.toString(),
    query,
    filter,
    page,
    pages,
    items,
    count: items.length,
    ...(warnings.length ? { warnings } : {}),
  });
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

function clampNumber(
  value: string | null,
  min: number,
  max: number,
  fallback: number
) {
  if (value === null) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

function getProvider(value: string | null | undefined) {
  return value === "serper" ? "serper" : "google-html";
}

function buildGoogleSearchUrl({
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

function isDisneyEventUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "disneyevent.com";
  } catch {
    return false;
  }
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

  const absoluteValue = value.startsWith("/")
    ? `https://www.google.com${value}`
    : value;

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
    const normalized = normalizeUrl(link);
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    deduped.push(normalized);
  }

  return deduped;
}

function normalizeUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

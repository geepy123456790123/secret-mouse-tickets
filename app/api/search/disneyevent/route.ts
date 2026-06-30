import { env } from "cloudflare:workers";

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
const SERPER_SEARCH_URL = "https://google.serper.dev/search";

export async function GET(request: Request) {
  const auth = authorize(request);
  if (!auth.ok) {
    return auth.response;
  }

  const runtime = env as typeof env & {
    SERPER_API_KEY?: string;
  };

  if (!runtime.SERPER_API_KEY) {
    return Response.json(
      { error: "SERPER_API_KEY is not configured." },
      { status: 500 }
    );
  }

  const requestUrl = new URL(request.url);
  const query = requestUrl.searchParams.get("q")?.trim() || DEFAULT_QUERY;
  const num = clampNumber(requestUrl.searchParams.get("num"), 10, 100, 100);
  const page = clampNumber(requestUrl.searchParams.get("page"), 1, 10, 1);

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
      page,
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
      },
      { status: 502 }
    );
  }

  const items = dedupeLinks(
    (payload.organic ?? [])
      .map((result) => result.link)
      .filter((link): link is string => isDisneyEventUrl(link))
  ).map((link) => ({ link }));

  return Response.json({
    provider: "serper",
    query,
    items,
    count: items.length,
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
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

function isDisneyEventUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "disneyevent.com";
  } catch {
    return false;
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

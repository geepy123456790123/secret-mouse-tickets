import { env } from "cloudflare:workers";
import {
  DEFAULT_RESULT_PAGES,
  clampNumber,
  discoverDisneyEventLinks,
  getSearchProvider,
} from "@/lib/disneyevent-search";

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
  const provider = getSearchProvider(
    requestUrl.searchParams.get("provider") ?? runtime.SEARCH_NORMALIZER_PROVIDER
  );

  try {
    const result = await discoverDisneyEventLinks({
      apiKey: runtime.SERPER_API_KEY,
      provider,
      query: requestUrl.searchParams.get("q"),
      num,
      page,
      pages,
      googleSearchUrlValue:
        requestUrl.searchParams.get("googleUrl") ??
        requestUrl.searchParams.get("url") ??
        runtime.GOOGLE_SEARCH_URL,
    });

    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Search normalization failed." },
      { status: provider === "serper" ? 502 : 500 }
    );
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

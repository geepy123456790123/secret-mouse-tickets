/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  ADMIN_INGEST_TOKEN?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const SCRAPE_BATCH_SIZE = 1;
const SCRAPE_TOTAL_PAGES = 15;

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    if (url.pathname === "/api/admin/scrape" && request.method === "POST") {
      const body = await request.clone().json().catch(() => null);

      if (body && typeof body === "object" && body.batched !== true) {
        const startPage = clampPositiveInt(body.startPage, 1);
        const pages = clampPositiveInt(body.pages, SCRAPE_TOTAL_PAGES);

        if (pages > SCRAPE_BATCH_SIZE) {
          try {
            return await runBatchedScrapeRequest({
              request,
              env,
              ctx,
              body,
              startPage,
              pages,
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return Response.json({ ok: false, error: message }, { status: 500 });
          }
        }
      }
    }

    const response = await handler.fetch(request, env, ctx);
    return withSecurityHeaders(response);
  },
};

export default worker;

function withSecurityHeaders(response: Response) {
  const headers = new Headers(response.headers);
  headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "script-src 'self' 'unsafe-inline' https://*.squarecdn.com https://www.paypal.com https://*.paypal.com https://www.paypalobjects.com https://*.paypalobjects.com",
      "style-src 'self' 'unsafe-inline' https://*.squarecdn.com",
      "img-src 'self' data: https://*.squarecdn.com https://*.squareup.com https://*.squareupsandbox.com https://www.paypal.com https://*.paypal.com https://www.paypalobjects.com https://*.paypalobjects.com",
      "font-src 'self' https://square-fonts-production-f.squarecdn.com https://d1g145x70srn7h.cloudfront.net",
      "connect-src 'self' https://*.squarecdn.com https://*.squareup.com https://*.squareupsandbox.com https://www.paypal.com https://*.paypal.com https://www.paypalobjects.com https://*.paypalobjects.com https://o160250.ingest.sentry.io",
      "frame-src 'self' https://*.squarecdn.com https://*.squareup.com https://*.squareupsandbox.com https://www.paypal.com https://*.paypal.com",
      "child-src 'self' https://*.squarecdn.com https://*.squareup.com https://*.squareupsandbox.com https://www.paypal.com https://*.paypal.com",
      "worker-src 'self' blob:",
      "form-action 'self' https://*.squareup.com https://*.squareupsandbox.com https://www.paypal.com https://*.paypal.com",
    ].join("; ")
  );
  headers.set("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Content-Type-Options", "nosniff");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function runBatchedScrapeRequest({
  request,
  env,
  ctx,
  body,
  startPage,
  pages,
}: {
  request: Request;
  env: Env;
  ctx: ExecutionContext;
  body: Record<string, unknown>;
  startPage: number;
  pages: number;
}) {
  const batchCount = Math.ceil(pages / SCRAPE_BATCH_SIZE);
  const batchRuns: number[] = [];
  const batchResults: ScrapeBatchResult[] = [];

  for (let index = 0; index < batchCount; index++) {
    const batchStartPage = startPage + index * SCRAPE_BATCH_SIZE;
    const remainingPages = pages - index * SCRAPE_BATCH_SIZE;
    const batchPages = Math.min(SCRAPE_BATCH_SIZE, remainingPages);
    const response = await handler.fetch(
      new Request("https://secret-mouse-tickets.internal/api/admin/scrape", {
        method: "POST",
        headers: copyScrapeHeaders(request.headers),
        body: JSON.stringify({
          ...body,
          startPage: batchStartPage,
          pages: batchPages,
          batched: true,
        }),
      }),
      env,
      ctx,
    );
    const payload = (await response.json().catch(() => null)) as ScrapeBatchResult | null;

    if (!response.ok || !payload?.ok) {
      return Response.json(
        {
          ok: false,
          error: payload?.error ?? `Scrape batch ${batchStartPage} failed with ${response.status}.`,
          batchRuns,
        },
        { status: response.ok ? 500 : response.status }
      );
    }

    if (payload.runId) {
      batchRuns.push(payload.runId);
    }

    batchResults.push(payload);
  }

  return Response.json({
    ok: true,
    batchRuns,
    provider: batchResults[0]?.provider,
    sourceUrl: batchResults[0]?.sourceUrl,
    query: batchResults[0]?.query,
    startPage,
    pages,
    discovered: batchResults.reduce((sum, item) => sum + (item.discovered ?? 0), 0),
    parsed: batchResults.reduce((sum, item) => sum + (item.parsed ?? 0), 0),
    skipped: batchResults.reduce((sum, item) => sum + (item.skipped ?? 0), 0),
    ingest: {
      ok: true,
      upserted: batchResults.reduce((sum, item) => sum + (item.ingest?.upserted ?? 0), 0),
      ignored: batchResults.reduce((sum, item) => sum + (item.ingest?.ignored ?? 0), 0),
      ignoredItems: batchResults.flatMap((item) => item.ingest?.ignoredItems ?? []).slice(0, 25),
      upsertedUrls: batchResults.flatMap((item) => item.ingest?.upsertedUrls ?? []).slice(0, 25),
    },
    skipReasonSummary: summarizeBatchReasons(batchResults),
    warnings: [...new Set(batchResults.flatMap((item) => item.warnings ?? []))],
    sampleEvents: batchResults.flatMap((item) => item.sampleEvents ?? []).slice(0, 5),
    sampleSkipped: batchResults.flatMap((item) => item.sampleSkipped ?? []).slice(0, 10),
  });
}

function copyScrapeHeaders(headers: Headers) {
  const next = new Headers({ "Content-Type": "application/json" });
  const authorization = headers.get("authorization");

  if (authorization) {
    next.set("authorization", authorization);
  }

  return next;
}

function clampPositiveInt(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function summarizeBatchReasons(results: ScrapeBatchResult[]) {
  const counts = new Map<string, number>();

  for (const result of results) {
    for (const item of result.skipReasonSummary ?? []) {
      counts.set(item.reason, (counts.get(item.reason) ?? 0) + item.count);
    }
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 10)
    .map(([reason, count]) => ({ reason, count }));
}

type ScrapeBatchResult = {
  ok: boolean;
  runId?: number;
  provider?: string;
  sourceUrl?: string;
  query?: string;
  discovered?: number;
  parsed?: number;
  skipped?: number;
  ingest?: {
    ok: boolean;
    upserted: number;
    ignored: number;
    ignoredItems?: Array<{ url: string; reason: string }>;
    upsertedUrls?: string[];
  };
  skipReasonSummary?: Array<{ reason: string; count: number }>;
  warnings?: string[];
  sampleEvents?: Array<{
    eventPageUrl: string;
    infoBannerFirst: string;
    eventStartDate: string;
    eventEndDate: string;
    destination: string;
  }>;
  sampleSkipped?: Array<{ url: string; reason: string }>;
  error?: string;
};

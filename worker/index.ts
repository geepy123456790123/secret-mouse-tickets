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

type ScheduledController = {
  cron: string;
  scheduledTime: number;
};

const SCRAPE_BATCH_SIZE = 4;
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

    const response = await handler.fetch(request, env, ctx);
    return withSecurityHeaders(response);
  },

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runDailyScrape(controller, env, ctx));
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
      "script-src 'self' 'unsafe-inline' https://*.squarecdn.com",
      "style-src 'self' 'unsafe-inline' https://*.squarecdn.com",
      "img-src 'self' data: https://*.squarecdn.com https://*.squareup.com https://*.squareupsandbox.com",
      "font-src 'self' https://square-fonts-production-f.squarecdn.com https://d1g145x70srn7h.cloudfront.net",
      "connect-src 'self' https://*.squarecdn.com https://*.squareup.com https://*.squareupsandbox.com https://o160250.ingest.sentry.io",
      "frame-src 'self' https://*.squarecdn.com https://*.squareup.com https://*.squareupsandbox.com",
      "child-src 'self' https://*.squarecdn.com https://*.squareup.com https://*.squareupsandbox.com",
      "worker-src 'self' blob:",
      "form-action 'self' https://*.squareup.com https://*.squareupsandbox.com",
    ].join("; ")
  );
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Content-Type-Options", "nosniff");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function runDailyScrape(
  controller: ScheduledController,
  env: Env,
  ctx: ExecutionContext,
): Promise<void> {
  const headers = new Headers({ "Content-Type": "application/json" });

  if (env.ADMIN_INGEST_TOKEN) {
    headers.set("Authorization", `Bearer ${env.ADMIN_INGEST_TOKEN}`);
  }

  const batchCount = Math.ceil(SCRAPE_TOTAL_PAGES / SCRAPE_BATCH_SIZE);
  const batchResults: unknown[] = [];

  for (let index = 0; index < batchCount; index++) {
    const startPage = 1 + index * SCRAPE_BATCH_SIZE;
    const remainingPages = SCRAPE_TOTAL_PAGES - index * SCRAPE_BATCH_SIZE;
    const pages = Math.min(SCRAPE_BATCH_SIZE, remainingPages);
    const response = await handler.fetch(
      new Request("https://secret-mouse-tickets.internal/api/admin/scrape", {
        method: "POST",
        headers,
        body: JSON.stringify({ startPage, pages }),
      }),
      env,
      ctx,
    );

    const payload = await response.text();

    if (!response.ok) {
      throw new Error(`Daily scrape batch ${startPage}-${startPage + pages - 1} failed with ${response.status}: ${payload}`);
    }

    batchResults.push(JSON.parse(payload));
  }

  console.log(
    JSON.stringify({
      message: "Daily Disney event scrape completed.",
      cron: controller.cron,
      scheduledTime: controller.scheduledTime,
      result: batchResults,
    }),
  );
}

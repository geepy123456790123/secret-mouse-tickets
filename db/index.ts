import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

let setupPromise: Promise<void> | null = null;

export function getRawDb() {
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  return env.DB;
}

export function getDb() {
  return drizzle(getRawDb(), { schema });
}

export async function ensureDatabase() {
  setupPromise ??= createSchema();
  return setupPromise;
}

async function createSchema() {
  const db = getRawDb();

  await db.batch([
    db.prepare(
      "CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, event_page_url TEXT NOT NULL UNIQUE, info_banner_first TEXT NOT NULL, info_banner_second TEXT NOT NULL, event_start_date TEXT NOT NULL, event_end_date TEXT NOT NULL, valid_start_date TEXT NOT NULL, valid_end_date TEXT NOT NULL, destination TEXT NOT NULL DEFAULT 'disney_world', hotel_special_rate_available INTEGER NOT NULL DEFAULT 0, hotel_name TEXT, hotel_booking_url TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS events_valid_window_idx ON events (valid_start_date, valid_end_date)"
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS events_event_start_idx ON events (event_start_date)"
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS leads (id TEXT PRIMARY KEY, visit_start_date TEXT NOT NULL, visit_end_date TEXT NOT NULL, theme_park_days INTEGER NOT NULL, park_hopper INTEGER NOT NULL DEFAULT 0, guests_10_plus INTEGER NOT NULL, guests_3_to_9 INTEGER NOT NULL, florida_resident INTEGER NOT NULL DEFAULT 0, email TEXT NOT NULL, status TEXT NOT NULL, matched_event_id INTEGER, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS visits (id TEXT PRIMARY KEY, session_id TEXT, visitor_id TEXT, landing_page TEXT, referrer TEXT, referrer_domain TEXT, utm_source TEXT, utm_medium TEXT, utm_campaign TEXT, utm_content TEXT, utm_term TEXT, gclid TEXT, fbclid TEXT, msclkid TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS coupons (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE, discount_cents INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, max_redemptions INTEGER, redemption_count INTEGER NOT NULL DEFAULT 0, expires_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, lead_id TEXT NOT NULL, event_id INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending', amount_cents INTEGER NOT NULL DEFAULT 5700, currency TEXT NOT NULL DEFAULT 'USD', confirmation_number TEXT, coupon_code TEXT, square_payment_link_id TEXT, square_order_id TEXT, square_payment_id TEXT, square_payment_status TEXT, checkout_url TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, paid_at TEXT)"
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS orders_paid_at_idx ON orders (paid_at)"
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS email_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id TEXT NOT NULL, recipient_email TEXT NOT NULL, subject TEXT NOT NULL, body_text TEXT NOT NULL, provider_message_id TEXT, status TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS scrape_runs (id INTEGER PRIMARY KEY AUTOINCREMENT, status TEXT NOT NULL, provider TEXT, query TEXT, source_url TEXT, candidate_count INTEGER NOT NULL DEFAULT 0, parsed_count INTEGER NOT NULL DEFAULT 0, skipped_count INTEGER NOT NULL DEFAULT 0, upserted_count INTEGER NOT NULL DEFAULT 0, ignored_count INTEGER NOT NULL DEFAULT 0, error TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS scrape_run_items (id INTEGER PRIMARY KEY AUTOINCREMENT, scrape_run_id INTEGER NOT NULL, url TEXT NOT NULL, status TEXT NOT NULL, reason TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"
    ),
  ]);

  const columns = await db.prepare("PRAGMA table_info(events)").all<{ name: string }>();
  const hasDestination = columns.results?.some((column) => column.name === "destination");

  if (!hasDestination) {
    await db
      .prepare("ALTER TABLE events ADD COLUMN destination TEXT NOT NULL DEFAULT 'disney_world'")
      .run();
  }

  await db.prepare("CREATE INDEX IF NOT EXISTS events_destination_idx ON events (destination)").run();

  const scrapeRunColumns = await db.prepare("PRAGMA table_info(scrape_runs)").all<{ name: string }>();
  const existingScrapeRunColumns = new Set(scrapeRunColumns.results?.map((column) => column.name) ?? []);
  const scrapeRunOptionalColumns = [
    ["provider", "TEXT"],
    ["query", "TEXT"],
    ["source_url", "TEXT"],
    ["parsed_count", "INTEGER NOT NULL DEFAULT 0"],
    ["skipped_count", "INTEGER NOT NULL DEFAULT 0"],
  ] as const;

  for (const [name, type] of scrapeRunOptionalColumns) {
    if (!existingScrapeRunColumns.has(name)) {
      await db.prepare(`ALTER TABLE scrape_runs ADD COLUMN ${name} ${type}`).run();
    }
  }

  await db.prepare("CREATE INDEX IF NOT EXISTS scrape_run_items_run_idx ON scrape_run_items (scrape_run_id)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS scrape_run_items_status_idx ON scrape_run_items (status)").run();

  const leadColumns = await db.prepare("PRAGMA table_info(leads)").all<{ name: string }>();
  const existingLeadColumns = new Set(leadColumns.results?.map((column) => column.name) ?? []);
  const attributionColumns = [
    ["visit_id", "TEXT"],
    ["session_id", "TEXT"],
    ["visitor_id", "TEXT"],
    ["utm_source", "TEXT"],
    ["utm_medium", "TEXT"],
    ["utm_campaign", "TEXT"],
    ["utm_content", "TEXT"],
    ["utm_term", "TEXT"],
    ["landing_page", "TEXT"],
    ["referrer", "TEXT"],
    ["referrer_domain", "TEXT"],
    ["gclid", "TEXT"],
    ["fbclid", "TEXT"],
    ["msclkid", "TEXT"],
  ] as const;

  for (const [name, type] of attributionColumns) {
    if (!existingLeadColumns.has(name)) {
      await db.prepare(`ALTER TABLE leads ADD COLUMN ${name} ${type}`).run();
    }
  }

  const orderColumns = await db.prepare("PRAGMA table_info(orders)").all<{ name: string }>();
  const existingOrderColumns = new Set(orderColumns.results?.map((column) => column.name) ?? []);
  const squareColumns = [
    ["square_payment_id", "TEXT"],
    ["square_payment_status", "TEXT"],
  ] as const;

  for (const [name, type] of squareColumns) {
    if (!existingOrderColumns.has(name)) {
      await db.prepare(`ALTER TABLE orders ADD COLUMN ${name} ${type}`).run();
    }
  }

  const seededCoupons = [
    ["SUMMERDEAL25", 1425],
    ["TEST00", 5700],
  ] as const;

  for (const [code, discountCents] of seededCoupons) {
    await db
      .prepare(
        "INSERT INTO coupons (code, discount_cents, active, max_redemptions, expires_at) VALUES (?, ?, 1, NULL, NULL) ON CONFLICT(code) DO UPDATE SET discount_cents = excluded.discount_cents, active = 1, max_redemptions = NULL, expires_at = NULL"
      )
      .bind(code, discountCents)
      .run();
  }

  await db.prepare("DELETE FROM coupons WHERE code = ?").bind("LAUNCH25").run();

  await db.prepare("CREATE INDEX IF NOT EXISTS leads_created_at_idx ON leads (created_at)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS leads_visit_id_idx ON leads (visit_id)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS leads_session_id_idx ON leads (session_id)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS leads_visitor_id_idx ON leads (visitor_id)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders (created_at)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS orders_square_payment_link_idx ON orders (square_payment_link_id)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS orders_square_order_idx ON orders (square_order_id)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS orders_square_payment_idx ON orders (square_payment_id)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS visits_created_at_idx ON visits (created_at)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS visits_session_id_idx ON visits (session_id)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS visits_visitor_id_idx ON visits (visitor_id)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS visits_source_idx ON visits (utm_source, utm_campaign)").run();
}

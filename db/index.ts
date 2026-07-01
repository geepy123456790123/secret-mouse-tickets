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
      "CREATE TABLE IF NOT EXISTS coupons (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE, discount_cents INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, max_redemptions INTEGER, redemption_count INTEGER NOT NULL DEFAULT 0, expires_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, lead_id TEXT NOT NULL, event_id INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending', amount_cents INTEGER NOT NULL DEFAULT 9900, currency TEXT NOT NULL DEFAULT 'USD', confirmation_number TEXT, coupon_code TEXT, square_payment_link_id TEXT, square_order_id TEXT, checkout_url TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, paid_at TEXT)"
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS orders_paid_at_idx ON orders (paid_at)"
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS email_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id TEXT NOT NULL, recipient_email TEXT NOT NULL, subject TEXT NOT NULL, body_text TEXT NOT NULL, provider_message_id TEXT, status TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS scrape_runs (id INTEGER PRIMARY KEY AUTOINCREMENT, status TEXT NOT NULL, candidate_count INTEGER NOT NULL DEFAULT 0, upserted_count INTEGER NOT NULL DEFAULT 0, ignored_count INTEGER NOT NULL DEFAULT 0, error TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"
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
}

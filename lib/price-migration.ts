import type { getRawDb } from "@/db";

// This release migration is deliberately fixed at $39 -> $29. Do not replace
// these historical amounts with the current price constant in future releases.
export const PRICE_MIGRATION_ID = "2026-09-17-service-fee-29";
const pending = `NOT EXISTS (SELECT 1 FROM service_fee_migrations WHERE id = '${PRICE_MIGRATION_ID}')`;

export const priceMigrationSql = [
  `INSERT OR IGNORE INTO service_fee_migration_backup (migration_id, entity, entity_id, previous_values)
   SELECT '${PRICE_MIGRATION_ID}', 'coupon', CAST(id AS TEXT),
     json_object('discount_cents', discount_cents)
   FROM coupons WHERE ${pending}`,
  `INSERT OR IGNORE INTO service_fee_migration_backup (migration_id, entity, entity_id, previous_values)
   SELECT '${PRICE_MIGRATION_ID}', 'order', id,
     json_object('amount_cents', amount_cents, 'paypal_order_id', paypal_order_id,
       'paypal_payment_status', paypal_payment_status)
   FROM orders WHERE status = 'pending' AND ${pending}`,
  `UPDATE coupons SET discount_cents = CASE
     WHEN code = 'BACKTOSCHOOL' THEN 580
     ELSE MIN(2900, CAST(ROUND(discount_cents * 29.0 / 39.0) AS INTEGER)) END
   WHERE ${pending}`,
  // Preserve cheaper legacy checkouts and every completed transaction. Old
  // PayPal approvals must not capture the previous total after repricing.
  `UPDATE orders SET
     paypal_order_id = NULL,
     paypal_payment_status = CASE WHEN paypal_order_id IS NOT NULL THEN 'PRICE_CHANGED' ELSE paypal_payment_status END,
     amount_cents = MIN(amount_cents, MAX(0, 2900 - COALESCE(
       (SELECT discount_cents FROM coupons WHERE code = orders.coupon_code), 0)))
   WHERE status = 'pending' AND amount_cents > MAX(0, 2900 - COALESCE(
     (SELECT discount_cents FROM coupons WHERE code = orders.coupon_code), 0))
     AND ${pending}`,
  `INSERT OR IGNORE INTO service_fee_migrations (id) VALUES ('${PRICE_MIGRATION_ID}')`,
] as const;

export async function migrateServiceFee(
  db: ReturnType<typeof getRawDb>,
  runtime: { SQUARE_ACCESS_TOKEN?: string; SQUARE_ENVIRONMENT?: string },
) {
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS service_fee_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE TABLE IF NOT EXISTS service_fee_migration_backup (migration_id TEXT NOT NULL, entity TEXT NOT NULL, entity_id TEXT NOT NULL, previous_values TEXT NOT NULL, PRIMARY KEY (migration_id, entity, entity_id))"),
  ]);
  if (await db.prepare("SELECT id FROM service_fee_migrations WHERE id = ?").bind(PRICE_MIGRATION_ID).first()) return;

  // Legacy Square-hosted links have their own order total. Update those too;
  // the current embedded card/wallet checkout already uses amount_cents.
  const links = await db.prepare(`SELECT orders.square_order_id,
    MIN(orders.amount_cents, MAX(0, 2900 - CASE WHEN coupons.code = 'BACKTOSCHOOL' THEN 580
      ELSE MIN(2900, CAST(ROUND(COALESCE(coupons.discount_cents, 0) * 29.0 / 39.0) AS INTEGER)) END)) AS new_amount
    FROM orders LEFT JOIN coupons ON coupons.code = orders.coupon_code
    WHERE orders.status = 'pending' AND orders.square_payment_link_id IS NOT NULL`).all<{
      square_order_id: string | null; new_amount: number;
    }>();
  for (const link of links.results ?? []) {
    if (!runtime.SQUARE_ACCESS_TOKEN || !link.square_order_id) {
      throw new Error("Cannot reprice a legacy Square checkout without its credentials and order ID.");
    }
    const base = runtime.SQUARE_ENVIRONMENT === "production" ? "https://connect.squareup.com" : "https://connect.squareupsandbox.com";
    const headers = { Authorization: `Bearer ${runtime.SQUARE_ACCESS_TOKEN}`, "Content-Type": "application/json" };
    const url = `${base}/v2/orders/${encodeURIComponent(link.square_order_id)}`;
    const response = await fetch(url, { headers });
    const { order } = await response.json() as { order?: {
      version: number; state: string; total_money?: { amount: number };
      line_items?: Array<{ uid: string; quantity: string }>;
    } };
    if (!response.ok || !order) throw new Error("Unable to check the legacy Square checkout price.");
    if (order.state === "CANCELED") continue;
    if (order.state !== "DRAFT" || order.line_items?.length !== 1 || order.line_items[0].quantity !== "1") {
      throw new Error("Legacy Square checkout needs review before its price can be changed.");
    }
    if (order.total_money?.amount === link.new_amount) continue;
    const updated = await fetch(url, {
      method: "PUT", headers,
      body: JSON.stringify({
        idempotency_key: `fee29-${link.square_order_id}`,
        order: { version: order.version, line_items: [{ uid: order.line_items[0].uid, base_price_money: { amount: link.new_amount, currency: "USD" } }] },
      }),
    });
    const result = await updated.json() as { order?: { total_money?: { amount: number } } };
    if (!updated.ok || result.order?.total_money?.amount !== link.new_amount) {
      throw new Error("Unable to update the legacy Square checkout to the new fee.");
    }
  }
  // D1 batch is transactional; the completion marker and all DB repricing
  // succeed together. Predicates make repeated/concurrent runs safe.
  await db.batch(priceMigrationSql.map((sql) => db.prepare(sql)));
}

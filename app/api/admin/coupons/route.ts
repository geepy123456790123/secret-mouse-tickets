import { ensureDatabase, getRawDb } from "@/db";

type CouponRow = {
  id: number;
  code: string;
  discount_cents: number;
  active: number;
  max_redemptions: number | null;
  redemption_count: number;
  expires_at: string | null;
  created_at: string;
};

function normalizeCode(value: string | undefined) {
  return value?.trim().toUpperCase() ?? "";
}

function parseDiscountCents(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("Discount must be a positive dollar amount.");
  }

  return Math.round(parsed * 100);
}

function parseMaxRedemptions(value: unknown) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error("Max redemptions must be a whole number.");
  }

  return parsed;
}

function parseExpiresAt(value: unknown) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Expiration date must be YYYY-MM-DD.");
  }

  return value;
}

function mapCoupon(row: CouponRow) {
  return {
    id: row.id,
    code: row.code,
    discountCents: row.discount_cents,
    discountDollars: (row.discount_cents / 100).toFixed(2),
    active: row.active === 1,
    maxRedemptions: row.max_redemptions,
    redemptionCount: row.redemption_count,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

export async function GET() {
  await ensureDatabase();
  const rows = await getRawDb()
    .prepare(
      "SELECT id, code, discount_cents, active, max_redemptions, redemption_count, expires_at, created_at FROM coupons ORDER BY created_at DESC, code ASC"
    )
    .all<CouponRow>();

  return Response.json({
    ok: true,
    coupons: (rows.results ?? []).map(mapCoupon),
  });
}

export async function POST(request: Request) {
  try {
    await ensureDatabase();
    const db = getRawDb();
    const body = (await request.json()) as {
      code?: string;
      discountDollars?: number | string;
      active?: boolean;
      maxRedemptions?: number | string | null;
      expiresAt?: string | null;
    };

    const code = normalizeCode(body.code);
    if (!code) {
      return Response.json({ error: "Coupon code is required." }, { status: 400 });
    }

    await db
      .prepare(
        "INSERT INTO coupons (code, discount_cents, active, max_redemptions, expires_at) VALUES (?, ?, ?, ?, ?)"
      )
      .bind(
        code,
        parseDiscountCents(body.discountDollars),
        body.active === false ? 0 : 1,
        parseMaxRedemptions(body.maxRedemptions),
        parseExpiresAt(body.expiresAt)
      )
      .run();

    return GET();
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to create coupon." },
      { status: 400 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    await ensureDatabase();
    const db = getRawDb();
    const body = (await request.json()) as {
      id?: number;
      code?: string;
      discountDollars?: number | string;
      active?: boolean;
      maxRedemptions?: number | string | null;
      expiresAt?: string | null;
    };

    if (!body.id) {
      return Response.json({ error: "Coupon ID is required." }, { status: 400 });
    }

    const code = normalizeCode(body.code);
    if (!code) {
      return Response.json({ error: "Coupon code is required." }, { status: 400 });
    }

    await db
      .prepare(
        "UPDATE coupons SET code = ?, discount_cents = ?, active = ?, max_redemptions = ?, expires_at = ? WHERE id = ?"
      )
      .bind(
        code,
        parseDiscountCents(body.discountDollars),
        body.active === false ? 0 : 1,
        parseMaxRedemptions(body.maxRedemptions),
        parseExpiresAt(body.expiresAt),
        body.id
      )
      .run();

    return GET();
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to update coupon." },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    await ensureDatabase();
    const db = getRawDb();
    const body = (await request.json()) as { id?: number };

    if (!body.id) {
      return Response.json({ error: "Coupon ID is required." }, { status: 400 });
    }

    await db.prepare("DELETE FROM coupons WHERE id = ?").bind(body.id).run();
    return GET();
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to delete coupon." },
      { status: 400 }
    );
  }
}

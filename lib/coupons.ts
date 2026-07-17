import { getRawDb } from "@/db";

export const PRICE_CENTS = 3900;

export async function priceForCoupon(
  db: ReturnType<typeof getRawDb>,
  couponCode: string | null
) {
  if (!couponCode) {
    return PRICE_CENTS;
  }

  const coupon = await db
    .prepare(
      "SELECT discount_cents, max_redemptions, redemption_count, expires_at FROM coupons WHERE code = ? AND active = 1 LIMIT 1"
    )
    .bind(couponCode)
    .first<{
      discount_cents: number;
      max_redemptions: number | null;
      redemption_count: number;
      expires_at: string | null;
    }>();

  if (!coupon) {
    throw new Error("Coupon code was not found.");
  }

  if (coupon.max_redemptions !== null && coupon.redemption_count >= coupon.max_redemptions) {
    throw new Error("Coupon code has reached its limit.");
  }

  if (coupon.expires_at && coupon.expires_at < new Date().toISOString().slice(0, 10)) {
    throw new Error("Coupon code has expired.");
  }

  return Math.max(0, PRICE_CENTS - coupon.discount_cents);
}

import { ensureDatabase, getRawDb } from "@/db";
import { priceForCoupon } from "@/lib/coupons";

type OrderRow = {
  id: string;
  status: string;
};

export async function POST(request: Request) {
  try {
    await ensureDatabase();
    const db = getRawDb();
    const body = (await request.json()) as {
      orderId?: string;
      couponCode?: string;
    };
    const orderId = body.orderId?.trim();

    if (!orderId) {
      return Response.json({ error: "Order ID is required." }, { status: 400 });
    }

    const order = await db
      .prepare("SELECT id, status FROM orders WHERE id = ? LIMIT 1")
      .bind(orderId)
      .first<OrderRow>();

    if (!order) {
      return Response.json({ error: "Order was not found." }, { status: 404 });
    }

    if (order.status === "paid") {
      return Response.json({ error: "This order has already been paid." }, { status: 409 });
    }

    const couponCode = body.couponCode?.trim().toUpperCase() || null;
    const amountCents = await priceForCoupon(db, couponCode);

    await db
      .prepare("UPDATE orders SET coupon_code = ?, amount_cents = ? WHERE id = ?")
      .bind(couponCode, amountCents, orderId)
      .run();

    return Response.json({
      ok: true,
      couponCode,
      amountCents,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to apply coupon code.";
    return Response.json({ error: message }, { status: 400 });
  }
}

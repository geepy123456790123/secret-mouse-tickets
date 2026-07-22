import { env } from "cloudflare:workers";
import { ensureDatabase, getRawDb } from "@/db";
import { markOrderPaidAndSendConfirmation } from "@/lib/orders";

type SquareWebhookPayload = {
  type?: string;
  event_id?: string;
  data?: {
    object?: {
      payment?: SquarePayment;
    };
  };
};

type SquarePayment = {
  id?: string;
  status?: string;
  note?: string;
  order_id?: string;
  payment_link_id?: string;
  total_money?: {
    amount?: number;
    currency?: string;
  };
};

type OrderMatch = {
  id: string;
  amount_cents: number;
  status: string;
};

export async function POST(request: Request) {
  await ensureDatabase();

  const runtime = env as typeof env & {
    SQUARE_WEBHOOK_SIGNATURE_KEY?: string;
    SQUARE_WEBHOOK_NOTIFICATION_URL?: string;
  };

  if (!runtime.SQUARE_WEBHOOK_SIGNATURE_KEY) {
    return Response.json({ error: "Square webhook signature key is not configured." }, { status: 500 });
  }

  const rawBody = await request.text();
  const notificationUrl = runtime.SQUARE_WEBHOOK_NOTIFICATION_URL ?? new URL(request.url).toString();
  const signature = request.headers.get("x-square-hmacsha256-signature");
  const isValid = await verifySquareSignature({
    rawBody,
    notificationUrl,
    signatureKey: runtime.SQUARE_WEBHOOK_SIGNATURE_KEY,
    signature,
  });

  if (!isValid) {
    return Response.json({ error: "Invalid Square signature." }, { status: 403 });
  }

  const payload = JSON.parse(rawBody) as SquareWebhookPayload;
  const payment = payload.data?.object?.payment;

  if (!payment) {
    return Response.json({ ok: true, ignored: true, reason: "No payment payload." });
  }

  const squarePaymentStatus = payment.status ?? null;
  const squarePaymentId = payment.id ?? null;
  const squareOrderId = payment.order_id ?? null;
  const squarePaymentLinkId = payment.payment_link_id ?? null;

  if (squarePaymentStatus !== "COMPLETED") {
    await updatePaymentStatus({
      squarePaymentId,
      squareOrderId,
      squarePaymentLinkId,
      squarePaymentStatus,
    });

    return Response.json({
      ok: true,
      ignored: true,
      reason: `Payment status ${squarePaymentStatus ?? "unknown"} is not completed.`,
    });
  }

  const db = getRawDb();
  const order = await findMatchingOrder({
    appOrderId: extractAppOrderId(payment.note),
    squarePaymentId,
    squareOrderId,
    squarePaymentLinkId,
  });

  if (!order) {
    return Response.json({ ok: true, ignored: true, reason: "No matching order found." });
  }

  const paidAmount = payment.total_money?.amount;
  const paidCurrency = payment.total_money?.currency;

  if (typeof paidAmount === "number" && paidAmount !== order.amount_cents) {
    return Response.json({ error: "Square payment amount does not match order amount." }, { status: 409 });
  }

  if (paidCurrency && paidCurrency !== "USD") {
    return Response.json({ error: "Square payment currency does not match order currency." }, { status: 409 });
  }

  const result = await markOrderPaidAndSendConfirmation({
    db,
    orderId: order.id,
    origin: new URL(request.url).origin,
    paymentProvider: "square",
    squarePaymentId,
    squareOrderId,
    squarePaymentStatus,
  });

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return Response.json({
    ok: true,
    eventId: payload.event_id ?? null,
    eventType: payload.type ?? null,
    orderId: order.id,
    alreadyPaid: result.alreadyPaid,
    confirmationNumber: result.confirmationNumber,
    emailStatus: "emailStatus" in result ? result.emailStatus : undefined,
  });
}

async function verifySquareSignature({
  rawBody,
  notificationUrl,
  signatureKey,
  signature,
}: {
  rawBody: string;
  notificationUrl: string;
  signatureKey: string;
  signature: string | null;
}) {
  if (!signature) {
    return false;
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(signatureKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(`${notificationUrl}${rawBody}`));
  const expected = arrayBufferToBase64(digest);

  return constantTimeEqual(expected, signature);
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function constantTimeEqual(left: string, right: string) {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let diff = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < length; index += 1) {
    diff |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return diff === 0;
}

async function findMatchingOrder({
  appOrderId,
  squarePaymentId,
  squareOrderId,
  squarePaymentLinkId,
}: {
  appOrderId: string | null;
  squarePaymentId: string | null;
  squareOrderId: string | null;
  squarePaymentLinkId: string | null;
}) {
  const db = getRawDb();
  const candidates = [
    ["id", appOrderId],
    ["square_payment_id", squarePaymentId],
    ["square_order_id", squareOrderId],
    ["square_payment_link_id", squarePaymentLinkId],
  ] as const;

  for (const [column, value] of candidates) {
    if (!value) {
      continue;
    }

    const order = await db
      .prepare(`SELECT id, amount_cents, status FROM orders WHERE ${column} = ? LIMIT 1`)
      .bind(value)
      .first<OrderMatch>();

    if (order) {
      return order;
    }
  }

  return null;
}

async function updatePaymentStatus({
  squarePaymentId,
  squareOrderId,
  squarePaymentLinkId,
  squarePaymentStatus,
}: {
  squarePaymentId: string | null;
  squareOrderId: string | null;
  squarePaymentLinkId: string | null;
  squarePaymentStatus: string | null;
}) {
  const order = await findMatchingOrder({
    appOrderId: null,
    squarePaymentId,
    squareOrderId,
    squarePaymentLinkId,
  });

  if (!order) {
    return;
  }

  await getRawDb()
    .prepare(
      "UPDATE orders SET square_payment_id = COALESCE(?, square_payment_id), square_order_id = COALESCE(?, square_order_id), square_payment_status = COALESCE(?, square_payment_status) WHERE id = ?"
    )
    .bind(squarePaymentId, squareOrderId, squarePaymentStatus, order.id)
    .run();
}

function extractAppOrderId(note?: string | null) {
  if (!note) {
    return null;
  }

  return note.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0] ?? null;
}

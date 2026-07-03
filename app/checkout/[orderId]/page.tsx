import Image from "next/image";
import { notFound } from "next/navigation";
import { env } from "cloudflare:workers";
import { ensureDatabase, getRawDb } from "@/db";
import { formatDate } from "@/lib/dates";
import { CheckoutConfirm } from "./checkout-confirm";
import { SquarePaymentForm } from "./square-payment-form";

type CheckoutOrder = {
  order_id: string;
  amount_cents: number;
  status: string;
  recipient_email: string;
  theme_park_days: number;
  info_banner_first: string;
  valid_start_date: string;
  valid_end_date: string;
};

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  await ensureDatabase();
  const order = await getRawDb()
    .prepare(
      "SELECT orders.id AS order_id, orders.amount_cents, orders.status, leads.email AS recipient_email, leads.theme_park_days, events.info_banner_first, events.valid_start_date, events.valid_end_date FROM orders JOIN leads ON leads.id = orders.lead_id JOIN events ON events.id = orders.event_id WHERE orders.id = ? LIMIT 1"
    )
    .bind(orderId)
    .first<CheckoutOrder>();

  if (!order) {
    notFound();
  }

  const runtime = env as typeof env & {
    SQUARE_APPLICATION_ID?: string;
    SQUARE_ACCESS_TOKEN?: string;
    SQUARE_LOCATION_ID?: string;
    SQUARE_ENVIRONMENT?: string;
  };
  const isSquareProduction =
    Boolean(runtime.SQUARE_ACCESS_TOKEN && runtime.SQUARE_APPLICATION_ID && runtime.SQUARE_LOCATION_ID) &&
    runtime.SQUARE_ENVIRONMENT === "production";
  const isPaid = order.status === "paid";

  return (
    <main className="brand-page min-h-screen px-5 py-8 text-[#120f17]">
      <section className="cartoon-panel mx-auto grid max-w-2xl gap-5 rounded-[24px] bg-white p-5 sm:p-7">
        <Image
          src="/secret-mouse-tickets-logo.png"
          alt="Secret Mouse Tickets"
          width={705}
          height={607}
          unoptimized
          priority
          className="h-auto w-44 object-contain"
        />
        <div className="grid gap-2">
          <p className="text-sm font-bold uppercase text-[#5d45b5]">
            {isPaid ? "Payment received" : "Secure checkout"}
          </p>
          <h1 className="text-3xl font-bold">
            {isPaid ? "Check Your Email For Your Discount Ticket Link" : "Complete Your Purchase"}
          </h1>
          <p className="text-lg font-bold">${(order.amount_cents / 100).toFixed(2)}</p>
        </div>

        <div className="rounded-[18px] border-[3px] border-[#120f17] bg-[#fff7de] p-4 text-sm font-semibold leading-6">
          <p className="font-bold">
            {isPaid
              ? "Your confirmation and Disney Group and Convention discounted ticket sale link were sent automatically to "
              : "Complete the secure payment below, we'll send your confirmation and Disney Group and Convention discounted ticket sale link automatically to "}
            {order.recipient_email}. Your actual theme park tickets are purchased directly from
            Disney.
          </p>
          <p>
            Disney Tickets available through the link will be valid from{" "}
            {formatDate(order.valid_start_date)} through {formatDate(order.valid_end_date)}, and
            includes extra Water Park Fun &amp; More Visit passes for multi-date tickets.
          </p>
        </div>

        {isPaid ? (
          <CheckoutConfirm orderId={order.order_id} showTestButton={false} />
        ) : isSquareProduction || order.amount_cents <= 0 ? (
          <SquarePaymentForm
            orderId={order.order_id}
            amountCents={order.amount_cents}
            applicationId={runtime.SQUARE_APPLICATION_ID ?? null}
            locationId={runtime.SQUARE_LOCATION_ID ?? null}
            environment={runtime.SQUARE_ENVIRONMENT ?? "sandbox"}
          />
        ) : (
          <CheckoutConfirm orderId={order.order_id} showTestButton />
        )}
      </section>
    </main>
  );
}

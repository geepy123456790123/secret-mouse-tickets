import Image from "next/image";
import { notFound } from "next/navigation";
import { env } from "cloudflare:workers";
import { ensureDatabase, getRawDb } from "@/db";
import { formatDate } from "@/lib/dates";
import { SiteFooter } from "@/components/site-footer";
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
  const heading = isPaid ? (
    <>
      <span className="sm:hidden">Check Your Email For Your Discount Ticket Link</span>
      <span className="hidden sm:inline">Check Your Email For Your Discount Ticket Link</span>
    </>
  ) : (
    <>
      <span className="sm:hidden">Complete Your Purchase</span>
      <span className="hidden sm:inline">Complete Your Purchase</span>
    </>
  );

  return (
    <main className="brand-page min-h-screen px-3 pt-[calc(env(safe-area-inset-top)+1rem)] pb-[calc(env(safe-area-inset-bottom)+5.5rem)] text-[#120f17] sm:px-5 sm:py-8">
      <section className="mx-auto mb-6 max-w-2xl sm:mb-8">
        <section className="cartoon-panel grid gap-4 rounded-[20px] bg-white p-4 sm:gap-5 sm:rounded-[24px] sm:p-7">
          <Image
            src="/secret-mouse-tickets-logo.png"
            alt="Secret Mouse Tickets"
            width={705}
            height={607}
            unoptimized
            priority
            className="h-auto w-28 object-contain sm:w-44"
          />
          <div className="grid gap-1.5 sm:gap-2">
            <p className="text-sm font-bold uppercase text-[#5d45b5]">
              {isPaid ? "Payment received" : "Secure checkout"}
            </p>
            <h1 className="max-w-[11ch] text-[2rem] leading-[0.95] font-bold sm:max-w-none sm:whitespace-nowrap sm:text-3xl sm:leading-tight">
              {heading}
            </h1>
            <p className="text-base font-bold sm:text-lg">
              ${(order.amount_cents / 100).toFixed(2)}
            </p>
          </div>

          <div className="space-y-3 rounded-[16px] border-[3px] border-[#120f17] bg-[#fff7de] p-3.5 text-[15px] leading-7 font-semibold break-words sm:rounded-[18px] sm:p-4 sm:text-sm sm:leading-6">
            <p className="font-bold">
              {isPaid
                ? "Your payment confirmation and Disney Group & Convention discount link were sent automatically to "
                : "Complete the secure payment below and we'll email your payment confirmation and Disney Group & Convention discount link automatically to "}
              {order.recipient_email}. Use the emailed link to purchase your actual theme park
              tickets directly from Disney.
            </p>
            <p>
              Tickets purchased through this Disney offer are valid from{" "}
              {formatDate(order.valid_start_date)} through {formatDate(order.valid_end_date)}.
              Multi-day tickets also include an extra Water Park Fun &amp; More Visit pass.
            </p>
          </div>

          {isPaid ? (
            <CheckoutConfirm orderId={order.order_id} showTestButton={false} />
          ) : isSquareProduction || order.amount_cents <= 0 ? (
            <SquarePaymentForm
              orderId={order.order_id}
              amountCents={order.amount_cents}
              recipientEmail={order.recipient_email}
              applicationId={runtime.SQUARE_APPLICATION_ID ?? null}
              locationId={runtime.SQUARE_LOCATION_ID ?? null}
              environment={runtime.SQUARE_ENVIRONMENT ?? "sandbox"}
            />
          ) : (
            <CheckoutConfirm orderId={order.order_id} showTestButton />
          )}
        </section>
      </section>
      <SiteFooter className="max-w-2xl" />
    </main>
  );
}

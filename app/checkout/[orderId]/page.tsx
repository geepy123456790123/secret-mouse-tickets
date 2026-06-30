import Image from "next/image";
import { notFound } from "next/navigation";
import { ensureDatabase, getRawDb } from "@/db";
import { formatDate } from "@/lib/dates";
import { CheckoutConfirm } from "./checkout-confirm";

type CheckoutOrder = {
  order_id: string;
  amount_cents: number;
  status: string;
  recipient_email: string;
  info_banner_first: string;
  valid_start_date: string;
  valid_end_date: string;
  hotel_special_rate_available: number;
  hotel_name: string | null;
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
      "SELECT orders.id AS order_id, orders.amount_cents, orders.status, leads.email AS recipient_email, events.info_banner_first, events.valid_start_date, events.valid_end_date, events.hotel_special_rate_available, events.hotel_name FROM orders JOIN leads ON leads.id = orders.lead_id JOIN events ON events.id = orders.event_id WHERE orders.id = ? LIMIT 1"
    )
    .bind(orderId)
    .first<CheckoutOrder>();

  if (!order) {
    notFound();
  }

  return (
    <main className="brand-page min-h-screen px-5 py-8 text-[#120f17]">
      <section className="cartoon-panel mx-auto grid max-w-2xl gap-5 rounded-[24px] bg-white p-5 sm:p-7">
        <Image
          src="/secret-mouse-tickets-logo.jpg"
          alt="Secret Mouse Tickets"
          width={1024}
          height={1024}
          priority
          className="h-auto w-44 rounded-[20px] border-4 border-[#120f17] object-cover"
        />
        <div className="grid gap-2">
          <p className="text-sm font-bold uppercase text-[#5d45b5]">Demo checkout</p>
          <h1 className="text-3xl font-bold">Secret Mouse Tickets</h1>
          <p className="text-lg font-bold">${(order.amount_cents / 100).toFixed(2)}</p>
        </div>

        <div className="rounded-[18px] border-[3px] border-[#120f17] bg-[#fff7de] p-4 text-sm font-semibold leading-6">
          <p className="font-bold">{order.info_banner_first}</p>
          <p>
            Valid from {formatDate(order.valid_start_date)} to {formatDate(order.valid_end_date)}
          </p>
          {order.hotel_special_rate_available && order.hotel_name && (
            <p>Hotel bonus: {order.hotel_name}</p>
          )}
          <p>Receipt email: {order.recipient_email}</p>
        </div>

        <CheckoutConfirm orderId={order.order_id} />
      </section>
    </main>
  );
}

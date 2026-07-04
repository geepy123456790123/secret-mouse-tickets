"use client";

import { FormEvent, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { BarChart3, DollarSign, Filter, Percent, ShoppingCart, Ticket } from "lucide-react";

type ConversionData = {
  ok: boolean;
  window: {
    startDate: string;
    endDate: string;
  };
  summary: {
    totalLeads: number;
    matchedLeads: number;
    notFoundLeads: number;
    checkoutStarts: number;
    paidOrders: number;
    pendingOrders: number;
    revenueCents: number;
    averageOrderCents: number;
    revenuePerLeadCents: number;
    revenuePerMatchedLeadCents: number;
  };
  eventPerformance: Array<{
    eventName: string;
    matchedLeads: number;
    checkoutStarts: number;
    paidOrders: number;
    revenueCents: number;
    averageOrderCents: number;
  }>;
  coupons: Array<{
    couponCode: string;
    checkoutStarts: number;
    paidOrders: number;
    revenueCents: number;
    averageOrderCents: number;
  }>;
  attribution: Array<{
    source: string;
    campaign: string;
    leads: number;
    matchedLeads: number;
    checkoutStarts: number;
    paidOrders: number;
    revenueCents: number;
    revenuePerLeadCents: number;
  }>;
  checkoutAging: {
    under1Hour: number;
    over24Hours: number;
    over7Days: number;
  };
  timings: {
    medianLeadToCheckoutHours: number;
    medianCheckoutToPaidHours: number;
  };
  daily: Array<{
    date: string;
    leads: number;
    matchedLeads: number;
    checkoutStarts: number;
    paidOrders: number;
    revenueCents: number;
  }>;
  recentOrders: Array<{
    orderId: string;
    status: string;
    amountCents: number;
    couponCode: string | null;
    createdAt: string;
    paidAt: string | null;
    email: string;
    themeParkDays: number;
    guests10Plus: number;
    guests3To9: number;
    source: string;
    campaign: string;
    eventName: string;
  }>;
  error?: string;
};

const defaultWindow = getDefaultWindow();

export default function AdminConversionsPage() {
  const [token, setToken] = useState("");
  const [startDate, setStartDate] = useState(defaultWindow.startDate);
  const [endDate, setEndDate] = useState(defaultWindow.endDate);
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [data, setData] = useState<ConversionData | null>(null);
  const [error, setError] = useState("");

  const rates = useMemo(() => {
    const summary = data?.summary;

    return {
      matchRate: rate(summary?.matchedLeads, summary?.totalLeads),
      checkoutRate: rate(summary?.checkoutStarts, summary?.matchedLeads),
      paidRate: rate(summary?.paidOrders, summary?.checkoutStarts),
    };
  }, [data]);

  async function loadDashboard(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setStatus("loading");
    setError("");

    try {
      const params = new URLSearchParams({ start: startDate, end: endDate });
      const response = await fetch(`/api/admin/conversions?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const payload = (await response.json()) as ConversionData;

      if (!response.ok) {
        setError(payload.error ?? "Unable to load conversions.");
        setData(null);
        return;
      }

      setData(payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load conversions.");
      setData(null);
    } finally {
      setStatus("idle");
    }
  }

  return (
    <main className="brand-page min-h-screen px-5 py-8 text-[#120f17]">
      <section className="mx-auto grid max-w-7xl gap-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-[#5d45b5]">Admin</p>
            <h1 className="text-3xl font-black sm:text-4xl">Conversions</h1>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#3e304d]">
              Track the lead cohort from date check to paid access, then compare revenue by coupon,
              source, and campaign.
            </p>
          </div>
          {data ? (
            <p className="rounded-full border-[3px] border-[#120f17] bg-[#fff7de] px-4 py-2 text-sm font-black shadow-[4px_4px_0_#120f17]">
              {data.window.startDate} to {data.window.endDate}
            </p>
          ) : null}
        </div>

        <form
          onSubmit={loadDashboard}
          className="cartoon-panel grid gap-4 rounded-[24px] bg-white p-5 sm:grid-cols-[1fr_180px_180px_auto] sm:items-end sm:p-6"
        >
          <label className="grid gap-2 text-sm font-bold">
            Admin Token
            <input
              type="password"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              className="h-12 rounded-[14px] border-[3px] border-[#120f17] bg-[#fffaf0] px-3 text-base font-semibold"
              placeholder="Required when configured"
            />
          </label>
          <label className="grid gap-2 text-sm font-bold">
            Start Date
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="h-12 rounded-[14px] border-[3px] border-[#120f17] bg-[#fffaf0] px-3 text-base font-semibold"
            />
          </label>
          <label className="grid gap-2 text-sm font-bold">
            End Date
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="h-12 rounded-[14px] border-[3px] border-[#120f17] bg-[#fffaf0] px-3 text-base font-semibold"
            />
          </label>
          <button
            type="submit"
            disabled={status === "loading"}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-[16px] border-4 border-[#120f17] bg-[#ffbd38] px-5 font-black shadow-[5px_5px_0_#120f17] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Filter size={18} aria-hidden="true" />
            {status === "loading" ? "Loading..." : "Load"}
          </button>
        </form>

        {error ? (
          <p className="rounded-[18px] border-4 border-[#120f17] bg-[#ffdfe7] px-4 py-3 text-sm font-bold shadow-[5px_5px_0_#120f17]">
            {error}
          </p>
        ) : null}

        {data ? (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <MetricCard
                icon={<Ticket size={22} aria-hidden="true" />}
                label="Leads"
                value={formatNumber(data.summary.totalLeads)}
                detail={`${formatNumber(data.summary.matchedLeads)} matched, ${rates.matchRate} match rate`}
                bg="bg-[#d8c6ff]"
              />
              <MetricCard
                icon={<ShoppingCart size={22} aria-hidden="true" />}
                label="Checkout Starts"
                value={formatNumber(data.summary.checkoutStarts)}
                detail={`${rates.checkoutRate} of matched leads`}
                bg="bg-[#fff7de]"
              />
              <MetricCard
                icon={<DollarSign size={22} aria-hidden="true" />}
                label="Revenue"
                value={formatMoney(data.summary.revenueCents)}
                detail={`${formatNumber(data.summary.paidOrders)} paid, ${formatMoney(data.summary.averageOrderCents)} AOV`}
                bg="bg-[#ffbd38]"
              />
              <MetricCard
                icon={<Percent size={22} aria-hidden="true" />}
                label="Revenue Per Lead"
                value={formatMoney(data.summary.revenuePerLeadCents)}
                detail={`${formatMoney(data.summary.revenuePerMatchedLeadCents)} per matched lead`}
                bg="bg-[#e7f7d9]"
              />
              <MetricCard
                icon={<Percent size={22} aria-hidden="true" />}
                label="Checkout Conversion"
                value={rates.paidRate}
                detail={`${formatNumber(data.summary.pendingOrders)} pending checkouts`}
                bg="bg-[#ffdeea]"
              />
              <MetricCard
                icon={<ShoppingCart size={22} aria-hidden="true" />}
                label="Lead To Checkout"
                value={formatHours(data.timings.medianLeadToCheckoutHours)}
                detail={`${formatHours(data.timings.medianCheckoutToPaidHours)} checkout-to-paid median`}
                bg="bg-[#d9f4ff]"
              />
              <MetricCard
                icon={<BarChart3 size={22} aria-hidden="true" />}
                label="Aged Pending"
                value={formatNumber(data.checkoutAging.over24Hours)}
                detail={`${formatNumber(data.checkoutAging.over7Days)} over 7 days, ${formatNumber(data.checkoutAging.under1Hour)} under 1 hour`}
                bg="bg-[#ffe7cf]"
              />
            </section>

            <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
              <Panel title="Event Performance" subtitle="Which matched offers turn into paid orders.">
                <DataTable
                  columns={["Event", "Matched", "Starts", "Paid", "Revenue", "Paid Rate"]}
                  rows={data.eventPerformance.map((event) => [
                    event.eventName,
                    formatNumber(event.matchedLeads),
                    formatNumber(event.checkoutStarts),
                    formatNumber(event.paidOrders),
                    formatMoney(event.revenueCents),
                    rate(event.paidOrders, event.checkoutStarts),
                  ])}
                  empty="No matched-event performance in this window."
                />
              </Panel>

              <Panel title="Coupon Performance" subtitle="Revenue and paid orders by access code.">
                <DataTable
                  columns={["Coupon", "Starts", "Paid", "Revenue", "AOV", "Paid Rate"]}
                  rows={data.coupons.map((coupon) => [
                    coupon.couponCode,
                    formatNumber(coupon.checkoutStarts),
                    formatNumber(coupon.paidOrders),
                    formatMoney(coupon.revenueCents),
                    formatMoney(coupon.averageOrderCents),
                    rate(coupon.paidOrders, coupon.checkoutStarts),
                  ])}
                  empty="No checkout starts in this window."
                />
              </Panel>

              <Panel title="Source And Campaign" subtitle="Efficiency by source and campaign.">
                <DataTable
                  columns={["Source", "Campaign", "Leads", "Match Rate", "Paid Rate", "Rev/Lead", "Revenue"]}
                  rows={data.attribution.map((item) => [
                    item.source,
                    item.campaign,
                    formatNumber(item.leads),
                    rate(item.matchedLeads, item.leads),
                    rate(item.paidOrders, item.leads),
                    formatMoney(item.revenuePerLeadCents),
                    formatMoney(item.revenueCents),
                  ])}
                  empty="No lead attribution in this window."
                />
              </Panel>
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
              <Panel title="Checkout Timing" subtitle="Median time between lead, checkout, and payment.">
                <DataTable
                  columns={["Metric", "Value"]}
                  rows={[
                    ["Lead to checkout start", formatHours(data.timings.medianLeadToCheckoutHours)],
                    ["Checkout start to paid", formatHours(data.timings.medianCheckoutToPaidHours)],
                  ]}
                  empty="No timing data in this window."
                />
              </Panel>

              <Panel title="Pending Checkout Aging" subtitle="Separate fresh checkouts from likely abandonment.">
                <DataTable
                  columns={["Bucket", "Count"]}
                  rows={[
                    ["Under 1 hour", formatNumber(data.checkoutAging.under1Hour)],
                    ["24 hours or more", formatNumber(data.checkoutAging.over24Hours)],
                    ["7 days or more", formatNumber(data.checkoutAging.over7Days)],
                  ]}
                  empty="No pending checkout aging in this window."
                />
              </Panel>
            </section>

            <Panel title="Daily Trend" subtitle="Lead cohort performance by day.">
              <DataTable
                columns={["Date", "Leads", "Matched", "Starts", "Paid", "Revenue"]}
                rows={data.daily.map((day) => [
                  day.date,
                  formatNumber(day.leads),
                  formatNumber(day.matchedLeads),
                  formatNumber(day.checkoutStarts),
                  formatNumber(day.paidOrders),
                  formatMoney(day.revenueCents),
                ])}
                empty="No activity in this window."
              />
            </Panel>

            <Panel title="Recent Orders" subtitle="Latest checkout starts for this lead cohort.">
              <DataTable
                columns={["Created", "Status", "Email", "Amount", "Coupon", "Trip", "Source"]}
                rows={data.recentOrders.map((order) => [
                  formatDateTime(order.createdAt),
                  order.status,
                  order.email,
                  formatMoney(order.amountCents),
                  order.couponCode ?? "No coupon",
                  `${order.themeParkDays} days, ${order.guests10Plus + order.guests3To9} guests`,
                  `${order.source} / ${order.campaign}`,
                ])}
                empty="No orders in this window."
              />
            </Panel>
          </>
        ) : (
          <section className="cartoon-panel rounded-[24px] bg-white p-6 text-center">
            <BarChart3 className="mx-auto text-[#8f72f2]" size={38} aria-hidden="true" />
            <h2 className="mt-3 text-xl font-black">Load conversion data</h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#3e304d]">
              Choose a date window and enter the admin token to see the current funnel, revenue,
              coupons, attribution, and recent checkout starts.
            </p>
          </section>
        )}
      </section>
    </main>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail,
  bg,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  bg: string;
}) {
  return (
    <div className={`cartoon-panel grid gap-3 rounded-[22px] ${bg} p-5`}>
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border-[3px] border-[#120f17] bg-white">
          {icon}
        </span>
        <p className="text-xs font-black uppercase tracking-wide text-[#5d45b5]">{label}</p>
      </div>
      <p className="text-3xl font-black">{value}</p>
      <p className="text-sm font-bold leading-5 text-[#3e304d]">{detail}</p>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section className="cartoon-panel overflow-hidden rounded-[24px] bg-white">
      <div className="border-b-4 border-[#120f17] bg-[#d8c6ff] px-5 py-4">
        <h2 className="text-xl font-black">{title}</h2>
        <p className="mt-1 text-sm font-bold text-[#3e304d]">{subtitle}</p>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function DataTable({
  columns,
  rows,
  empty,
}: {
  columns: string[];
  rows: string[][];
  empty: string;
}) {
  if (!rows.length) {
    return (
      <p className="rounded-[16px] border-[3px] border-[#120f17] bg-[#fff7de] p-4 text-sm font-bold text-[#3e304d]">
        {empty}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] border-separate border-spacing-0 text-left text-sm">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column}
                className="border-b-4 border-[#120f17] bg-[#fff7de] px-3 py-2 font-black"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="odd:bg-white even:bg-[#fffaf0]">
              {row.map((cell, cellIndex) => (
                <td
                  key={`${rowIndex}-${cellIndex}`}
                  className="border-b-2 border-[#e7dff2] px-3 py-3 font-semibold text-[#3e304d]"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function getDefaultWindow() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 29);

  return {
    startDate: toIsoDate(start),
    endDate: toIsoDate(end),
  };
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format((cents || 0) / 100);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value || 0);
}

function rate(numerator = 0, denominator = 0) {
  if (!denominator) {
    return "0%";
  }

  return `${Math.round((numerator / denominator) * 100)}%`;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatHours(value: number) {
  if (!value) {
    return "0h";
  }

  return `${value.toFixed(1)}h`;
}

"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  BarChart3,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Filter,
  Percent,
  ShoppingCart,
  Ticket,
} from "lucide-react";

type ConversionData = {
  ok: boolean;
  window: {
    startDate: string;
    endDate: string;
  };
  summary: {
    totalVisits: number;
    uniqueVisitors: number;
    uniqueSessions: number;
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
    leadCaptureRate: number;
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
  visitAttribution: Array<{
    source: string;
    medium: string;
    campaign: string;
    referrerDomain: string;
    visits: number;
    visitors: number;
    leads: number;
    matchedLeads: number;
    paidOrders: number;
    revenueCents: number;
    leadRate: number;
    paidRate: number;
  }>;
  searchTerms: Array<{
    term: string;
    visits: number;
    leads: number;
    paidOrders: number;
    revenueCents: number;
  }>;
  organicSearch: {
    status: {
      configured: boolean;
      connected: boolean;
      siteUrl: string | null;
      error?: string;
    };
    rows: Array<{
      term: string;
      clicks: number;
      impressions: number;
      ctr: number;
      position: number;
    }>;
  };
  checkoutAging: {
    under1Hour: number;
    over24Hours: number;
    over7Days: number;
  };
  reminderPerformance: {
    firstReminder: {
      label: string;
      sent: number;
      convertedOrders: number;
      convertedRevenueCents: number;
      conversionRate: number;
    };
    secondReminder: {
      label: string;
      sent: number;
      convertedOrders: number;
      convertedRevenueCents: number;
      conversionRate: number;
    };
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

type ManagedCoupon = {
  id: number;
  code: string;
  discountCents: number;
  discountDollars: string;
  active: boolean;
  maxRedemptions: number | null;
  redemptionCount: number;
  expiresAt: string | null;
  createdAt: string;
};

type ManagedTopBanner = {
  prefix: string;
  highlight: string;
  suffix: string;
  textColor: string;
  highlightColor: string;
};

const defaultWindow = getDefaultWindow();

type AdminConversionsDashboardProps = {
  showHeader?: boolean;
};

export function AdminConversionsDashboard({
  showHeader = true,
}: AdminConversionsDashboardProps) {
  const [startDate, setStartDate] = useState(defaultWindow.startDate);
  const [endDate, setEndDate] = useState(defaultWindow.endDate);
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [data, setData] = useState<ConversionData | null>(null);
  const [error, setError] = useState("");
  const [coupons, setCoupons] = useState<ManagedCoupon[]>([]);
  const [couponError, setCouponError] = useState("");
  const [couponStatus, setCouponStatus] = useState<"idle" | "loading" | "saving">("idle");
  const [couponOpen, setCouponOpen] = useState(false);
  const [bannerSettings, setBannerSettings] = useState<ManagedTopBanner | null>(null);
  const [bannerError, setBannerError] = useState("");
  const [bannerStatus, setBannerStatus] = useState<"idle" | "loading" | "saving">("idle");
  const [draftCoupon, setDraftCoupon] = useState({
    code: "",
    discountDollars: "",
    active: true,
    maxRedemptions: "",
    expiresAt: "",
  });

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
      const response = await fetch(`/admin/api/conversions?${params.toString()}`);
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

  async function createCoupon(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCouponStatus("saving");
    setCouponError("");

    try {
      const response = await fetch("/admin/api/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: draftCoupon.code,
          discountDollars: draftCoupon.discountDollars,
          active: draftCoupon.active,
          maxRedemptions: draftCoupon.maxRedemptions || null,
          expiresAt: draftCoupon.expiresAt || null,
        }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        coupons?: ManagedCoupon[];
        error?: string;
      };

      if (!response.ok || !payload.ok || !payload.coupons) {
        throw new Error(payload.error ?? "Unable to create coupon.");
      }

      setCoupons(payload.coupons);
      setDraftCoupon({
        code: "",
        discountDollars: "",
        active: true,
        maxRedemptions: "",
        expiresAt: "",
      });
    } catch (caught) {
      setCouponError(caught instanceof Error ? caught.message : "Unable to create coupon.");
    } finally {
      setCouponStatus("idle");
    }
  }

  async function saveCoupon(coupon: ManagedCoupon) {
    setCouponStatus("saving");
    setCouponError("");

    try {
      const response = await fetch("/admin/api/coupons", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: coupon.id,
          code: coupon.code,
          discountDollars: coupon.discountDollars,
          active: coupon.active,
          maxRedemptions: coupon.maxRedemptions,
          expiresAt: coupon.expiresAt,
        }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        coupons?: ManagedCoupon[];
        error?: string;
      };

      if (!response.ok || !payload.ok || !payload.coupons) {
        throw new Error(payload.error ?? "Unable to save coupon.");
      }

      setCoupons(payload.coupons);
    } catch (caught) {
      setCouponError(caught instanceof Error ? caught.message : "Unable to save coupon.");
    } finally {
      setCouponStatus("idle");
    }
  }

  async function deleteCoupon(id: number) {
    setCouponStatus("saving");
    setCouponError("");

    try {
      const response = await fetch("/admin/api/coupons", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        coupons?: ManagedCoupon[];
        error?: string;
      };

      if (!response.ok || !payload.ok || !payload.coupons) {
        throw new Error(payload.error ?? "Unable to delete coupon.");
      }

      setCoupons(payload.coupons);
    } catch (caught) {
      setCouponError(caught instanceof Error ? caught.message : "Unable to delete coupon.");
    } finally {
      setCouponStatus("idle");
    }
  }

  async function loadBannerSettings() {
    setBannerStatus("loading");
    setBannerError("");

    try {
      const response = await fetch("/admin/api/banner");
      const payload = (await response.json()) as {
        ok?: boolean;
        banner?: ManagedTopBanner;
        error?: string;
      };

      if (!response.ok || !payload.ok || !payload.banner) {
        throw new Error(payload.error ?? "Unable to load banner settings.");
      }

      setBannerSettings(payload.banner);
    } catch (caught) {
      setBannerError(
        caught instanceof Error ? caught.message : "Unable to load banner settings."
      );
    } finally {
      setBannerStatus("idle");
    }
  }

  async function saveBannerSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!bannerSettings) {
      return;
    }

    setBannerStatus("saving");
    setBannerError("");

    try {
      const response = await fetch("/admin/api/banner", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bannerSettings),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        banner?: ManagedTopBanner;
        error?: string;
      };

      if (!response.ok || !payload.ok || !payload.banner) {
        throw new Error(payload.error ?? "Unable to save banner settings.");
      }

      setBannerSettings(payload.banner);
    } catch (caught) {
      setBannerError(
        caught instanceof Error ? caught.message : "Unable to save banner settings."
      );
    } finally {
      setBannerStatus("idle");
    }
  }

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch("/admin/api/coupons");
        const payload = (await response.json()) as {
          ok?: boolean;
          coupons?: ManagedCoupon[];
          error?: string;
        };

        if (cancelled) {
          return;
        }

        if (!response.ok || !payload.ok || !payload.coupons) {
          throw new Error(payload.error ?? "Unable to load coupons.");
        }

        setCoupons(payload.coupons);
      } catch (caught) {
        if (!cancelled) {
          setCouponError(caught instanceof Error ? caught.message : "Unable to load coupons.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch("/admin/api/banner");
        const payload = (await response.json()) as {
          ok?: boolean;
          banner?: ManagedTopBanner;
          error?: string;
        };

        if (cancelled) {
          return;
        }

        if (!response.ok || !payload.ok || !payload.banner) {
          throw new Error(payload.error ?? "Unable to load banner settings.");
        }

        setBannerSettings(payload.banner);
      } catch (caught) {
        if (!cancelled) {
          setBannerError(
            caught instanceof Error ? caught.message : "Unable to load banner settings."
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="grid gap-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          {showHeader ? (
            <>
              <p className="text-sm font-bold uppercase tracking-wide text-[#5d45b5]">Admin</p>
              <h1 className="text-3xl font-black sm:text-4xl">Conversions</h1>
            </>
          ) : (
            <h2 className="text-2xl font-black sm:text-3xl">Conversions</h2>
          )}
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
        className="cartoon-panel grid gap-4 rounded-[24px] bg-white p-5 sm:grid-cols-[180px_180px_auto] sm:items-end sm:p-6"
      >
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
                label="Visits"
                value={formatNumber(data.summary.totalVisits)}
                detail={`${formatNumber(data.summary.uniqueVisitors)} visitors, ${formatNumber(data.summary.uniqueSessions)} sessions`}
                bg="bg-[#d9f4ff]"
              />
              <MetricCard
                icon={<Ticket size={22} aria-hidden="true" />}
                label="Leads"
                value={formatNumber(data.summary.totalLeads)}
                detail={`${formatPercent(data.summary.leadCaptureRate)} visit-to-lead, ${formatNumber(data.summary.matchedLeads)} matched`}
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
                icon={<Percent size={22} aria-hidden="true" />}
                label="Match Rate"
                value={rates.matchRate}
                detail={`${formatNumber(data.summary.notFoundLeads)} non-matches in this window`}
                bg="bg-[#e7f7d9]"
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

            <section className="grid gap-6">
              <Panel title="Traffic Sources" subtitle="Visits, lead capture, and paid orders by acquisition source.">
                <DataTable
                  columns={["Source", "Medium", "Campaign", "Referrer", "Visits", "Lead Rate", "Paid Rate", "Revenue"]}
                  rows={data.visitAttribution.map((item) => [
                    item.source,
                    item.medium,
                    item.campaign,
                    item.referrerDomain,
                    formatNumber(item.visits),
                    formatPercent(item.leadRate),
                    formatPercent(item.paidRate),
                    formatMoney(item.revenueCents),
                  ])}
                  empty="No visit attribution in this window."
                />
              </Panel>
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
              <Panel
                title="Organic Google Queries"
                subtitle={
                  data.organicSearch.status.connected
                    ? `Live Search Console data for ${data.organicSearch.status.siteUrl}.`
                    : "Search Console query performance for this date window."
                }
              >
                <DataTable
                  columns={["Query", "Clicks", "Impressions", "CTR", "Avg Position"]}
                  rows={data.organicSearch.rows.map((item) => [
                    item.term,
                    formatNumber(item.clicks),
                    formatNumber(item.impressions),
                    formatPercent(item.ctr),
                    item.position.toFixed(1),
                  ])}
                  empty={data.organicSearch.status.error ?? "No organic Google query data in this window."}
                />
              </Panel>

              <Panel
                title="Tagged Search Terms"
                subtitle="Paid-search or manually tagged query terms captured through UTM term values."
              >
                <DataTable
                  columns={["Term", "Visits", "Leads", "Paid", "Revenue"]}
                  rows={data.searchTerms.map((item) => [
                    item.term,
                    formatNumber(item.visits),
                    formatNumber(item.leads),
                    formatNumber(item.paidOrders),
                    formatMoney(item.revenueCents),
                  ])}
                  empty="No tagged search terms in this window."
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

            <section className="grid gap-6 xl:grid-cols-2">
              <Panel
                title="Comeback Emails"
                subtitle="How many checkout reminder emails were sent and how many later converted."
              >
                <DataTable
                  columns={["Reminder", "Sent", "Converted", "Conversion Rate", "Revenue"]}
                  rows={[
                    [
                      data.reminderPerformance.firstReminder.label,
                      formatNumber(data.reminderPerformance.firstReminder.sent),
                      formatNumber(data.reminderPerformance.firstReminder.convertedOrders),
                      formatPercent(data.reminderPerformance.firstReminder.conversionRate),
                      formatMoney(data.reminderPerformance.firstReminder.convertedRevenueCents),
                    ],
                    [
                      data.reminderPerformance.secondReminder.label,
                      formatNumber(data.reminderPerformance.secondReminder.sent),
                      formatNumber(data.reminderPerformance.secondReminder.convertedOrders),
                      formatPercent(data.reminderPerformance.secondReminder.conversionRate),
                      formatMoney(data.reminderPerformance.secondReminder.convertedRevenueCents),
                    ],
                  ]}
                  empty="No comeback emails in this window."
                />
              </Panel>

              <Panel
                title="Comeback Email Notes"
                subtitle="Current automation timing and incentive."
              >
                <DataTable
                  columns={["Setting", "Value"]}
                  rows={[
                    ["First reminder", "2 hours after a matched checkout starts"],
                    ["Second reminder", "24 hours after a matched checkout starts"],
                    ["Coupon code", "COMEBACK25"],
                    ["Offer", "25% off the Secret Mouse Tickets fee"],
                  ]}
                  empty="No reminder settings available."
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
              Choose a date window to see the current funnel, revenue, coupons, attribution,
              recent checkout starts, and organic search performance.
            </p>
          </section>
      )}

      <section className="cartoon-panel overflow-hidden rounded-[24px] bg-white">
        <div className="border-b-4 border-[#120f17] px-5 py-4">
          <h2 className="text-2xl font-black">Top Banner</h2>
          <p className="mt-1 text-sm font-semibold leading-6 text-[#3e304d]">
            Edit the homepage promo banner text and choose the main and highlighted text colors.
          </p>
        </div>

        <div className="grid gap-5 p-5 sm:p-6">
          {bannerError ? (
            <p className="rounded-[16px] border-[3px] border-[#120f17] bg-[#ffdfe7] px-4 py-3 text-sm font-bold">
              {bannerError}
            </p>
          ) : null}

          {bannerStatus === "loading" && !bannerSettings ? (
            <p className="text-sm font-black text-[#5d45b5]">Loading banner settings...</p>
          ) : null}

          {bannerSettings ? (
            <>
              <div
                className="w-fit max-w-full rounded-[18px] border-[3px] border-[#120f17] bg-[#ffbd38] px-4 py-2.5 text-center text-lg font-black shadow-[5px_5px_0_#120f17] sm:px-6 sm:text-xl"
                style={{ color: bannerSettings.textColor }}
              >
                {bannerSettings.prefix}{" "}
                <span style={{ color: bannerSettings.highlightColor }}>
                  {bannerSettings.highlight}
                </span>{" "}
                {bannerSettings.suffix}
              </div>

              <form
                onSubmit={saveBannerSettings}
                className="grid gap-4 rounded-[18px] border-[3px] border-[#120f17] bg-[#fffaf0] p-4 lg:grid-cols-2"
              >
                <label className="grid gap-2 text-sm font-bold lg:col-span-2">
                  Text Before Highlight
                  <input
                    value={bannerSettings.prefix}
                    onChange={(event) =>
                      setBannerSettings((current) =>
                        current ? { ...current, prefix: event.target.value } : current
                      )
                    }
                    className="h-11 rounded-[12px] border-[3px] border-[#120f17] bg-white px-3 font-semibold"
                    disabled={bannerStatus !== "idle"}
                  />
                </label>
                <label className="grid gap-2 text-sm font-bold">
                  Highlighted Text
                  <input
                    value={bannerSettings.highlight}
                    onChange={(event) =>
                      setBannerSettings((current) =>
                        current ? { ...current, highlight: event.target.value } : current
                      )
                    }
                    className="h-11 rounded-[12px] border-[3px] border-[#120f17] bg-white px-3 font-semibold"
                    disabled={bannerStatus !== "idle"}
                  />
                </label>
                <label className="grid gap-2 text-sm font-bold">
                  Text After Highlight
                  <input
                    value={bannerSettings.suffix}
                    onChange={(event) =>
                      setBannerSettings((current) =>
                        current ? { ...current, suffix: event.target.value } : current
                      )
                    }
                    className="h-11 rounded-[12px] border-[3px] border-[#120f17] bg-white px-3 font-semibold"
                    disabled={bannerStatus !== "idle"}
                  />
                </label>
                <label className="grid gap-2 text-sm font-bold">
                  Main Text Color
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={bannerSettings.textColor}
                      onChange={(event) =>
                        setBannerSettings((current) =>
                          current ? { ...current, textColor: event.target.value } : current
                        )
                      }
                      className="h-11 w-14 rounded-[12px] border-[3px] border-[#120f17] bg-white px-1"
                      disabled={bannerStatus !== "idle"}
                    />
                    <input
                      value={bannerSettings.textColor}
                      onChange={(event) =>
                        setBannerSettings((current) =>
                          current ? { ...current, textColor: event.target.value } : current
                        )
                      }
                      className="h-11 flex-1 rounded-[12px] border-[3px] border-[#120f17] bg-white px-3 font-semibold uppercase"
                      disabled={bannerStatus !== "idle"}
                    />
                  </div>
                </label>
                <label className="grid gap-2 text-sm font-bold">
                  Highlight Color
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={bannerSettings.highlightColor}
                      onChange={(event) =>
                        setBannerSettings((current) =>
                          current
                            ? { ...current, highlightColor: event.target.value }
                            : current
                        )
                      }
                      className="h-11 w-14 rounded-[12px] border-[3px] border-[#120f17] bg-white px-1"
                      disabled={bannerStatus !== "idle"}
                    />
                    <input
                      value={bannerSettings.highlightColor}
                      onChange={(event) =>
                        setBannerSettings((current) =>
                          current
                            ? { ...current, highlightColor: event.target.value }
                            : current
                        )
                      }
                      className="h-11 flex-1 rounded-[12px] border-[3px] border-[#120f17] bg-white px-3 font-semibold uppercase"
                      disabled={bannerStatus !== "idle"}
                    />
                  </div>
                </label>

                <div className="lg:col-span-2">
                  <button
                    type="submit"
                    disabled={bannerStatus !== "idle"}
                    className="inline-flex h-11 items-center justify-center rounded-[14px] border-4 border-[#120f17] bg-[#ffbd38] px-4 font-black shadow-[4px_4px_0_#120f17] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {bannerStatus === "saving" ? "Saving..." : "Save Banner"}
                  </button>
                </div>
              </form>
            </>
          ) : null}
        </div>
      </section>

      <section className="cartoon-panel overflow-hidden rounded-[24px] bg-white">
        <button
          type="button"
          onClick={() => setCouponOpen((current) => !current)}
          className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
        >
          <div>
            <h2 className="text-2xl font-black">Coupon Management</h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-[#3e304d]">
              Add, update, pause, or remove coupon codes without touching the database directly.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {couponStatus !== "idle" ? (
              <p className="text-sm font-black text-[#5d45b5]">
                {couponStatus === "loading" ? "Loading coupons..." : "Saving coupons..."}
              </p>
            ) : null}
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border-[3px] border-[#120f17] bg-[#fff7de]">
              {couponOpen ? <ChevronUp size={22} aria-hidden="true" /> : <ChevronDown size={22} aria-hidden="true" />}
            </span>
          </div>
        </button>

        {couponOpen ? (
          <div className="grid gap-5 border-t-4 border-[#120f17] p-5 sm:p-6">
            {couponError ? (
              <p className="rounded-[16px] border-[3px] border-[#120f17] bg-[#ffdfe7] px-4 py-3 text-sm font-bold">
                {couponError}
              </p>
            ) : null}

            <form
              onSubmit={createCoupon}
              className="grid gap-4 rounded-[18px] border-[3px] border-[#120f17] bg-[#fffaf0] p-4 lg:grid-cols-5"
            >
              <label className="grid gap-2 text-sm font-bold">
                Code
                <input
                  value={draftCoupon.code}
                  onChange={(event) =>
                    setDraftCoupon((current) => ({
                      ...current,
                      code: event.target.value.toUpperCase(),
                    }))
                  }
                  className="h-11 rounded-[12px] border-[3px] border-[#120f17] bg-white px-3 font-semibold uppercase"
                  placeholder="SUMMERDEAL25"
                />
              </label>
              <label className="grid gap-2 text-sm font-bold">
                Discount ($)
                <input
                  value={draftCoupon.discountDollars}
                  onChange={(event) =>
                    setDraftCoupon((current) => ({
                      ...current,
                      discountDollars: event.target.value,
                    }))
                  }
                  className="h-11 rounded-[12px] border-[3px] border-[#120f17] bg-white px-3 font-semibold"
                  placeholder="14.25"
                />
              </label>
              <label className="grid gap-2 text-sm font-bold">
                Max Redemptions
                <input
                  value={draftCoupon.maxRedemptions}
                  onChange={(event) =>
                    setDraftCoupon((current) => ({
                      ...current,
                      maxRedemptions: event.target.value,
                    }))
                  }
                  className="h-11 rounded-[12px] border-[3px] border-[#120f17] bg-white px-3 font-semibold"
                  placeholder="Unlimited"
                />
              </label>
              <label className="grid gap-2 text-sm font-bold">
                Expires
                <input
                  type="date"
                  value={draftCoupon.expiresAt}
                  onChange={(event) =>
                    setDraftCoupon((current) => ({ ...current, expiresAt: event.target.value }))
                  }
                  className="h-11 rounded-[12px] border-[3px] border-[#120f17] bg-white px-3 font-semibold"
                />
              </label>
              <label className="flex items-end gap-3 text-sm font-bold">
                <input
                  type="checkbox"
                  checked={draftCoupon.active}
                  onChange={(event) =>
                    setDraftCoupon((current) => ({ ...current, active: event.target.checked }))
                  }
                  className="h-5 w-5 accent-[#5d45b5]"
                />
                Active
              </label>

              <button
                type="submit"
                disabled={couponStatus !== "idle"}
                className="inline-flex h-11 items-center justify-center rounded-[14px] border-4 border-[#120f17] bg-[#ffbd38] px-4 font-black shadow-[4px_4px_0_#120f17] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 lg:col-span-5 lg:w-fit"
              >
                Add Coupon
              </button>
            </form>

            <div className="grid gap-4">
              {coupons.map((coupon) => (
                <CouponEditor
                  key={coupon.id}
                  coupon={coupon}
                  disabled={couponStatus !== "idle"}
                  onChange={(next) =>
                    setCoupons((current) =>
                      current.map((item) => (item.id === next.id ? next : item))
                    )
                  }
                  onSave={saveCoupon}
                  onDelete={deleteCoupon}
                />
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </section>
  );
}

export default function AdminConversionsPage() {
  return (
    <main className="brand-page min-h-screen px-5 py-8 text-[#120f17]">
      <section className="mx-auto grid max-w-7xl gap-6">
        <AdminConversionsDashboard />
      </section>
    </main>
  );
}

function CouponEditor({
  coupon,
  disabled,
  onChange,
  onSave,
  onDelete,
}: {
  coupon: ManagedCoupon;
  disabled: boolean;
  onChange: (coupon: ManagedCoupon) => void;
  onSave: (coupon: ManagedCoupon) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <div className="grid gap-4 rounded-[18px] border-[3px] border-[#120f17] bg-[#efe8ff] p-4 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.9fr_auto] lg:items-end">
      <label className="grid gap-2 text-sm font-bold">
        Code
        <input
          value={coupon.code}
          onChange={(event) => onChange({ ...coupon, code: event.target.value.toUpperCase() })}
          className="h-11 rounded-[12px] border-[3px] border-[#120f17] bg-white px-3 font-semibold uppercase"
          disabled={disabled}
        />
      </label>
      <label className="grid gap-2 text-sm font-bold">
        Discount ($)
        <input
          value={coupon.discountDollars}
          onChange={(event) => onChange({ ...coupon, discountDollars: event.target.value })}
          className="h-11 rounded-[12px] border-[3px] border-[#120f17] bg-white px-3 font-semibold"
          disabled={disabled}
        />
      </label>
      <label className="grid gap-2 text-sm font-bold">
        Max Redemptions
        <input
          value={coupon.maxRedemptions ?? ""}
          onChange={(event) =>
            onChange({
              ...coupon,
              maxRedemptions: event.target.value ? Number(event.target.value) : null,
            })
          }
          className="h-11 rounded-[12px] border-[3px] border-[#120f17] bg-white px-3 font-semibold"
          disabled={disabled}
        />
      </label>
      <label className="grid gap-2 text-sm font-bold">
        Expires
        <input
          type="date"
          value={coupon.expiresAt ?? ""}
          onChange={(event) => onChange({ ...coupon, expiresAt: event.target.value || null })}
          className="h-11 rounded-[12px] border-[3px] border-[#120f17] bg-white px-3 font-semibold"
          disabled={disabled}
        />
      </label>
      <div className="grid gap-2">
        <label className="flex items-center gap-2 text-sm font-bold">
          <input
            type="checkbox"
            checked={coupon.active}
            onChange={(event) => onChange({ ...coupon, active: event.target.checked })}
            className="h-5 w-5 accent-[#5d45b5]"
            disabled={disabled}
          />
          Active
        </label>
        <p className="text-xs font-bold text-[#3e304d]">
          Used {formatNumber(coupon.redemptionCount)}
          {coupon.maxRedemptions ? ` of ${formatNumber(coupon.maxRedemptions)}` : ""}
        </p>
      </div>

      <div className="flex flex-wrap gap-3 lg:col-span-5">
        <button
          type="button"
          onClick={() => onSave(coupon)}
          disabled={disabled}
          className="inline-flex h-11 items-center justify-center rounded-[14px] border-4 border-[#120f17] bg-[#ffbd38] px-4 font-black shadow-[4px_4px_0_#120f17] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Save Coupon
        </button>
        <button
          type="button"
          onClick={() => onDelete(coupon.id)}
          disabled={disabled}
          className="inline-flex h-11 items-center justify-center rounded-[14px] border-4 border-[#120f17] bg-white px-4 font-black shadow-[4px_4px_0_#120f17] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Delete Coupon
        </button>
      </div>
    </div>
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

function formatPercent(value: number) {
  return `${(value || 0).toFixed(1)}%`;
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

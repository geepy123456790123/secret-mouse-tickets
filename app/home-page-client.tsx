"use client";

import { PRICE_LABEL } from "@/lib/pricing";
import Image from "next/image";
import Link from "next/link";
import {
  BadgeCheck,
  ShieldCheck,
  ChevronDown,
  ExternalLink,
  Mail,
  Quote,
  Search,
  Sparkles,
} from "lucide-react";
import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { addDays, formatDate } from "@/lib/dates";
import { MarketingHeader } from "@/components/marketing-header";
import { homeFaqItems as faqItems } from "@/lib/homepage-copy";
import { SiteFooter } from "@/components/site-footer";
import type { TopBannerSettings } from "@/lib/site-settings";
import type { TicketOfferPreview } from "@/lib/ticket-offers";
import { SupportChat } from "./support-chat";

type EventSummary = {
  eventPageUrl: string;
  infoBannerFirst: string;
  eventStartDate: string;
  eventEndDate: string;
  validStartDate: string;
  validEndDate: string;
  ticketOfferPreview: TicketOfferPreview | null;
};

type EligibilityResult =
  | {
      outcome: "matched";
      leadId: string;
      event: EventSummary;
    }
  | {
      outcome: "not_found";
      message: string;
    };

type Attribution = {
  visitId: string | null;
  sessionId: string | null;
  visitorId: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  landingPage: string | null;
  referrer: string | null;
  referrerDomain: string | null;
  gclid: string | null;
  fbclid: string | null;
  msclkid: string | null;
};

const defaultForm = {
  visitStartDate: "2026-09-15",
  visitEndDate: "2026-09-18",
  themeParkDays: 3,
  guests10Plus: 2,
  guests3To9: 1,
  email: "",
};

const testimonials = [
  {
    name: "Megan R.",
    initials: "MR",
    amount: "$327",
    text: "Secret Mouse Tickets found an incredible discount for our family of four doing five days at WDW. We used their link, bought directly from Disney, and saved $327!",
    bg: "bg-[#ffbd38]",
  },
  {
    name: "Jason P.",
    initials: "JP",
    amount: "$312",
    text: "I had no idea these group and convention rates were out there. Our dates matched, and our Disney ticket savings were over $300.",
    bg: "bg-[#8f72f2]",
  },
  {
    name: "Priya S.",
    initials: "PS",
    amount: "$289",
    text: "We checked our dates on a whim and got the Disney ticket sale link after checkout. The process was clear, and we saved $289 buying from Disney.",
    bg: "bg-[#ff7f98]",
  },
];

export function HomePageClient({ topBanner }: { topBanner: TopBannerSettings }) {
  const [form, setForm] = useState(defaultForm);
  const [result, setResult] = useState<EligibilityResult | null>(null);
  const [status, setStatus] = useState<"idle" | "checking" | "checkout">("idle");
  const [error, setError] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const matchCardRef = useRef<HTMLElement | null>(null);

  const totalGuests = useMemo(
    () => Number(form.guests10Plus) + Number(form.guests3To9),
    [form.guests10Plus, form.guests3To9]
  );

  useEffect(() => {
    const attribution = getAttribution();
    if (!attribution.visitId) {
      return;
    }

    void fetch("/api/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(attribution),
      keepalive: true,
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (result?.outcome !== "matched") return;

    const handle = window.setTimeout(() => {
      window.requestAnimationFrame(() => {
        const matchCard = matchCardRef.current;
        if (!matchCard) return;

        const targetTop = matchCard.getBoundingClientRect().top + window.scrollY - 18;
        window.scrollTo({ top: Math.max(targetTop, 0), behavior: "smooth" });
      });
    }, 100);

    return () => window.clearTimeout(handle);
  }, [result]);

  function updateVisitStartDate(visitStartDate: string) {
    setForm((current) => ({
      ...current,
      visitStartDate,
      visitEndDate: /^\d{4}-\d{2}-\d{2}$/.test(visitStartDate)
        ? addDays(visitStartDate, 3)
        : current.visitEndDate,
    }));
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResult(null);
    setStatus("checking");

    const response = await fetch("/api/eligibility", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, attribution: getAttribution() }),
    });

    const payload = (await response.json()) as EligibilityResult & { error?: string };
    setStatus("idle");

    if (!response.ok) {
      setError(payload.error ?? "Unable to check these dates right now.");
      return;
    }

    setResult(payload);
  }

  async function startCheckout() {
    if (!result || result.outcome !== "matched") {
      return;
    }

    setError("");
    setStatus("checkout");

    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId: result.leadId, couponCode }),
    });
    const payload = (await response.json()) as { checkoutUrl?: string; error?: string };

    if (!response.ok || !payload.checkoutUrl) {
      setStatus("idle");
      setError(payload.error ?? "Checkout is unavailable right now.");
      return;
    }

    window.location.href = payload.checkoutUrl;
  }

  return (
    <main className="brand-page polished-page home-redesign relative isolate min-h-screen">
      <MarketingHeader />
      {topBanner.enabled ? (
        <div className="promotion-wrap">
          <div
            className="promotion-banner"
            style={{ color: topBanner.textColor }}
          >
            {topBanner.prefix}{" "}
            <span style={{ color: topBanner.highlightColor }}>{topBanner.highlight}</span>{" "}
            {topBanner.suffix}
          </div>
        </div>
      ) : null}

      <section className="home-hero">
        <div className="hero-grid">
        <div className="hero-story">
          <div className="hero-copy">
            <h1>More Disney magic.<br /><span>Less ticket guesswork.</span></h1>
            <p className="hero-description">
              Find Disney Group &amp; Convention ticket offers for your travel dates.
              Check for free, then buy your park tickets directly from Disney.
            </p>
          </div>
          <div className="hero-price">
            <strong>{PRICE_LABEL} <span>one-time matching fee</span></strong>
            <p>Only if you find a match and choose to continue. Disney tickets are purchased separately.</p>
          </div>
          <div className="savings-guarantee">
            <ShieldCheck size={25} aria-hidden="true" />
            <div><strong>Save more than our fee. Guaranteed.</strong>
              <p>If you don&apos;t come out ahead after our service fee, we&apos;ll refund it. <Link href="/terms-of-service">See guarantee details</Link>.</p>
            </div>
          </div>
          <div className="hero-photo">
            <Image src="/secret-mouse-tickets-hero.jpg" alt="A family enjoying a sunny day on Main Street at Walt Disney World" width={1536} height={1024} unoptimized priority />
          </div>
        </div>

        <div className="hero-checker">
          <form
            onSubmit={submitForm}
            id="check-dates"
            className="date-checker"
          >
            <div className="checker-heading">
              <h2>Find an offer for your trip</h2>
              <span className="rounded-full border-[3px] border-[#120f17] bg-[#d8c6ff] px-3 py-1 text-sm font-bold">
                {totalGuests} guests
              </span>
            </div>

            <p className="checker-intro">Free date check · No payment details needed</p>

            <div className="checker-fields">
              <label className="grid gap-2 text-sm font-bold">
                Visit Start Date
                <input
                  type="date"
                  required
                  value={form.visitStartDate}
                  onChange={(event) => updateVisitStartDate(event.target.value)}
                  className="h-12 rounded-[14px] border-[3px] border-[#120f17] bg-[#fffaf0] px-3 text-base font-black"
                />
              </label>
              <label className="grid gap-2 text-sm font-bold">
                Visit End Date
                <input
                  type="date"
                  required
                  value={form.visitEndDate}
                  onChange={(event) => setForm({ ...form, visitEndDate: event.target.value })}
                  className="h-12 rounded-[14px] border-[3px] border-[#120f17] bg-[#fffaf0] px-3 text-base font-black"
                />
              </label>
              <label className="grid gap-2 text-sm font-bold">
                Theme Park Days
                <input
                  type="number"
                  min="1"
                  required
                  value={form.themeParkDays}
                  onChange={(event) =>
                    setForm({ ...form, themeParkDays: Number(event.target.value) })
                  }
                  className="h-12 rounded-[14px] border-[3px] border-[#120f17] bg-[#fffaf0] px-3 text-base font-semibold"
                />
              </label>
              <label className="grid gap-2 text-sm font-bold">
                Guests Ages 10+
                <input
                  type="number"
                  min="0"
                  required
                  value={form.guests10Plus}
                  onChange={(event) =>
                    setForm({ ...form, guests10Plus: Number(event.target.value) })
                  }
                  className="h-12 rounded-[14px] border-[3px] border-[#120f17] bg-[#fffaf0] px-3 text-base font-semibold"
                />
              </label>
              <label className="grid gap-2 text-sm font-bold">
                Guests Ages 3-9
                <input
                  type="number"
                  min="0"
                  required
                  value={form.guests3To9}
                  onChange={(event) =>
                    setForm({ ...form, guests3To9: Number(event.target.value) })
                  }
                  className="h-12 rounded-[14px] border-[3px] border-[#120f17] bg-[#fffaf0] px-3 text-base font-semibold"
                />
              </label>
              <label className="grid gap-2 text-sm font-bold">
                Email
                <span className="relative">
                  <Mail
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#5d45b5]"
                    size={18}
                    aria-hidden="true"
                  />
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                    className="h-12 w-full rounded-[14px] border-[3px] border-[#120f17] bg-[#fffaf0] px-10 text-base font-semibold"
                    placeholder="you@example.com"
                  />
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={status === "checking"}
              className="mt-5 inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-[16px] border-4 border-[#120f17] bg-[#ffbd38] px-5 text-lg font-bold text-[#120f17] shadow-[5px_5px_0_#120f17] transition hover:-translate-y-0.5 hover:shadow-[7px_7px_0_#120f17] disabled:cursor-not-allowed disabled:opacity-70"
            >
              <Search size={20} aria-hidden="true" />
              {status === "checking" ? "Checking dates..." : "Check my dates — free"}
            </button>
            <p className="mt-3 text-center text-sm font-bold leading-6 text-[#3e304d]">
              If you match, choose whether to get your Disney purchase link for {PRICE_LABEL}. No subscription.
            </p>
          </form>

          {error && (
            <p className="rounded-[18px] border-4 border-[#120f17] bg-[#ffdfe7] px-4 py-3 text-sm font-bold text-[#120f17] shadow-[5px_5px_0_#120f17]">
              {error}
            </p>
          )}

          {result?.outcome === "not_found" && (
            <section className="rounded-[20px] border-4 border-[#120f17] bg-white p-5 shadow-[6px_6px_0_#120f17]">
              <p className="text-lg font-bold">{result.message}</p>
            </section>
          )}

          {result?.outcome === "matched" && (
            <section
              ref={matchCardRef}
              className="matched-offer relative overflow-hidden rounded-[24px] border-4 border-[#120f17] bg-[#efe8ff] p-5 shadow-[8px_8px_0_#120f17]"
            >
              <div className="relative z-10">
              <p className="inline-flex items-center gap-2 rounded-full border-[3px] border-[#120f17] bg-white px-3 py-2 text-sm font-bold text-[#5d45b5]">
                <BadgeCheck size={17} aria-hidden="true" />
                Match found
              </p>
              <h2 className="mt-4 text-2xl font-bold leading-tight sm:text-3xl">
                We found an offer for your dates.
              </h2>

              <div className="mt-4 rounded-[18px] border-[3px] border-[#120f17] bg-white p-4">
                <p className="text-sm font-black uppercase text-[#5d45b5]">Your matched offer</p>
                <p className="mt-1 text-lg font-black leading-6 text-[#120f17]">
                  {result.event.infoBannerFirst}
                </p>
                <p className="mt-2 text-sm font-semibold leading-6 text-[#3e304d]">
                  Tickets available through this link are valid from {" "}
                  <span className="font-black text-[#120f17]">
                    {formatDate(result.event.validStartDate)}
                  </span>{" "}
                  to {" "}
                  <span className="font-black text-[#120f17]">
                    {formatDate(result.event.validEndDate)}
                  </span>
                  .
                </p>
              </div>

              {result.event.ticketOfferPreview && (
                <TicketOfferExamples preview={result.event.ticketOfferPreview} />
              )}

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <MatchStep number="1" text={`Pay our one-time ${PRICE_LABEL} matching fee.`} />
                <MatchStep number="2" text="Receive your matched Disney sale-page link by email." />
                <MatchStep number="3" text="Buy your park tickets directly from Disney." />
              </div>

              <div className="savings-guarantee savings-guarantee-compact">
                <ShieldCheck size={23} aria-hidden="true" />
                <div><strong>Your savings are guaranteed.</strong><p>Come out ahead after our fee, or get your service fee back. <Link href="/terms-of-service">See details</Link>.</p></div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
                <label className="grid gap-2 text-sm font-bold">
                  Coupon Code
                  <input
                    value={couponCode}
                    onChange={(event) => setCouponCode(event.target.value)}
                    className="h-12 rounded-[14px] border-[3px] border-[#120f17] bg-white px-3 text-base font-semibold uppercase"
                    placeholder="Optional"
                  />
                </label>
                <button
                  type="button"
                  onClick={startCheckout}
                  disabled={status === "checkout"}
                  className="inline-flex h-12 items-center justify-center gap-2 self-end rounded-[16px] border-4 border-[#120f17] bg-[#8f72f2] px-5 font-bold text-white shadow-[5px_5px_0_#120f17] transition hover:-translate-y-0.5 hover:shadow-[7px_7px_0_#120f17] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <ExternalLink size={18} aria-hidden="true" />
                  {status === "checkout" ? "Opening..." : `Get my Disney link — ${PRICE_LABEL}`}
                </button>
              </div>
              <p className="mt-3 text-center text-xs font-bold leading-5 text-[#3e304d]">
                One-time fee. No subscription. Secure payment through Square or PayPal.
              </p>
              </div>
            </section>
          )}

          <section className="purchase-reassurance" aria-label="How your purchase works">
            <CompactBenefit icon={<BadgeCheck size={19} aria-hidden="true" />} iconBackground="bg-[#f1ecf8]" text="Your park tickets come directly from Disney." />
            <CompactBenefit icon={<Mail size={19} aria-hidden="true" />} iconBackground="bg-[#f1ecf8]" text="Your matched purchase link is delivered by email." />
          </section>
          <p className="service-note">
            Independent matching service. Not affiliated with Disney.
            Offer eligibility, pricing, and park reservations are subject to Disney&apos;s terms.
          </p>
        </div>
        </div>
      </section>

      <section className="how-section" id="how-it-works">
        <div className="section-container">
          <div className="section-heading"><p className="section-label">A simpler way to plan</p><h2>From your dates to Disney&apos;s checkout.</h2></div>
          <div className="how-steps">
            <div><span className="step-number">01</span><h3>Check your dates</h3><p>Enter your travel dates and party details. We check active ticket offer windows.</p></div>
            <div><span className="step-number">02</span><h3>Get your matched link</h3><p>If you find a match, pay a one-time {PRICE_LABEL} service fee to receive the Disney sale-page link.</p></div>
            <div><span className="step-number">03</span><h3>Buy directly from Disney</h3><p>Review Disney&apos;s prices and offer terms, then purchase your park tickets on Disney&apos;s site.</p></div>
          </div>
        </div>
      </section>

      <section className="stories-section">
        <div className="mx-auto w-full max-w-7xl px-5 pb-16 pt-3 lg:px-8 lg:pb-20 lg:pt-4">
        <div className="section-heading">
          <p className="section-label">Customer stories</p>
          <h2>A little planning. More room in the budget.</h2>
          <p>Individual customer experiences. Savings vary by dates and tickets.</p>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          {testimonials.map((testimonial) => (
            <article key={testimonial.name} className="testimonial-card">
              <div className="cartoon-panel relative min-h-[220px] rounded-[24px] bg-white p-5">
                <div className="relative z-10">
                  <div className="mb-4 flex items-center gap-2">
                    <Quote className="text-[#b8afc4]" size={34} aria-hidden="true" />
                  </div>
                  <p className="text-base font-semibold leading-7 text-[#6a6170]">
                    &ldquo;{testimonial.text}&rdquo;
                  </p>
                  <p className="mt-5 inline-flex rounded-full border-[3px] border-[#120f17] bg-[#fff7de] px-3 py-1 text-sm font-black text-[#5d45b5]">
                    Savings: {testimonial.amount}
                  </p>
                </div>
              </div>

              <div className="ml-8 flex items-center gap-4">
                <span
                  className={`inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-4 border-[#120f17] ${testimonial.bg} text-xl font-black text-white shadow-[4px_4px_0_#120f17]`}
                >
                  {testimonial.initials}
                </span>
                <div>
                  <h3 className="text-xl font-black text-[#5d45b5]">{testimonial.name}</h3>
                  <p className="text-sm font-bold text-[#6a6170]">Secret Mouse Tickets customer</p>
                </div>
              </div>
            </article>
          ))}
        </div>
        </div>
      </section>

      <section className="faq-section" id="faq">
        <div className="mx-auto w-full max-w-7xl px-5 pb-8 lg:px-8 lg:pb-12">
        <div className="faq-layout">
          <div className="faq-heading">
            <p className="section-label">Before you book</p>
            <h2 className="mt-2 text-2xl font-bold leading-tight text-[#120f17]">
              Good questions. Clear answers.
            </h2>
          </div>

          <div className="faq-list">
            {faqItems.map((item, index) => (
              <details
                key={item.question}
                open={index === 0}
                className="group rounded-[18px] border-[3px] border-[#120f17] bg-[#fffaf0] px-4 py-3"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-black text-[#120f17] marker:content-none">
                  <span>{item.question}</span>
                  <ChevronDown
                    size={20}
                    strokeWidth={3}
                    className="shrink-0 transition-transform group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                <p className="mt-2 text-sm font-semibold leading-6 text-[#3e304d]">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap justify-center gap-x-6 gap-y-3 border-t-[3px] border-[#120f17] pt-5 text-sm font-black text-[#5d45b5]">
            <Link
              href="/how-it-works"
              className="underline decoration-2 underline-offset-4"
            >
              How it works
            </Link>
            <Link
              href="/disney-world-group-convention-tickets"
              className="underline decoration-2 underline-offset-4"
            >
              Group &amp; Convention Tickets Explained
            </Link>
          </div>
        </div>
        </div>
      </section>
      <section className="final-cta section-container">
        <div><h2>Start with your dates.</h2><p>Your date check is free. You decide what happens next.</p></div>
        <a className="primary-link" href="#check-dates">Check my dates — free <Search size={18} aria-hidden="true" /></a>
      </section>
      <div className="marketing-footer"><p>Secret Mouse Tickets · Independent matching service</p>

        <SiteFooter compact className="max-w-[calc(100%-2.5rem)]" />
      </div>
      <SupportChat />
    </main>
  );
}

function TicketOfferExamples({ preview }: { preview: TicketOfferPreview }) {
  return (
    <div className="mt-4 rounded-[18px] border-[3px] border-[#120f17] bg-[#fff7de] p-4">
      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 shrink-0 text-[#5d45b5]" size={21} aria-hidden="true" />
        <div>
          <h3 className="text-lg font-black leading-6 text-[#120f17]">
            Ticket price examples from your matched offer
          </h3>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {preview.offers.slice(0, 3).map((offer) => (
          <div
            key={`${offer.productName}-${offer.priceCents}`}
            className="flex min-h-[88px] flex-col rounded-[14px] border-[3px] border-[#120f17] bg-white px-3 py-3"
          >
            <p className="text-sm font-black leading-5 text-[#120f17]">
              {formatOfferProductName(offer.productName)}
            </p>
            <p className="mt-2 text-xl font-black leading-7 text-[#5d45b5]">
              {formatOfferPrice(offer.priceCents, offer.currency, offer.priceBasis)}
            </p>
          </div>
        ))}
        <div className="flex min-h-[88px] flex-col rounded-[14px] border-[3px] border-[#120f17] bg-white px-3 py-3">
          <p className="text-sm font-black leading-5 text-[#120f17]">Additional Disney Magic</p>
          <p className="mt-2 text-base font-black leading-5 text-[#5d45b5]">
            Multi-day tickets include an extra Disney experience
          </p>
        </div>
      </div>

      <p className="mt-3 text-xs font-bold leading-5 text-[#3e304d]">
        Prices shown are current examples from this matched Disney Group &amp; Convention ticket
        page. Review the offer&apos;s purchase requirements and park reservation rules. Prices and availability can change. Pricing checked{" "}
        {new Intl.DateTimeFormat("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        }).format(new Date(preview.collectedAt))}
        .
      </p>
    </div>
  );
}

function formatOfferProductName(productName: string) {
  return productName
    .replace(/modal;?type=onesource/gi, "")
    .replace(/modalitytype=onesource/gi, "")
    .replace(/type=onesource/gi, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatOfferPrice(
  priceCents: number,
  currency: string,
  priceBasis: "from" | "per_day" | "per_ticket"
) {
  const price = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(priceCents / 100);
  const suffix =
    priceBasis === "per_day" ? "/Day" : priceBasis === "per_ticket" ? "/Ticket" : "";
  return `From ${price}${suffix}`;
}

function CompactBenefit({
  icon,
  iconBackground,
  text,
}: {
  icon: ReactNode;
  iconBackground: string;
  text: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-[3px] border-[#120f17] ${iconBackground}`}
      >
        {icon}
      </span>
      <p className="text-sm font-black leading-6 text-[#3e304d]">{text}</p>
    </div>
  );
}

function MatchStep({ number, text }: { number: string; text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-[16px] border-[3px] border-[#120f17] bg-white p-3">
      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#8f72f2] text-sm font-black text-white">
        {number}
      </span>
      <p className="text-sm font-bold leading-5 text-[#3e304d]">{text}</p>
    </div>
  );
}

function getAttribution(): Attribution {
  if (typeof window === "undefined") {
    return {
      visitId: null,
      sessionId: null,
      visitorId: null,
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      utmContent: null,
      utmTerm: null,
      landingPage: null,
      referrer: null,
      referrerDomain: null,
      gclid: null,
      fbclid: null,
      msclkid: null,
    };
  }

  const params = new URLSearchParams(window.location.search);
  const referrer = normalizeAttributionValue(document.referrer);

  return {
    visitId: getPersistentId("smt_visit_id", window.sessionStorage),
    sessionId: getPersistentId("smt_session_id", window.sessionStorage),
    visitorId: getPersistentId("smt_visitor_id", window.localStorage),
    utmSource: normalizeAttributionValue(params.get("utm_source")),
    utmMedium: normalizeAttributionValue(params.get("utm_medium")),
    utmCampaign: normalizeAttributionValue(params.get("utm_campaign")),
    utmContent: normalizeAttributionValue(params.get("utm_content")),
    utmTerm: normalizeAttributionValue(params.get("utm_term")),
    gclid: normalizeAttributionValue(params.get("gclid")),
    fbclid: normalizeAttributionValue(params.get("fbclid")),
    msclkid: normalizeAttributionValue(params.get("msclkid")),
    landingPage: normalizeAttributionValue(`${window.location.pathname}${window.location.search}`),
    referrer,
    referrerDomain: getReferrerDomain(referrer),
  };
}

function normalizeAttributionValue(value: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 500) : null;
}

function getPersistentId(key: string, storage: Storage) {
  const existing = storage.getItem(key);
  if (existing) {
    return existing;
  }

  const next = crypto.randomUUID();
  storage.setItem(key, next);
  return next;
}

function getReferrerDomain(referrer: string | null) {
  if (!referrer) {
    return null;
  }

  try {
    return normalizeAttributionValue(new URL(referrer).hostname.replace(/^www\./, ""));
  } catch {
    return null;
  }
}

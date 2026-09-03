"use client";

import Image from "next/image";
import Link from "next/link";
import {
  BadgeCheck,
  ChevronDown,
  ExternalLink,
  Mail,
  Quote,
  Search,
  Sparkles,
  Star,
  Waves,
} from "lucide-react";
import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { addDays, formatDate } from "@/lib/dates";
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
    text: "I had no idea these group and convention rates were out there. Our dates matched, the fee was $39, and our Disney ticket savings were over $300.",
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

const faqItems = [
  {
    question: "How do I know these ticket offers are legitimate?",
    answer:
      "Secret Mouse Tickets is a matching service. We help you find Disney Group & Convention ticket sale pages that fit your travel dates, and your actual park tickets are purchased directly through Disney's own checkout. We don't process your Disney ticket order or ask for your Disney payment information.",
  },
  {
    question: "Why isn't this offer on Disney's main ticket page?",
    answer:
      "Disney runs these Group & Convention sale pages separately from the ticket page most guests see. They're tied to specific conventions and events – not exactly hidden, just not linked from where most families start.",
  },
  {
    question: "Will this affect my park reservations or get my tickets canceled?",
    answer:
      "No. Your tickets are standard Disney tickets, bought through Disney's own checkout and covered by Disney's own terms. We never hold or issue your tickets at any point.",
  },
  {
    question: "What am I actually paying Secret Mouse Tickets for?",
    answer:
      "The matching and delivery step. We check your travel dates against active Disney Group & Convention offers and send you the correct sale page link if one matches. Disney sets the ticket price, and you complete the purchase on Disney's site.",
  },
  {
    question: "Do I need to attend a convention or belong to a group?",
    answer:
      "No. These sale pages allow qualifying public purchase. You don't need to register for a conference or belong to an organization.",
  },
  {
    question: "What if my dates don't match an offer, or I don't actually come out ahead?",
    answer:
      "If nothing matches your dates, you're not charged. If we do find a match and you still don't come out ahead of Disney's regular price after our fee, contact us and we'll make it right under our guarantee.",
  },
] as const;

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
    <main className="brand-page relative isolate min-h-screen text-[#120f17]">
      <div className="pointer-events-none absolute left-0 right-0 top-0 z-0 h-[620px] overflow-hidden sm:aspect-video sm:h-auto" aria-hidden="true">
        <img
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-[center_top] opacity-35 sm:object-center"
          src="/secret-mouse-tickets-hero.jpg"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(223,208,255,0)_0%,rgba(223,208,255,0.08)_36%,rgba(216,198,255,0.56)_74%,#d8c6ff_100%)]" />
        <div
          className="absolute inset-0 bg-[radial-gradient(circle_at_18px_18px,rgba(255,255,255,0.62)_0_2px,transparent_3px)] bg-[length:36px_36px]"
          style={{
            maskImage: "linear-gradient(180deg, transparent 0%, transparent 50%, rgba(0,0,0,0.18) 64%, rgba(0,0,0,0.58) 84%, #000 100%)",
            WebkitMaskImage: "linear-gradient(180deg, transparent 0%, transparent 50%, rgba(0,0,0,0.18) 64%, rgba(0,0,0,0.58) 84%, #000 100%)",
          }}
        />
      </div>
      {topBanner.enabled ? (
        <div className="relative z-10 mx-auto flex w-full max-w-7xl justify-center px-5 pt-5 lg:px-8">
          <div
            className="w-fit rounded-[18px] border-[3px] border-[#120f17] bg-[#ffbd38] px-4 py-2.5 text-center text-lg font-black shadow-[5px_5px_0_#120f17] sm:px-6 sm:text-xl"
            style={{ color: topBanner.textColor }}
          >
            {topBanner.prefix}{" "}
            <span style={{ color: topBanner.highlightColor }}>{topBanner.highlight}</span>{" "}
            {topBanner.suffix}
          </div>
        </div>
      ) : null}

      <section className="relative z-10 min-h-screen w-full overflow-hidden">

        <div className="relative mx-auto grid min-h-screen w-full max-w-7xl gap-8 px-5 py-6 lg:grid-cols-[0.92fr_1.08fr] lg:items-start lg:px-8">
        <div className="flex flex-col items-center justify-center gap-3 px-1 pb-4 pt-1 text-center sm:px-4 lg:self-start lg:justify-start lg:pb-0 lg:pt-6">
          <div className="w-full sm:max-w-[340px]">
            <Image
              src="/secret-mouse-tickets-logo.png"
              alt="Secret Mouse Tickets"
              width={705}
              height={607}
              unoptimized
              priority
              className="h-auto w-full object-contain"
            />
          </div>

          <div className="max-w-xl space-y-3 lg:-mt-2">
            <h1 className="text-2xl font-bold leading-tight text-[#120f17] sm:text-3xl">
              We find Group &amp; Convention ticket offers that match your travel dates so you can
              save BIG on your Walt Disney World trip.
            </h1>
            <p className="text-lg font-medium leading-8 text-[#3e304d]">
              A typical family of 4 buying park tickets for 5 days can save over $300 on tickets
              alone, thanks to discounted Disney World ticket sales that aren&apos;t advertised to
              the public.
            </p>
          </div>

          <div className="rounded-[18px] border-[3px] border-[#120f17] bg-[#fff7de] px-5 py-4 text-center text-base font-black leading-7 text-[#120f17] shadow-[4px_4px_0_#120f17] sm:text-lg sm:leading-8">
            <p>
              We guarantee you&apos;ll save money using Secret Mouse Tickets over Disney&apos;s
              regular park ticket prices - even after our fee - or your money back.
            </p>
          </div>

        </div>

        <div className="relative grid content-start gap-5">
          <form
            onSubmit={submitForm}
            className="cartoon-panel rounded-[24px] bg-white p-5 sm:p-6"
          >
            <div className="mb-5 flex items-center justify-between gap-4">
              <h2 className="text-2xl font-bold">Check Your Dates</h2>
              <span className="rounded-full border-[3px] border-[#120f17] bg-[#d8c6ff] px-3 py-1 text-sm font-bold">
                {totalGuests} guests
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
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
              {status === "checking" ? "Checking dates..." : "Check My Dates"}
            </button>
            <p className="mt-3 text-center text-sm font-bold leading-6 text-[#3e304d]">
              Free to check. You&apos;ll see our fee before you pay anything.
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
              className="relative overflow-hidden rounded-[24px] border-4 border-[#120f17] bg-[#efe8ff] p-5 shadow-[8px_8px_0_#120f17]"
            >
              <div className="relative z-10">
              <p className="inline-flex items-center gap-2 rounded-full border-[3px] border-[#120f17] bg-white px-3 py-2 text-sm font-bold text-[#5d45b5]">
                <BadgeCheck size={17} aria-hidden="true" />
                Match found
              </p>
              <h2 className="mt-4 text-2xl font-bold leading-tight sm:text-3xl">
                Your dates match a Disney Group &amp; Convention ticket offer.
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
                <MatchStep number="1" text="Pay our one-time $39 matching fee." />
                <MatchStep number="2" text="Receive your matched Disney sale-page link by email." />
                <MatchStep number="3" text="Buy your park tickets directly from Disney." />
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
                  {status === "checkout" ? "Opening..." : "Unlock My Disney Discount Link - $39"}
                </button>
              </div>
              <p className="mt-3 text-center text-xs font-bold leading-5 text-[#3e304d]">
                One-time fee. No subscription. Secure payment through Square or PayPal.
              </p>
              </div>
            </section>
          )}

          <section className="cartoon-panel grid gap-3 rounded-[22px] bg-white/95 p-5">
            <CompactBenefit
              icon={<Sparkles size={18} aria-hidden="true" />}
              iconBackground="bg-[#ffbd38]"
              text="Save up to 20%* through eligible Disney discount links."
            />
            <CompactBenefit
              icon={<Waves size={18} aria-hidden="true" />}
              iconBackground="bg-[#d8c6ff]"
              text="Eligible multi-day tickets include an extra Water Park Fun & More Visit pass."
            />
            <CompactBenefit
              icon={<BadgeCheck size={18} aria-hidden="true" />}
              iconBackground="bg-[#fff7de]"
              text="Buy your actual park tickets directly from Disney."
            />
          </section>

          <p className="rounded-[18px] bg-[#fff7de]/80 px-4 py-2 text-center text-xs font-semibold leading-5 text-[#3e304d]">
            Secret Mouse Tickets is an independent service and is not affiliated with Disney. {" "}
            *Savings based on the non-discounted price for the same ticket sold at Disney-owned and
            -operated Guest Service desks in the Central Florida area as of 7/1/2026. See our {" "}
            <Link className="text-[#5d45b5] underline underline-offset-2" href="/terms-of-service">
              Terms of Service
            </Link>{" "}
            and {" "}
            <Link className="text-[#5d45b5] underline underline-offset-2" href="/privacy-policy">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
        </div>
      </section>

      <section className="mt-6 mx-auto w-full max-w-7xl px-5 pb-16 pt-0 lg:mt-10 lg:px-8 lg:pb-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="inline-flex rounded-full border-[3px] border-[#120f17] bg-[#ffbd38] px-4 py-2 text-sm font-black text-[#120f17] shadow-[4px_4px_0_#120f17]">
            200+ families have used Secret Mouse Tickets to save an average of $336 on their
            Disney tickets.
          </p>
          <h2 className="mt-5 text-3xl font-black leading-tight text-[#120f17] sm:text-4xl">
            Families use Secret Mouse Tickets to spend less on tickets and more on Disney magic.
          </h2>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          {testimonials.map((testimonial) => (
            <article key={testimonial.name} className="grid gap-6">
              <div className="cartoon-panel relative min-h-[220px] rounded-[24px] bg-white p-5">
                <div className="absolute -bottom-4 left-10 h-8 w-8 rotate-45 border-b-4 border-r-4 border-[#120f17] bg-white" />
                <div className="relative z-10">
                  <div className="mb-4 flex items-center gap-2">
                    <Quote className="text-[#b8afc4]" size={34} aria-hidden="true" />
                    <div className="flex text-[#f07a22]" aria-label="5 star rating">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <Star
                          key={index}
                          size={24}
                          className="fill-current"
                          aria-hidden="true"
                        />
                      ))}
                    </div>
                  </div>
                  <p className="text-base font-semibold leading-7 text-[#6a6170]">
                    &ldquo;{testimonial.text}&rdquo;
                  </p>
                  <p className="mt-5 inline-flex rounded-full border-[3px] border-[#120f17] bg-[#fff7de] px-3 py-1 text-sm font-black text-[#5d45b5]">
                    Saved {testimonial.amount}
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
      </section>

      <section className="mx-auto w-full max-w-7xl px-5 pb-8 lg:px-8 lg:pb-12">
        <div className="cartoon-panel rounded-[24px] bg-white p-5 sm:p-6">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase text-[#5d45b5]">FAQ</p>
            <h2 className="mt-2 text-2xl font-bold leading-tight text-[#120f17]">
              Common questions about how this works.
            </h2>
          </div>

          <div className="mt-6 grid gap-3">
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
              How Secret Mouse Tickets Works
            </Link>
            <Link
              href="/disney-world-group-convention-tickets"
              className="underline decoration-2 underline-offset-4"
            >
              Group &amp; Convention Tickets Explained
            </Link>
          </div>
        </div>
      </section>
      <div className="hidden sm:block">
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
            Here&apos;s the special Disney ticket pricing available through your matched link
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
          <p className="text-sm font-black leading-5 text-[#120f17]">Bonus Disney Magic</p>
          <p className="mt-2 text-base font-black leading-5 text-[#5d45b5]">
            Multi-day tickets include a free Water Park Fun &amp; More pass.
          </p>
        </div>
      </div>

      <p className="mt-3 text-xs font-bold leading-5 text-[#3e304d]">
        Prices shown are current examples from this matched Disney Group &amp; Convention ticket
        page. You&apos;re not required to attend a convention or belong to a group to use these
        tickets. Prices and availability can change. Pricing checked{" "}
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

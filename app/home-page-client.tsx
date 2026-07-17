"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowDown,
  BadgeCheck,
  CircleCheck,
  Mail,
  Quote,
  Search,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Star,
  Waves,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { formatDate } from "@/lib/dates";
import { SiteFooter } from "@/components/site-footer";
import type { TopBannerSettings } from "@/lib/site-settings";
import { SupportChat } from "./support-chat";

type EventSummary = {
  eventPageUrl: string;
  infoBannerFirst: string;
  eventStartDate: string;
  eventEndDate: string;
  validStartDate: string;
  validEndDate: string;
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
    question: "Is this a scam?",
    answer:
      "No. We never sell tickets or take your Disney payment information. We match your travel dates to a real Disney Group & Convention sale page, then you buy directly from Disney using Disney's own checkout.",
  },
  {
    question: "Why isn't this offer on Disney's main ticket page?",
    answer:
      "Disney runs these Group & Convention sale pages separately from the ticket page most guests see. They're tied to specific conventions and events, not hidden, just not linked from where most families start.",
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

const priceComparisonExamples = [
  {
    date: "July 25",
    regularLabel: "Disney's Regular Price",
    eventName: "HCAF Annual Conference & Trade Show",
    regularItems: [{ label: "1-Day Magic Kingdom Ticket", price: "$184" }],
    discountedItems: [{ label: "1-Day Magic Kingdom Ticket", price: "$165.60" }],
  },
  {
    date: "October 10",
    regularLabel: "Disney's Regular Price",
    eventName: "MCE Conferences October Event",
    regularItems: [{ label: "1-Day Hollywood Studios Ticket", price: "$199" }],
    discountedItems: [{ label: "1-Day Hollywood Studios Ticket", price: "$179.10" }],
  },
  {
    date: "December 19",
    regularLabel: "Disney's Regular Price",
    eventName: "MER Conferences - Orthopedic Medicine for Primary Care",
    regularItems: [{ label: "1-Day Magic Kingdom Ticket", price: "$209" }],
    discountedItems: [{ label: "1-Day Magic Kingdom Ticket", price: "$188.10" }],
  },
] as const;

export function HomePageClient({ topBanner }: { topBanner: TopBannerSettings }) {
  const [form, setForm] = useState(defaultForm);
  const [result, setResult] = useState<EligibilityResult | null>(null);
  const [status, setStatus] = useState<"idle" | "checking" | "checkout">("idle");
  const [error, setError] = useState("");
  const [couponCode, setCouponCode] = useState("");

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
    <main className="brand-page min-h-screen text-[#120f17]">
      <div className="mx-auto flex w-full max-w-7xl justify-center px-5 pt-5 lg:px-8">
        <div
          className="w-fit rounded-[18px] border-[3px] border-[#120f17] bg-[#ffbd38] px-4 py-2.5 text-center text-lg font-black shadow-[5px_5px_0_#120f17] sm:px-6 sm:text-xl"
          style={{ color: topBanner.textColor }}
        >
          {topBanner.prefix}{" "}
          <span style={{ color: topBanner.highlightColor }}>{topBanner.highlight}</span>{" "}
          {topBanner.suffix}
        </div>
      </div>

      <section className="mx-auto grid min-h-screen w-full max-w-7xl gap-8 px-5 py-6 lg:grid-cols-[0.92fr_1.08fr] lg:items-start lg:px-8">
        <div className="flex flex-col items-center justify-center gap-3 px-1 pb-4 pt-1 text-center sm:px-4 lg:self-start lg:justify-start lg:pb-0 lg:pt-6">
          <Image
            src="/secret-mouse-tickets-logo.png"
            alt="Secret Mouse Tickets"
            width={705}
            height={607}
            unoptimized
            priority
            className="h-auto w-full max-w-[400px] object-contain"
          />

          <div className="max-w-xl space-y-3 lg:-mt-2">
            <h1 className="text-2xl font-bold leading-tight text-[#120f17] sm:text-3xl">
              We find hidden discount tickets for your Walt Disney World trip.
            </h1>
            <p className="text-lg font-medium leading-8 text-[#3e304d]">
              A typical family of 4 buying park tickets for 5 days can save over $300 on tickets
              alone, thanks to discounted Disney World ticket sales that aren&apos;t advertised to
              the public.
            </p>
          </div>

          <div className="rounded-[18px] border-[3px] border-[#120f17] bg-[#fff7de] px-5 py-4 text-center text-base font-black leading-7 text-[#120f17] shadow-[4px_4px_0_#120f17] sm:text-lg sm:leading-8">
            We guarantee you&apos;ll save money using Secret Mouse Tickets over Disney&apos;s
            regular park ticket prices - even after our fee - or your money back.
          </div>

          <DesktopSavingsShowcase />
        </div>

        <div className="grid content-center gap-5">
          <section className="cartoon-panel grid gap-3 rounded-[22px] bg-white/95 p-5">
            <div className="flex gap-3">
              <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-[3px] border-[#120f17] bg-[#ffbd38]">
                <Sparkles size={18} aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-base font-black">Savings Disney Doesn&apos;t Advertise</h2>
                <p className="text-sm font-semibold leading-6 text-[#3e304d]">
                  Save up to 20%* when you buy eligible 1-day and multi-day tickets directly
                  from Disney through our discounted ticket links.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-[3px] border-[#120f17] bg-[#d8c6ff]">
                <Waves size={18} aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-base font-black">Free Bonus Water Park Days</h2>
                <p className="text-sm font-semibold leading-6 text-[#3e304d]">
                  Multi-day Disney tickets include an extra Water Park Fun &amp; More Visit pass.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-[3px] border-[#120f17] bg-[#fff7de]">
                <ShieldCheck size={18} aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-base font-black">Our Guarantee</h2>
                <p className="text-sm font-semibold leading-6 text-[#3e304d]">
                  Disney uses dynamic pricing that changes daily, so we can&apos;t promise an exact
                  percent savings ahead of time. Here&apos;s what we do promise: if you don&apos;t
                  come out ahead of Disney&apos;s regular price after our fee, contact us and
                  we&apos;ll make it right.
                </p>
              </div>
            </div>
            <div className="rounded-[16px] border-[3px] border-[#120f17] bg-[#fff7de] px-4 py-3 text-sm font-bold leading-6 text-[#3e304d]">
              Secret Mouse Tickets finds Disney Group &amp; Convention discount ticket offers that
              match your Walt Disney World visit dates. You do not need to attend a convention or
              belong to a group to use these offers. Tickets are purchased directly from Disney.
            </div>
          </section>

          <form
            onSubmit={submitForm}
            className="cartoon-panel rounded-[24px] bg-white p-5 sm:p-6"
          >
            <div className="mb-5 flex items-center justify-between gap-4">
              <h2 className="text-2xl font-bold">Visit Details</h2>
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
                  onChange={(event) => setForm({ ...form, visitStartDate: event.target.value })}
                  className="h-12 rounded-[14px] border-[3px] border-[#120f17] bg-[#fffaf0] px-3 text-base font-semibold"
                />
              </label>
              <label className="grid gap-2 text-sm font-bold">
                Visit End Date
                <input
                  type="date"
                  required
                  value={form.visitEndDate}
                  onChange={(event) => setForm({ ...form, visitEndDate: event.target.value })}
                  className="h-12 rounded-[14px] border-[3px] border-[#120f17] bg-[#fffaf0] px-3 text-base font-semibold"
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
            <section className="rounded-[24px] border-4 border-[#120f17] bg-[#efe8ff] p-5 shadow-[8px_8px_0_#120f17]">
              <p className="inline-flex items-center gap-2 rounded-full border-[3px] border-[#120f17] bg-white px-3 py-2 text-sm font-bold text-[#5d45b5]">
                <BadgeCheck size={17} aria-hidden="true" />
                Match found
              </p>
              <h2 className="mt-4 text-2xl font-bold leading-tight">
                We found Walt Disney World&reg; Discounted Group & Convention Theme Park Tickets
                &amp; Passes that match the date of your visit!
              </h2>
              <p className="mt-3 rounded-[16px] border-[3px] border-[#120f17] bg-white px-3 py-2 text-sm font-black leading-6 text-[#120f17]">
                Matched event: {result.event.infoBannerFirst}
              </p>
              <p className="mt-3 text-sm font-semibold leading-6 text-[#3e304d]">
                Valid for {form.themeParkDays} days from {formatDate(result.event.validStartDate)} to{" "}
                {formatDate(result.event.validEndDate)}.
              </p>
              <p className="mt-3 rounded-[16px] border-[3px] border-[#120f17] bg-white px-3 py-2 text-sm font-bold leading-6 text-[#3e304d]">
                Purchase Secret Mouse Tickets access below. After checkout, we&apos;ll email you a
                personalized link to the Disney Group &amp; Convention discount page that matches
                your dates, so you can purchase your tickets directly from Disney.
              </p>
              <p className="mt-3 inline-flex rounded-full border-[3px] border-[#120f17] bg-[#fff7de] px-3 py-2 text-sm font-black leading-6 text-[#120f17]">
                Our guarantee: come out ahead of Disney&apos;s price after our fee, or your money
                back.
              </p>

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
                  <ShoppingCart size={18} aria-hidden="true" />
                  {status === "checkout" ? "Opening..." : "Continue to Checkout"}
                </button>
              </div>
            </section>
          )}

          <p className="rounded-[18px] bg-[#fff7de]/80 px-4 py-2 text-center text-xs font-semibold leading-5 text-[#3e304d]">
            Secret Mouse Tickets is an independent service and is not affiliated with Disney.{" "}
            *Savings based on the non-discounted price for the same ticket sold at Disney-owned and
            -operated Guest Service desks in the Central Florida area as of 7/1/2026. See our{" "}
            <Link className="text-[#5d45b5] underline underline-offset-2" href="/terms-of-service">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link className="text-[#5d45b5] underline underline-offset-2" href="/privacy-policy">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-5 pb-16 pt-4 lg:px-8 lg:pb-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="inline-flex rounded-full border-[3px] border-[#120f17] bg-[#ffbd38] px-4 py-2 text-sm font-black text-[#120f17] shadow-[4px_4px_0_#120f17]">
            200+ families have used Secret Mouse Tickets to save an average of $240 on their
            Disney tickets.
          </p>
          <h2 className="mt-5 text-3xl font-black leading-tight text-[#120f17] sm:text-4xl">
            Families use Secret Mouse Tickets to spend less on tickets and more on Disney magic.
          </h2>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-3">
          {testimonials.map((testimonial) => (
            <article key={testimonial.name} className="grid gap-7">
              <div className="cartoon-panel relative min-h-[260px] rounded-[24px] bg-white p-5 sm:p-6">
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

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {faqItems.map((item) => (
              <article
                key={item.question}
                className="rounded-[18px] border-[3px] border-[#120f17] bg-[#fffaf0] px-4 py-4"
              >
                <h3 className="text-lg font-black text-[#120f17]">{item.question}</h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-[#3e304d]">
                  {item.answer}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-5 pb-8 lg:px-8 lg:pb-12">
        <div className="cartoon-panel grid gap-4 rounded-[24px] bg-white p-5 sm:p-6 lg:grid-cols-2">
          <div className="grid gap-2">
            <p className="text-sm font-bold uppercase text-[#5d45b5]">Learn More</p>
            <h2 className="text-2xl font-bold leading-tight">
              Here&apos;s how Secret Mouse Tickets works.
            </h2>
            <p className="text-sm font-semibold leading-6 text-[#3e304d]">
              Start here for a clear overview of the service, what you&apos;re paying for, and how
              matching Disney discount pages can help lower your ticket cost.
            </p>
          </div>
          <div className="grid gap-3">
            <Link
              href="/how-it-works"
              className="rounded-[18px] border-[3px] border-[#120f17] bg-[#fff7de] px-4 py-3 text-left shadow-[4px_4px_0_#120f17] transition hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#120f17]"
            >
              <span className="block text-base font-black text-[#120f17]">
                How Secret Mouse Tickets Works
              </span>
              <span className="mt-1 block text-sm font-semibold leading-6 text-[#3e304d]">
                See the step-by-step process from date check to your Disney purchase link.
              </span>
            </Link>
            <Link
              href="/disney-world-group-convention-tickets"
              className="rounded-[18px] border-[3px] border-[#120f17] bg-[#efe8ff] px-4 py-3 text-left shadow-[4px_4px_0_#120f17] transition hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#120f17]"
            >
              <span className="block text-base font-black text-[#120f17]">
                Disney World Group And Convention Tickets Explained
              </span>
              <span className="mt-1 block text-sm font-semibold leading-6 text-[#3e304d]">
                Learn what these Disney ticket offers are and how to use them.
              </span>
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

function DesktopSavingsShowcase() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    const fadeTimer = window.setTimeout(() => {
      setIsFading(true);
    }, 10400);

    const nextTimer = window.setTimeout(() => {
      setActiveIndex((current) => (current + 1) % priceComparisonExamples.length);
      setIsFading(false);
    }, 11000);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(nextTimer);
    };
  }, [activeIndex]);

  const activeExample = priceComparisonExamples[activeIndex];

  return (
    <section className="hidden w-full max-w-xl pt-3 lg:block">
      <div className="cartoon-panel overflow-hidden rounded-[24px] bg-white/95 p-5">
        <div
          className={`flex items-center justify-between gap-4 transition-opacity duration-500 ${
            isFading ? "opacity-0" : "opacity-100"
          }`}
        >
          <h2 className="text-xl font-black text-[#120f17]">{activeExample.date} Ticket Prices</h2>
          <div className="flex gap-2">
            {priceComparisonExamples.map((example, index) => (
              <span
                key={example.date}
                className={`h-2.5 rounded-full border-2 border-[#120f17] transition-all ${
                  index === activeIndex ? "w-8 bg-[#8f72f2]" : "w-2.5 bg-[#fff7de]"
                }`}
                aria-hidden="true"
              />
            ))}
          </div>
        </div>

        <div
          className={`transition-opacity duration-500 ${isFading ? "opacity-0" : "opacity-100"}`}
        >
          <SavingsComparisonCard key={activeExample.date} example={activeExample} />
        </div>
      </div>
    </section>
  );
}

function SavingsComparisonCard({
  example,
}: {
  example: (typeof priceComparisonExamples)[number];
}) {
  const [phase, setPhase] = useState<"regular" | "crossed" | "discounted">("regular");

  useEffect(() => {
    const crossTimer = window.setTimeout(() => {
      setPhase("crossed");
    }, 2800);

    const discountTimer = window.setTimeout(() => {
      setPhase("discounted");
    }, 5000);

    return () => {
      window.clearTimeout(crossTimer);
      window.clearTimeout(discountTimer);
    };
  }, []);

  return (
    <div className="mt-4 grid gap-4">
      <div className="rounded-[18px] border-[3px] border-[#120f17] bg-[#fffaf0] p-4 text-left">
        <p className="text-xs font-bold uppercase tracking-wide text-[#6a6170]">
          {example.regularLabel}
        </p>
        <div className="mt-3 grid gap-3">
          {example.regularItems.map((item) => (
            <div
              key={`${example.date}-${item.label}-regular`}
              className="flex items-end justify-between gap-4 border-b-2 border-dashed border-[#d5cde0] pb-2 last:border-b-0 last:pb-0"
            >
              <span className="text-sm font-bold leading-6 text-[#3e304d]">{item.label}</span>
              <span
                className={`text-lg font-black text-[#120f17] transition-all duration-700 ${
                  phase === "regular"
                    ? "translate-y-0 opacity-100"
                    : "translate-y-0 opacity-100 line-through decoration-2 decoration-[#ff7f98]"
                }`}
              >
                {item.price}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div
        className={`flex items-center justify-center gap-2 text-[#5d45b5] transition-all duration-500 ${
          phase === "discounted"
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-2 opacity-0"
        }`}
      >
        <ArrowDown size={18} strokeWidth={3} aria-hidden="true" />
        <span className="text-xs font-black uppercase tracking-[0.18em]">
          Conference/Event Price
        </span>
        <ArrowDown size={18} strokeWidth={3} aria-hidden="true" />
      </div>

      <div
        className={`rounded-[18px] border-[3px] border-[#120f17] bg-[#efe8ff] p-4 text-left shadow-[4px_4px_0_#120f17] transition-all duration-500 ${
          phase === "discounted"
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-3 opacity-0"
        }`}
      >
        <p className="text-sm font-black leading-6 text-[#120f17]">{example.eventName}</p>
        <div className="mt-3 grid gap-3">
          {example.discountedItems.map((item) => (
            <div
              key={`${example.date}-${item.label}-discounted`}
              className="flex items-end justify-between gap-4 border-b-2 border-dashed border-[#c7bae7] pb-2 last:border-b-0 last:pb-0"
            >
              <span className="text-sm font-bold leading-6 text-[#3e304d]">{item.label}</span>
              <span className="inline-flex items-center gap-2 text-lg font-black text-[#5d45b5]">
                <CircleCheck
                  size={18}
                  strokeWidth={2.6}
                  className="text-[#8f72f2]"
                  aria-hidden="true"
                />
                {item.price}
              </span>
            </div>
          ))}
        </div>
      </div>
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

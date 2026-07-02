"use client";

import Image from "next/image";
import {
  BadgeCheck,
  Mail,
  Quote,
  Search,
  ShoppingCart,
  Sparkles,
  Star,
  Waves,
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { formatDate } from "@/lib/dates";

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
    text: "Secret Mouse Tickets found an incredible discount for our family of four doing four days at Disney World. We used their link, bought directly from Disney, and saved $327 on tickets!",
    bg: "bg-[#ffbd38]",
  },
  {
    name: "Jason P.",
    initials: "JP",
    amount: "$312",
    text: "I had no idea these group and convention rates were out there. Our dates matched, the access was $57, and our Disney ticket savings were over $300.",
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

export default function Home() {
  const [form, setForm] = useState(defaultForm);
  const [result, setResult] = useState<EligibilityResult | null>(null);
  const [status, setStatus] = useState<"idle" | "checking" | "checkout">("idle");
  const [error, setError] = useState("");
  const [couponCode, setCouponCode] = useState("");

  const totalGuests = useMemo(
    () => Number(form.guests10Plus) + Number(form.guests3To9),
    [form.guests10Plus, form.guests3To9]
  );
  const hasMultiDayBonus = Number(form.themeParkDays) > 1;

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResult(null);
    setStatus("checking");

    const response = await fetch("/api/eligibility", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
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
      <section className="mx-auto grid min-h-screen w-full max-w-7xl gap-8 px-5 py-6 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:px-8">
        <div className="flex flex-col items-center justify-center gap-3 px-1 pb-4 pt-1 text-center sm:px-4 lg:self-center lg:pb-0 lg:pt-0">
          <Image
            src="/secret-mouse-tickets-logo.png"
            alt="Secret Mouse Tickets"
            width={705}
            height={607}
            priority
            className="h-auto w-full max-w-[400px] object-contain"
          />

          <div className="max-w-xl space-y-3 lg:-mt-2">
            <h1 className="text-2xl font-bold leading-tight text-[#120f17] sm:text-3xl">
              Let our team of insiders connect you with hidden discounted tickets for your Walt
              Disney World visit.
            </h1>
            <p className="text-lg font-medium leading-8 text-[#3e304d]">
              We track discounted Disney World ticket sales that aren&apos;t advertised to the public,
              so you can save BIG on your Disney trip. A typical family of 4 doing 5 park days
              saves over $300 on tickets alone. Access to the discount costs just $57.
            </p>
          </div>
        </div>

        <div className="grid content-center gap-5">
          <p className="rounded-full bg-[#fff7de]/90 px-4 py-2 text-center text-sm font-bold text-[#5d45b5]">
            Group and convention Walt Disney World ticket discounts, open to everyone
          </p>

          <section className="cartoon-panel grid gap-3 rounded-[22px] bg-white/95 p-5">
            <div className="flex gap-3">
              <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-[3px] border-[#120f17] bg-[#ffbd38]">
                <Sparkles size={18} aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-base font-black">Advance Purchase Savings</h2>
                <p className="text-sm font-semibold leading-6 text-[#3e304d]">
                  Save up to 20%* when you buy eligible 1-day and multi-day tickets directly
                  from Disney.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-[3px] border-[#120f17] bg-[#d8c6ff]">
                <Waves size={18} aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-base font-black">Additional Disney Magic</h2>
                <p className="text-sm font-semibold leading-6 text-[#3e304d]">
                  Multi-day Disney tickets include an extra Water Park Fun & More Visit pass.
                </p>
              </div>
            </div>
            <div className="rounded-[16px] border-[3px] border-[#120f17] bg-[#fff7de] px-4 py-3 text-sm font-bold leading-6 text-[#3e304d]">
              Secret Mouse Tickets sells access to the eligible Disney discount sale page. Your
              actual theme park tickets are purchased directly from Disney.
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
                We found a hidden Disney discount sale page for your Walt Disney World visit dates!
              </h2>
              <p className="mt-3 text-base font-bold">
                Walt Disney World&reg; Discounted Group & Convention Theme Park Tickets & Passes
              </p>
              <p className="mt-3 text-sm font-semibold leading-6 text-[#3e304d]">
                Valid for {form.themeParkDays} days from {formatDate(result.event.validStartDate)} to{" "}
                {formatDate(result.event.validEndDate)}.
              </p>
              <p className="mt-3 rounded-[16px] border-[3px] border-[#120f17] bg-white px-3 py-2 text-sm font-bold leading-6 text-[#3e304d]">
                Purchase Secret Mouse Tickets access for $57. After checkout, we&apos;ll send you the
                eligible Disney sale page so you can buy your discounted tickets directly from
                Disney.
              </p>
              {hasMultiDayBonus && (
                <p className="mt-3 rounded-[16px] border-[3px] border-[#120f17] bg-[#fff7de] px-3 py-2 text-sm font-bold text-[#7b4b00]">
                  Multi-day Disney tickets purchased through the sale page include an extra Water
                  Park Fun & More Visit pass.
                </p>
              )}

              <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
                <label className="grid gap-2 text-sm font-bold">
                  Coupon or Access Code
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
                  {status === "checkout" ? "Opening..." : "Buy Access For $57"}
                </button>
              </div>
            </section>
          )}

          <p className="rounded-full bg-[#fff7de]/80 px-4 py-2 text-center text-xs font-semibold leading-5 text-[#3e304d]">
            Secret Mouse Tickets is an independent service and is not affiliated with Disney. You
            buy tickets directly from Disney after purchasing access.
          </p>
          <p className="px-3 text-center text-[11px] font-semibold leading-5 text-[#5a4a69]">
            *Savings based on the non-discounted price for the same ticket sold at Disney-owned and
            -operated Guest Service desks in the Central Florida area as of 2/25/25.
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-5 pb-16 pt-4 lg:px-8 lg:pb-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="inline-flex rounded-full border-[3px] border-[#120f17] bg-[#ffbd38] px-4 py-2 text-sm font-black text-[#120f17] shadow-[4px_4px_0_#120f17]">
            Real trip savings examples
          </p>
          <h2 className="mt-5 text-3xl font-black leading-tight text-[#120f17] sm:text-4xl">
            Families use hidden Disney ticket sale pages to keep more magic money in their pockets.
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm font-semibold leading-6 text-[#4b3c59]">
            See how families can use eligible Disney discount pages to save on tickets before they
            ever enter the parks.
          </p>
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
                  <p className="text-sm font-bold text-[#6a6170]">Disney World ticket savings</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

"use client";

import Image from "next/image";
import {
  BadgeCheck,
  CalendarDays,
  Hotel,
  Mail,
  Search,
  ShoppingCart,
  Ticket,
  Users,
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
  hotelSpecialRateAvailable: boolean;
  hotelName: string | null;
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
  parkHopper: false,
  guests10Plus: 2,
  guests3To9: 1,
  floridaResident: false,
  email: "",
};

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
    <main className="min-h-screen bg-[#f7f4ed] text-[#17211d]">
      <section className="mx-auto grid min-h-screen w-full max-w-7xl gap-8 px-5 py-6 lg:grid-cols-[0.94fr_1.06fr] lg:px-8">
        <div className="flex flex-col justify-between gap-8 rounded-lg border border-[#d8d0c0] bg-[#fffaf0] p-5 sm:p-7">
          <div>
            <header className="flex items-center justify-between gap-4">
              <Image
                src="/secret-mouse-savers-logo.svg"
                alt="Secret Mouse Savers"
                width={188}
                height={60}
                priority
                className="h-auto w-44"
              />
              <span className="rounded-md bg-[#dcefe6] px-3 py-2 text-xs font-semibold text-[#1d604f]">
                Private beta
              </span>
            </header>

            <div className="mt-12 space-y-5">
              <p className="inline-flex items-center gap-2 rounded-md border border-[#dfb561] bg-[#fff3d3] px-3 py-2 text-sm font-semibold text-[#76550d]">
                <Ticket size={17} aria-hidden="true" />
                Group & convention ticket access
              </p>
              <h1 className="max-w-xl text-4xl font-semibold leading-tight sm:text-5xl">
                Check your Walt Disney World visit dates.
              </h1>
              <p className="max-w-xl text-base leading-7 text-[#586159]">
                Enter your trip details to see whether an active event window overlaps your visit.
              </p>
            </div>
          </div>

          <div className="grid gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-lg border border-[#e1dacb] bg-white p-4">
              <CalendarDays className="mb-3 text-[#2f8068]" size={22} aria-hidden="true" />
              <p className="font-semibold">Date-window matching</p>
            </div>
            <div className="rounded-lg border border-[#e1dacb] bg-white p-4">
              <Users className="mb-3 text-[#be5b3f]" size={22} aria-hidden="true" />
              <p className="font-semibold">Party details checked</p>
            </div>
            <div className="rounded-lg border border-[#e1dacb] bg-white p-4">
              <Hotel className="mb-3 text-[#5f6e9a]" size={22} aria-hidden="true" />
              <p className="font-semibold">Hotel bonus detected</p>
            </div>
          </div>
        </div>

        <div className="grid content-center gap-5">
          <form
            onSubmit={submitForm}
            className="rounded-lg border border-[#d8d0c0] bg-white p-5 shadow-sm sm:p-6"
          >
            <div className="mb-5 flex items-center justify-between gap-4">
              <h2 className="text-xl font-semibold">Visit Details</h2>
              <span className="text-sm font-medium text-[#60706a]">{totalGuests} guests</span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold">
                Visit Start Date
                <input
                  type="date"
                  required
                  value={form.visitStartDate}
                  onChange={(event) => setForm({ ...form, visitStartDate: event.target.value })}
                  className="h-12 rounded-md border border-[#cfc7b8] px-3 text-base"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Visit End Date
                <input
                  type="date"
                  required
                  value={form.visitEndDate}
                  onChange={(event) => setForm({ ...form, visitEndDate: event.target.value })}
                  className="h-12 rounded-md border border-[#cfc7b8] px-3 text-base"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Theme Park Days
                <input
                  type="number"
                  min="1"
                  required
                  value={form.themeParkDays}
                  onChange={(event) =>
                    setForm({ ...form, themeParkDays: Number(event.target.value) })
                  }
                  className="h-12 rounded-md border border-[#cfc7b8] px-3 text-base"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Park Hopper Option
                <select
                  value={form.parkHopper ? "yes" : "no"}
                  onChange={(event) =>
                    setForm({ ...form, parkHopper: event.target.value === "yes" })
                  }
                  className="h-12 rounded-md border border-[#cfc7b8] px-3 text-base"
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Guests Ages 10+
                <input
                  type="number"
                  min="0"
                  required
                  value={form.guests10Plus}
                  onChange={(event) =>
                    setForm({ ...form, guests10Plus: Number(event.target.value) })
                  }
                  className="h-12 rounded-md border border-[#cfc7b8] px-3 text-base"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Guests Ages 3-9
                <input
                  type="number"
                  min="0"
                  required
                  value={form.guests3To9}
                  onChange={(event) =>
                    setForm({ ...form, guests3To9: Number(event.target.value) })
                  }
                  className="h-12 rounded-md border border-[#cfc7b8] px-3 text-base"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Florida Resident Discount
                <select
                  value={form.floridaResident ? "yes" : "no"}
                  onChange={(event) =>
                    setForm({ ...form, floridaResident: event.target.value === "yes" })
                  }
                  className="h-12 rounded-md border border-[#cfc7b8] px-3 text-base"
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Email
                <span className="relative">
                  <Mail
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#78847f]"
                    size={18}
                    aria-hidden="true"
                  />
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                    className="h-12 w-full rounded-md border border-[#cfc7b8] px-10 text-base"
                    placeholder="you@example.com"
                  />
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={status === "checking"}
              className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#2f8068] px-5 font-semibold text-white transition hover:bg-[#236b57] disabled:cursor-not-allowed disabled:opacity-70"
            >
              <Search size={18} aria-hidden="true" />
              {status === "checking" ? "Checking dates..." : "Check My Dates"}
            </button>
          </form>

          {error && (
            <p className="rounded-lg border border-[#ebc1b4] bg-[#fff1ed] px-4 py-3 text-sm font-semibold text-[#8a3927]">
              {error}
            </p>
          )}

          {result?.outcome === "not_found" && (
            <section className="rounded-lg border border-[#d8d0c0] bg-white p-5">
              <p className="text-lg font-semibold">{result.message}</p>
            </section>
          )}

          {result?.outcome === "matched" && (
            <section className="rounded-lg border border-[#bdd6ca] bg-[#f4fff9] p-5">
              <p className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-[#236b57]">
                <BadgeCheck size={17} aria-hidden="true" />
                Match found
              </p>
              <h2 className="mt-4 text-2xl font-semibold leading-tight">
                We Found Secret Mouse Saver Discounts For Your Walt Disney World Visit Dates!
              </h2>
              <p className="mt-3 text-base font-semibold">
                Walt Disney World&reg; Discounted Group & Convention Theme Park Tickets & Passes
              </p>
              <p className="mt-3 text-sm leading-6 text-[#4c5c56]">
                Valid for {form.themeParkDays} days from {formatDate(result.event.validStartDate)} to{" "}
                {formatDate(result.event.validEndDate)}.
              </p>
              <p className="mt-3 text-sm font-semibold text-[#76550d]">
                PLUS: An added bonus with multi-day tickets.
              </p>
              {result.event.hotelSpecialRateAvailable && result.event.hotelName && (
                <p className="mt-3 inline-flex items-center gap-2 rounded-md border border-[#d8d0c0] bg-white px-3 py-2 text-sm font-semibold">
                  <Hotel size={17} aria-hidden="true" />
                  Discounted rates at {result.event.hotelName} during your visit.
                </p>
              )}

              <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
                <label className="grid gap-2 text-sm font-semibold">
                  Coupon or Access Code
                  <input
                    value={couponCode}
                    onChange={(event) => setCouponCode(event.target.value)}
                    className="h-12 rounded-md border border-[#bdd6ca] bg-white px-3 text-base uppercase"
                    placeholder="Optional"
                  />
                </label>
                <button
                  type="button"
                  onClick={startCheckout}
                  disabled={status === "checkout"}
                  className="inline-flex h-12 items-center justify-center gap-2 self-end rounded-md bg-[#17211d] px-5 font-semibold text-white transition hover:bg-[#2c3833] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <ShoppingCart size={18} aria-hidden="true" />
                  {status === "checkout" ? "Opening..." : "Purchase For $99"}
                </button>
              </div>
            </section>
          )}

          <p className="text-xs leading-5 text-[#68736e]">
            Secret Mouse Savers is an independent service and is not affiliated with Disney.
          </p>
        </div>
      </section>
    </main>
  );
}

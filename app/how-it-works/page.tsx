import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Search, Ticket } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "How It Works",
  description:
    "Learn how Secret Mouse Tickets checks your Walt Disney World visit dates, matches eligible Disney Group and Convention ticket offers, and delivers your purchase link.",
  alternates: {
    canonical: "https://secretmousetickets.com/how-it-works",
  },
};

export default function HowItWorksPage() {
  return (
    <main className="brand-page min-h-screen text-[#120f17]">
      <section className="mx-auto w-full max-w-4xl px-5 pb-8 pt-6 lg:px-8 lg:pt-10">
        <div className="cartoon-panel grid gap-6 rounded-[24px] bg-white p-5 sm:p-7">
          <div className="grid gap-3">
            <p className="text-sm font-bold uppercase text-[#5d45b5]">How It Works</p>
            <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
              How Secret Mouse Tickets works for Disney World discount ticket access
            </h1>
            <p className="text-base font-semibold leading-7 text-[#3e304d]">
              Secret Mouse Tickets helps guests find Disney Group and Convention discount ticket
              offers that match their Walt Disney World visit dates. When an eligible offer is
              available, you purchase access from us and buy your actual Disney tickets directly
              from Disney.
            </p>
          </div>

          <section className="grid gap-4 md:grid-cols-3">
            <StepCard
              icon={<Search size={20} aria-hidden="true" />}
              title="1. Enter your trip details"
              body="Use the Visit Details form to enter your travel dates, park days, party size, and email address."
              bg="bg-[#fff7de]"
            />
            <StepCard
              icon={<CheckCircle2 size={20} aria-hidden="true" />}
              title="2. We check current matching offers"
              body="We compare your dates against active Walt Disney World discount sale pages that match our eligibility rules."
              bg="bg-[#d8c6ff]"
            />
            <StepCard
              icon={<Ticket size={20} aria-hidden="true" />}
              title="3. You buy from Disney"
              body="After checkout, we email you the eligible Disney sale-page link so you can purchase your actual tickets directly from Disney."
              bg="bg-[#e7f7d9]"
            />
          </section>

          <ContentSection title="What you are buying">
            <p>
              Secret Mouse Tickets does not sell Disney theme park tickets directly. Our service is
              the matching and delivery step: we identify whether your visit dates line up with an
              eligible Disney Group and Convention discount ticket offer and, when they do, we send
              you the qualifying Disney sale-page link after purchase.
            </p>
            <p>
              Your actual Walt Disney World tickets are purchased directly from Disney through that
              linked page.
            </p>
          </ContentSection>

          <ContentSection title="Do you need to attend a convention or belong to a group?">
            <p>
              No. Secret Mouse Tickets focuses on Disney Group and Convention ticket offers that can
              still be valuable for eligible public purchase through the linked sale pages. You do
              not need to attend a convention or be part of a formal group to use an eligible offer
              we match to your dates.
            </p>
          </ContentSection>

          <ContentSection title="Why the trip size matters">
            <p>
              The site is designed around visits where the Disney discount is likely to outweigh our
              fee. That is why Secret Mouse Tickets only offers checkout when the trip details are
              large enough to make financial sense.
            </p>
            <p>
              In practice, that usually means at least three ticket-days total, such as one guest
              for three park days or three guests for one park day.
            </p>
          </ContentSection>

          <ContentSection title="What happens after purchase">
            <p>
              After payment, we send your confirmation and the matching Disney sale-page link to the
              email address you entered. If there is ever an access problem, or if you do not come
              out ahead compared with Disney&apos;s non-discounted ticket price for the same tickets
              after our fee, contact us and we will review it under our refund policy.
            </p>
          </ContentSection>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-[16px] border-4 border-[#120f17] bg-[#ffbd38] px-5 py-3 font-bold text-[#120f17] shadow-[5px_5px_0_#120f17] transition hover:-translate-y-0.5 hover:shadow-[7px_7px_0_#120f17]"
            >
              Check My Dates
            </Link>
            <Link
              href="/disney-world-group-convention-tickets"
              className="inline-flex items-center gap-2 rounded-[16px] border-4 border-[#120f17] bg-[#fff7de] px-5 py-3 font-bold text-[#120f17] shadow-[5px_5px_0_#120f17] transition hover:-translate-y-0.5 hover:shadow-[7px_7px_0_#120f17]"
            >
              Learn about Disney Group tickets
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}

function StepCard({
  icon,
  title,
  body,
  bg,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  bg: string;
}) {
  return (
    <div className={`rounded-[18px] border-[3px] border-[#120f17] ${bg} p-4 shadow-[4px_4px_0_#120f17]`}>
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-[#120f17] bg-white">
        {icon}
      </div>
      <h2 className="mt-3 text-lg font-black">{title}</h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-[#3e304d]">{body}</p>
    </div>
  );
}

function ContentSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-3">
      <h2 className="text-xl font-bold text-[#120f17]">{title}</h2>
      <div className="space-y-3 text-base font-semibold leading-7 text-[#3e304d]">{children}</div>
    </section>
  );
}

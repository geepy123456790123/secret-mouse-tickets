import { shareImage } from "@/lib/social-preview";
import { PRICE_LABEL } from "@/lib/pricing";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Search, Ticket } from "lucide-react";
import { MarketingHeader } from "@/components/marketing-header";
import { SiteFooter } from "@/components/site-footer";

const siteUrl = "https://secretmousetickets.com";
const pageUrl = `${siteUrl}/how-it-works`;
const pageDescription =
  "Learn how Secret Mouse Tickets checks your Walt Disney World visit dates, matches eligible Disney Group and Convention ticket offers, and delivers your purchase link.";

export const metadata: Metadata = {
  title: "How It Works",
  description: pageDescription,
  alternates: {
    canonical: pageUrl,
  },
  openGraph: {
    title: "How Secret Mouse Tickets Works",
    description: pageDescription,
    url: pageUrl,
    images: [shareImage],
  },
  twitter: {
    card: "summary_large_image",
    title: "How Secret Mouse Tickets Works",
    description: pageDescription,
    images: [{ url: shareImage.url, alt: shareImage.alt }],
  },
};

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "How Secret Mouse Tickets works",
  description: pageDescription,
  url: pageUrl,
  image: `${siteUrl}${shareImage.url}`,
  author: {
    "@type": "Organization",
    name: "Secret Mouse Tickets",
    url: siteUrl,
  },
  publisher: {
    "@type": "Organization",
    name: "Secret Mouse Tickets",
    logo: {
      "@type": "ImageObject",
      url: `${siteUrl}/secret-mouse-tickets-logo.png`,
    },
  },
  mainEntityOfPage: pageUrl,
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: siteUrl,
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "How It Works",
      item: pageUrl,
    },
  ],
};

export default function HowItWorksPage() {
  return (
    <main className="brand-page polished-page article-redesign min-h-screen">
      <MarketingHeader />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <section className="mx-auto w-full max-w-4xl px-5 pb-8 pt-6 lg:px-8 lg:pt-10">
        <div className="cartoon-panel grid gap-6 rounded-[24px] bg-white p-5 sm:p-7">
          <div className="grid gap-3">
            <p className="text-sm font-bold uppercase text-[#5d45b5]">How It Works</p>
            <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
              Your dates. Your offer. Your Disney trip.
            </h1>
            <p className="text-base font-semibold leading-7 text-[#3e304d]">
              Check your travel dates for free. If we find a matching Disney Group &amp; Convention
              ticket offer, you can get the sale-page link for a one-time {PRICE_LABEL} fee.
              You then choose and buy your park tickets separately, directly from Disney.
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
              title="2. Get your matched link"
              body={`Review your date match, then choose whether to pay ${PRICE_LABEL} for delivery of the Disney sale-page link.`}
              bg="bg-[#d8c6ff]"
            />
            <StepCard
              icon={<Ticket size={20} aria-hidden="true" />}
              title="3. You buy from Disney"
              body="After checkout, we email you the eligible Disney sale-page link so you can purchase your actual tickets directly from Disney."
              bg="bg-[#e7f7d9]"
            />
          </section>

          <ContentSection title="What you're buying">
            <p>
              Secret Mouse Tickets doesn&apos;t sell Disney theme park tickets directly. Our service is
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
              Purchase requirements vary by offer. Disney sets each sale page’s eligibility rules,
              valid dates, and restrictions. Review those requirements before purchasing; a date
              match doesn&apos;t confirm that you meet every condition of the offer.
            </p>
          </ContentSection>

          <ContentSection title="Why the trip size matters">
            <p>
              We use your park days and guest count to check whether your trip meets our minimum
              matching criteria. This is a trip-size check, not a calculation of your final savings.
            </p>
            <p>
              That means at least three ticket-days total, such as one guest
              for three park days, three guests for one park day, or two guests for two park days.
            </p>
          </ContentSection>

          <ContentSection title="Check park reservations before you buy">
            <p>Disney lists Sport and Convention tickets among the types that require park reservations.
              Check availability for your parks and dates before purchasing. Our matching service doesn&apos;t reserve admission.</p>
            <a href="https://disneyworld.disney.go.com/experience-updates/park-reservations/?redirect=false" className="underline underline-offset-4">Read Disney&apos;s reservation guidance</a>
          </ContentSection>

          <ContentSection title="What happens after purchase">
            <p>
              After payment, we send your confirmation and the matching Disney sale-page link to the
              email address you entered. If you run into any problem with your link, contact us and
              we&apos;ll sort it out.
            </p>
            <p>
              And if you don&apos;t come out ahead of Disney&apos;s regular price for the same tickets
              after our fee, we&apos;ll review it under our refund policy.
            </p>
          </ContentSection>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/#check-dates"
              className="inline-flex items-center justify-center rounded-[16px] border-4 border-[#120f17] bg-[#ffbd38] px-5 py-3 font-bold text-[#120f17] shadow-[5px_5px_0_#120f17] transition hover:-translate-y-0.5 hover:shadow-[7px_7px_0_#120f17]"
            >
              Check my dates — free
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

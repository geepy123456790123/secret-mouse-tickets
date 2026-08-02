import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeDollarSign, Info, Ticket } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";

const siteUrl = "https://secretmousetickets.com";
const pageUrl = `${siteUrl}/disney-world-group-convention-tickets`;
const pageDescription =
  "Understand Disney World Group and Convention discount tickets, how Secret Mouse Tickets finds matching offers, and why guests use these sale pages to save on eligible Disney tickets.";
const shareImage = {
  url: "/secret-mouse-tickets-og-facebook.png",
  width: 1200,
  height: 628,
  alt: "Secret Mouse Tickets - Disney World ticket offers matched to your visit",
};

export const metadata: Metadata = {
  title: "Disney World Group And Convention Tickets",
  description: pageDescription,
  alternates: {
    canonical: pageUrl,
  },
  openGraph: {
    title: "Disney World Group And Convention Tickets",
    description: pageDescription,
    url: pageUrl,
    images: [shareImage],
  },
  twitter: {
    card: "summary_large_image",
    title: "Disney World Group And Convention Tickets",
    description: pageDescription,
    images: [shareImage.url],
  },
};

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "What Disney World Group and Convention discount tickets are",
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

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Do guests need to attend a convention to use these ticket offers?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. Secret Mouse Tickets focuses on Disney Group and Convention ticket pages that can be used for qualifying public purchase when the dates line up.",
      },
    },
    {
      "@type": "Question",
      name: "Who sells the actual Disney tickets?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Disney sells the actual Walt Disney World tickets. Secret Mouse Tickets provides matching and delivery of the eligible Disney sale-page link.",
      },
    },
  ],
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
      name: "Disney World Group And Convention Tickets",
      item: pageUrl,
    },
  ],
};

export default function DisneyWorldGroupConventionTicketsPage() {
  return (
    <main className="brand-page min-h-screen text-[#120f17]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <section className="mx-auto w-full max-w-4xl px-5 pb-8 pt-6 lg:px-8 lg:pt-10">
        <div className="cartoon-panel grid gap-6 rounded-[24px] bg-white p-5 sm:p-7">
          <div className="grid gap-3">
            <p className="text-sm font-bold uppercase text-[#5d45b5]">
              Disney Group And Convention Tickets
            </p>
            <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
              What Disney World Group and Convention discount tickets are
            </h1>
            <p className="text-base font-semibold leading-7 text-[#3e304d]">
              Walt Disney World sometimes offers special ticket sale pages tied to group and
              convention inventory. Secret Mouse Tickets helps guests find offers that match their
              visit dates so they can purchase eligible Disney tickets directly from Disney.
            </p>
          </div>

          <section className="grid gap-4 md:grid-cols-3">
            <InfoCard
              icon={<Ticket size={20} aria-hidden="true" />}
              title="Special Disney sale pages"
              body="These offers live on Disney sale pages that are separate from the standard ticket flow most guests see."
              bg="bg-[#fff7de]"
            />
            <InfoCard
              icon={<BadgeDollarSign size={20} aria-hidden="true" />}
              title="Potential ticket savings"
              body="Eligible offers can reduce the price compared with Disney's non-discounted ticket pricing for the same tickets."
              bg="bg-[#d8c6ff]"
            />
            <InfoCard
              icon={<Info size={20} aria-hidden="true" />}
              title="Rules can change"
              body="Disney controls the pricing, terms, availability, and included perks on each sale page."
              bg="bg-[#e7f7d9]"
            />
          </section>

          <ContentSection title="Why these offers matter">
            <p>
              A lot of Disney guests go looking for any kind of ticket discount, since the standard
              public pricing adds up fast. These group and convention sale pages can sometimes offer
              better value for eligible visit windows, especially for multi-day trips.
            </p>
          </ContentSection>

          <ContentSection title="How Secret Mouse Tickets uses them">
            <p>
              Secret Mouse Tickets does the date-matching work. When you enter your Walt Disney
              World visit details, we compare them against currently active sale-page windows. If a
              matching offer exists and your trip is large enough to make sense financially, we show
              you the option to purchase access.
            </p>
            <p>
              After purchase, we email you the matching Disney sale-page link. You then complete
              the actual ticket purchase directly with Disney.
            </p>
          </ContentSection>

          <ContentSection title="Do guests need to be part of a convention?">
            <p>
              Not for the offers Secret Mouse Tickets is built around. We focus on Disney Group and
              Convention ticket pages that can still be used for qualifying public purchase when the
              dates line up. You don&apos;t need to attend a convention or belong to a formal group to
              use an eligible link we provide.
            </p>
          </ContentSection>

          <ContentSection title="What perks can be included">
            <p>
              Depending on the specific Disney offer, multi-day tickets available through the sale
              page may include an extra Water Park Fun &amp; More Visit pass. Disney decides the
              exact offer structure, so that benefit can vary by page and timing.
            </p>
          </ContentSection>

          <ContentSection title="Important note about savings">
            <p>
              Disney uses dynamic ticket pricing, so no one can promise an exact savings number in
              advance without knowing the exact ticket and travel combination you would otherwise
              buy. Secret Mouse Tickets is designed so that customers come out ahead versus
              Disney&apos;s non-discounted ticket price for the same tickets after our fee, or we
              review the purchase under our refund policy.
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
              href="/how-it-works"
              className="inline-flex items-center gap-2 rounded-[16px] border-4 border-[#120f17] bg-[#fff7de] px-5 py-3 font-bold text-[#120f17] shadow-[5px_5px_0_#120f17] transition hover:-translate-y-0.5 hover:shadow-[7px_7px_0_#120f17]"
            >
              See how the service works
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}

function InfoCard({
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

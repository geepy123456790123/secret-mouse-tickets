import { PRICE_LABEL } from "@/lib/pricing";
import type { Metadata } from "next";
import { homeFaqItems } from "@/lib/homepage-copy";
import { HomePageClient } from "./home-page-client";
import { getTopBannerSettings } from "@/lib/site-settings";

const siteUrl = "https://secretmousetickets.com";
const pageDescription =
  `Check your dates for Disney Group and Convention ticket offers for free. A matched link costs ${PRICE_LABEL}; park tickets are purchased separately from Disney.`;
const shareImage = {
  url: "/secret-mouse-tickets-meta-feed.png",
  width: 1731,
  height: 909,
  alt: "Secret Mouse Tickets - Disney ticket offers matched to your dates",
};

export const metadata: Metadata = {
  title: "Disney World Discount Tickets",
  description: pageDescription,
  alternates: {
    canonical: siteUrl,
  },
  keywords: [
    "Disney World discount tickets",
    "Walt Disney World discount tickets",
    "Disney Group and Convention tickets",
    "Disney World ticket savings",
    "Disney World ticket offers",
  ],
  openGraph: {
    title: "Disney World Discount Tickets | Secret Mouse Tickets",
    description: pageDescription,
    url: siteUrl,
    images: [shareImage],
  },
  twitter: {
    card: "summary_large_image",
    title: "Disney World Discount Tickets | Secret Mouse Tickets",
    description: pageDescription,
    images: [shareImage.url],
  },
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: homeFaqItems.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: { "@type": "Answer", text: item.answer },
  })),
};

const homePageSchema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Disney World Discount Tickets",
  url: siteUrl,
  description: pageDescription,
  inLanguage: "en-US",
  isPartOf: {
    "@type": "WebSite",
    name: "Secret Mouse Tickets",
    url: siteUrl,
  },
  about: [
    {
      "@type": "Thing",
      name: "Walt Disney World discount tickets",
    },
    {
      "@type": "Thing",
      name: "Disney Group and Convention ticket offers",
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
  ],
};

export default async function HomePage() {
  const topBanner = await getTopBannerSettings();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homePageSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <HomePageClient topBanner={topBanner} />
    </>
  );
}

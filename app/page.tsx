import type { Metadata } from "next";
import { HomePageClient } from "./home-page-client";

const siteUrl = "https://secretmousetickets.com";

export const metadata: Metadata = {
  title: "Disney World Discount Tickets",
  description:
    "Find hidden Walt Disney World Group and Convention discount ticket offers for your visit dates. Check Disney World ticket eligibility, then buy your actual tickets directly from Disney.",
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    title: "Disney World Discount Tickets | Secret Mouse Tickets",
    description:
      "Find hidden Walt Disney World Group and Convention discount ticket offers for your visit dates and buy your actual tickets directly from Disney.",
    url: siteUrl,
  },
  twitter: {
    title: "Disney World Discount Tickets | Secret Mouse Tickets",
    description:
      "Find hidden Walt Disney World Group and Convention discount ticket offers for your visit dates.",
  },
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What does Secret Mouse Tickets sell?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Secret Mouse Tickets helps customers find Disney Group and Convention discount ticket offers that match their Walt Disney World visit dates. After purchase, customers receive a link to the eligible Disney sale page and buy their actual theme park tickets directly from Disney.",
      },
    },
    {
      "@type": "Question",
      name: "Do I need to attend a convention or belong to a group?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. Secret Mouse Tickets is built around Disney Group and Convention ticket offers that are open for qualifying public purchase through the linked sale pages. You do not need to attend a convention or belong to a group to use an eligible offer we provide access to.",
      },
    },
    {
      "@type": "Question",
      name: "How do I check whether my Disney World trip dates qualify?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Use the Visit Details form on the homepage to enter your Walt Disney World visit dates, number of park days, guest counts, and email address. If your dates match an eligible Disney discount sale page and the trip size makes sense financially, the site will show you the checkout option.",
      },
    },
    {
      "@type": "Question",
      name: "Do I buy Disney tickets from Secret Mouse Tickets?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. Secret Mouse Tickets does not sell Disney tickets directly. Customers pay Secret Mouse Tickets for access to a qualifying Disney discount sale page, then purchase their actual Walt Disney World theme park tickets directly from Disney.",
      },
    },
  ],
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <HomePageClient />
    </>
  );
}

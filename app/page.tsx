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
      name: "Is this a scam?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. We never sell tickets or take your Disney payment information. We match your travel dates to a real Disney Group and Convention sale page, then you buy directly from Disney using Disney's own checkout.",
      },
    },
    {
      "@type": "Question",
      name: "Why isn't this offer on Disney's main ticket page?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Disney runs these Group and Convention sale pages separately from the ticket page most guests see. They're tied to specific conventions and events, not hidden, just not linked from where most families start.",
      },
    },
    {
      "@type": "Question",
      name: "Will this affect my park reservations or get my tickets canceled?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. Your tickets are standard Disney tickets, bought through Disney's own checkout and covered by Disney's own terms. We never hold or issue your tickets at any point.",
      },
    },
    {
      "@type": "Question",
      name: "What am I actually paying Secret Mouse Tickets for?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "The matching and delivery step. We check your travel dates against active Disney Group and Convention offers and send you the correct sale page link if one matches. Disney sets the ticket price, and you complete the purchase on Disney's site.",
      },
    },
    {
      "@type": "Question",
      name: "Do I need to attend a convention or belong to a group?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. These sale pages allow qualifying public purchase. You don't need to register for a conference or belong to an organization.",
      },
    },
    {
      "@type": "Question",
      name: "What if my dates don't match an offer, or I don't actually come out ahead?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "If nothing matches your dates, you're not charged. If we do find a match and you still don't come out ahead of Disney's regular price after our fee, contact us and we'll make it right under our guarantee.",
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

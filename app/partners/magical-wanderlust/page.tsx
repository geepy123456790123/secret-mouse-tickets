import type { Metadata } from "next";
import { HomePageClient } from "@/app/home-page-client";
import { getTopBannerSettings } from "@/lib/site-settings";

const siteUrl = "https://secretmousetickets.com";
const path = "/partners/magical-wanderlust";
const couponCode = "MAGICAL25";
const pageDescription =
  "A personalized Secret Mouse Tickets page for magical_wanderlust followers. Check Disney World travel dates for free and use MAGICAL25 for 25% off the matching fee.";

export const metadata: Metadata = {
  title: "magical_wanderlust Disney World Ticket Savings",
  description: pageDescription,
  alternates: {
    canonical: `${siteUrl}${path}`,
  },
  openGraph: {
    title: "Disney World Ticket Savings for magical_wanderlust Followers",
    description: pageDescription,
    url: `${siteUrl}${path}`,
    images: [
      {
        url: "/secret-mouse-tickets-meta-feed.png",
        width: 1731,
        height: 909,
        alt: "Secret Mouse Tickets - Disney ticket offers matched to your dates",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Disney World Ticket Savings for magical_wanderlust Followers",
    description: pageDescription,
    images: ["/secret-mouse-tickets-meta-feed.png"],
  },
};

export default async function MagicalWanderlustPartnerPage() {
  const topBanner = await getTopBannerSettings();

  return (
    <HomePageClient
      topBanner={topBanner}
      partnerLanding={{
        creatorName: "Maria",
        handle: "@magical_wanderlust",
        couponCode,
        discountLabel: "25% off our matching fee",
      }}
    />
  );
}

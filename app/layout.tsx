import type { Metadata } from "next";
import { Fredoka } from "next/font/google";
import { env } from "cloudflare:workers";
import "./globals.css";
import { MarketingScripts } from "@/components/marketing-scripts";

const siteUrl = "https://secretmousetickets.com";

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Secret Mouse Tickets",
    template: "%s | Secret Mouse Tickets",
  },
  description:
    "Secret Mouse Tickets helps guests find hidden Walt Disney World Group and Convention discount ticket offers for eligible visit dates.",
  alternates: {
    canonical: siteUrl,
  },
  keywords: [
    "Disney World discount tickets",
    "Walt Disney World discount tickets",
    "Disney Group tickets",
    "Disney convention tickets",
    "Disney World ticket savings",
    "Disney World group and convention tickets",
  ],
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "Secret Mouse Tickets",
    title: "Secret Mouse Tickets",
    description:
      "Find hidden Walt Disney World Group and Convention discount ticket offers for eligible visit dates.",
  },
  twitter: {
    card: "summary",
    title: "Secret Mouse Tickets",
    description:
      "Find hidden Walt Disney World Group and Convention discount ticket offers for eligible visit dates.",
  },
  icons: {
    icon: "/sparkles-favicon.svg",
    shortcut: "/sparkles-favicon.svg",
  },
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Secret Mouse Tickets",
  url: siteUrl,
  email: "hello@secretmousetickets.com",
  logo: `${siteUrl}/secret-mouse-tickets-logo.png`,
  sameAs: [],
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Secret Mouse Tickets",
  url: siteUrl,
  description:
    "Find hidden Walt Disney World Group and Convention discount ticket offers for eligible visit dates.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const runtime = env as typeof env & {
    GOOGLE_ADS_TAG_ID?: string;
    META_PIXEL_ID?: string;
  };
  const googleAdsTagId = runtime.GOOGLE_ADS_TAG_ID?.trim() || null;
  const metaPixelId = runtime.META_PIXEL_ID?.trim() || null;

  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
      </head>
      <body className={`${fredoka.variable} antialiased`}>
        <MarketingScripts googleAdsTagId={googleAdsTagId} metaPixelId={metaPixelId} />
        {children}
      </body>
    </html>
  );
}

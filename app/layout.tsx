import type { Metadata } from "next";
import { Fredoka } from "next/font/google";
import { env } from "cloudflare:workers";
import "./globals.css";
import { MarketingScripts } from "@/components/marketing-scripts";

const siteUrl = "https://secretmousetickets.com";
const siteName = "Secret Mouse Tickets";
const defaultDescription =
  "Secret Mouse Tickets helps Walt Disney World visitors find Disney Group and Convention discount ticket offers that match eligible visit dates.";
const shareImage = {
  url: "/secret-mouse-tickets-meta-feed.png",
  width: 1731,
  height: 909,
  alt: "Secret Mouse Tickets - hidden Disney ticket offers open to everyone",
};

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: siteName,
  authors: [{ name: siteName, url: siteUrl }],
  creator: siteName,
  publisher: siteName,
  title: {
    default: siteName,
    template: `%s | ${siteName}`,
  },
  description: defaultDescription,
  alternates: {
    canonical: siteUrl,
  },
  category: "travel",
  keywords: [
    "Disney World discount tickets",
    "Walt Disney World discount tickets",
    "Disney Group tickets",
    "Disney convention tickets",
    "Disney World ticket savings",
    "Disney World group and convention tickets",
    "Disney World ticket offers",
    "Disney World vacation savings",
  ],
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName,
    title: siteName,
    description: defaultDescription,
    images: [shareImage],
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: siteName,
    description: defaultDescription,
    images: [shareImage.url],
  },
  icons: {
    icon: [
      {
        url: "/favicon-32x32.png",
        type: "image/png",
        sizes: "32x32",
      },
      {
        url: "/favicon-48x48.png",
        type: "image/png",
        sizes: "48x48",
      },
      {
        url: "/sparkles-favicon.svg",
        type: "image/svg+xml",
      },
    ],
    shortcut: "/favicon-32x32.png",
    apple: {
      url: "/apple-touch-icon.png",
      sizes: "180x180",
      type: "image/png",
    },
  },
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: siteName,
  url: siteUrl,
  email: "hello@secretmousetickets.com",
  logo: `${siteUrl}/secret-mouse-tickets-logo.png`,
  contactPoint: [
    {
      "@type": "ContactPoint",
      email: "hello@secretmousetickets.com",
      contactType: "customer support",
      areaServed: "US",
      availableLanguage: "English",
    },
  ],
  areaServed: {
    "@type": "Country",
    name: "United States",
  },
  knowsAbout: [
    "Walt Disney World tickets",
    "Disney Group and Convention tickets",
    "Disney World ticket discounts",
    "Disney World vacation planning",
  ],
  sameAs: [],
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: siteName,
  url: siteUrl,
  inLanguage: "en-US",
  description: defaultDescription,
};

const serviceSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Secret Mouse Tickets Disney ticket offer matching",
  serviceType: "Disney Group and Convention ticket offer matching",
  provider: {
    "@type": "Organization",
    name: siteName,
    url: siteUrl,
  },
  areaServed: {
    "@type": "Country",
    name: "United States",
  },
  audience: {
    "@type": "Audience",
    audienceType: "Walt Disney World visitors",
  },
  description:
    "Secret Mouse Tickets checks Walt Disney World visit dates against active Disney Group and Convention discount ticket sale pages. When a match is available, customers can purchase access to the matching Disney sale-page link and buy actual tickets directly from Disney.",
  offers: {
    "@type": "Offer",
    price: "39",
    priceCurrency: "USD",
    availability: "https://schema.org/InStock",
    url: siteUrl,
    category: "Ticket offer matching service",
  },
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }}
        />
      </head>
      <body className={`${fredoka.variable} antialiased`}>
        <MarketingScripts googleAdsTagId={googleAdsTagId} metaPixelId={metaPixelId} />
        {children}
      </body>
    </html>
  );
}

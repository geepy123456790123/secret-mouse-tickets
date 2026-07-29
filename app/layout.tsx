import type { Metadata } from "next";
import { Fredoka } from "next/font/google";
import { env } from "cloudflare:workers";
import "./globals.css";
import { MarketingScripts } from "@/components/marketing-scripts";

const siteUrl = "https://secretmousetickets.com";
const shareImage = {
  url: "/secret-mouse-tickets-share.png",
  width: 1200,
  height: 630,
  alt: "Secret Mouse Tickets - Disney World ticket offers matched to your visit",
};

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
    images: [shareImage],
  },
  twitter: {
    card: "summary_large_image",
    title: "Secret Mouse Tickets",
    description:
      "Find hidden Walt Disney World Group and Convention discount ticket offers for eligible visit dates.",
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

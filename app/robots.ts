import type { MetadataRoute } from "next";

const siteUrl = "https://secretmousetickets.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/privacy-policy", "/terms-of-service"],
        disallow: ["/admin/", "/api/", "/checkout/"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}

"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect } from "react";

declare global {
  interface Window {
    dataLayer?: unknown[];
    fbq?: ((...args: unknown[]) => void) & {
      callMethod?: (...args: unknown[]) => void;
      loaded?: boolean;
      push?: (...args: unknown[]) => void;
      queue?: unknown[];
      version?: string;
    };
    _fbq?: unknown;
    gtag?: (...args: unknown[]) => void;
  }
}

type MarketingScriptsProps = {
  googleAdsTagId: string | null;
  metaPixelId: string | null;
};

export function MarketingScripts({
  googleAdsTagId,
  metaPixelId,
}: MarketingScriptsProps) {
  useEffect(() => {
    if (googleAdsTagId) {
      window.dataLayer = window.dataLayer || [];
      window.gtag =
        window.gtag ||
        function gtag(...args: unknown[]) {
          window.dataLayer?.push(args);
        };

      window.gtag("js", new Date());
      window.gtag("config", googleAdsTagId);

      if (!document.querySelector(`script[src="https://www.googletagmanager.com/gtag/js?id=${googleAdsTagId}"]`)) {
        const googleScript = document.createElement("script");
        googleScript.async = true;
        googleScript.src = `https://www.googletagmanager.com/gtag/js?id=${googleAdsTagId}`;
        document.head.appendChild(googleScript);
      }
    }

    if (metaPixelId && !window.fbq) {
      const fbq = function (...args: unknown[]) {
        if (fbq.callMethod) {
          fbq.callMethod(...args);
        } else {
          fbq.queue = fbq.queue || [];
          fbq.queue.push(args);
        }
      } as NonNullable<typeof window.fbq>;

      fbq.push = fbq;
      fbq.loaded = true;
      fbq.version = "2.0";
      fbq.queue = [];
      window.fbq = fbq;
      window._fbq = fbq;

      const metaScript = document.createElement("script");
      metaScript.async = true;
      metaScript.src = "https://connect.facebook.net/en_US/fbevents.js";
      const firstScript = document.getElementsByTagName("script")[0];

      if (firstScript?.parentNode) {
        firstScript.parentNode.insertBefore(metaScript, firstScript);
      } else {
        document.head.appendChild(metaScript);
      }
    }

    if (metaPixelId && window.fbq) {
      window.fbq("init", metaPixelId);
      window.fbq("track", "PageView");
    }
  }, [googleAdsTagId, metaPixelId]);

  if (!metaPixelId) {
    return null;
  }

  return (
    <noscript>
      <img
        alt=""
        height="1"
        width="1"
        style={{ display: "none" }}
        src={`https://www.facebook.com/tr?id=${metaPixelId}&ev=PageView&noscript=1`}
      />
    </noscript>
  );
}

"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    gtag?: (...args: unknown[]) => void;
  }
}

type CheckoutEventTrackerProps = {
  eventType: "begin_checkout" | "purchase";
  orderId: string;
  amountCents: number;
  googleAdsTagId: string | null;
  googleAdsBeginCheckoutLabel?: string | null;
  googleAdsPurchaseLabel?: string | null;
  metaPixelId: string | null;
};

export function CheckoutEventTracker({
  eventType,
  orderId,
  amountCents,
  googleAdsTagId,
  googleAdsBeginCheckoutLabel = null,
  googleAdsPurchaseLabel = null,
  metaPixelId,
}: CheckoutEventTrackerProps) {
  useEffect(() => {
    const key = `smt:${eventType}:${orderId}`;
    if (window.sessionStorage.getItem(key) === "sent") {
      return;
    }

    const value = Math.max(0, amountCents / 100);

    if (eventType === "begin_checkout") {
      window.gtag?.("event", "begin_checkout", {
        currency: "USD",
        value,
      });

      if (googleAdsTagId && googleAdsBeginCheckoutLabel) {
        window.gtag?.("event", "conversion", {
          send_to: `${googleAdsTagId}/${googleAdsBeginCheckoutLabel}`,
          currency: "USD",
          value,
          transaction_id: orderId,
        });
      }

      if (metaPixelId) {
        window.fbq?.(
          "track",
          "InitiateCheckout",
          {
            currency: "USD",
            value,
          },
          { eventID: orderId },
        );
      }
    }

    if (eventType === "purchase") {
      window.gtag?.("event", "purchase", {
        transaction_id: orderId,
        currency: "USD",
        value,
      });

      if (googleAdsTagId && googleAdsPurchaseLabel) {
        window.gtag?.("event", "conversion", {
          send_to: `${googleAdsTagId}/${googleAdsPurchaseLabel}`,
          currency: "USD",
          value,
          transaction_id: orderId,
        });
      }

      if (metaPixelId) {
        window.fbq?.(
          "track",
          "Purchase",
          {
            currency: "USD",
            value,
          },
          { eventID: orderId },
        );
      }
    }

    window.sessionStorage.setItem(key, "sent");
  }, [
    amountCents,
    eventType,
    googleAdsBeginCheckoutLabel,
    googleAdsPurchaseLabel,
    googleAdsTagId,
    metaPixelId,
    orderId,
  ]);

  return null;
}

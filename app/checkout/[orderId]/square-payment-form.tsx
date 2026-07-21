"use client";

import { CreditCard, Loader2, Mail } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type SquarePaymentFormProps = {
  orderId: string;
  amountCents: number;
  initialCouponCode: string | null;
  recipientEmail: string;
  applicationId: string | null;
  locationId: string | null;
  environment: string;
};

type SquareCard = {
  attach(selector: string): Promise<void>;
  tokenize(): Promise<{
    status: string;
    token?: string;
    errors?: Array<{ message?: string }>;
  }>;
  destroy?(): Promise<void>;
};

type SquarePayments = {
  card(options?: Record<string, unknown>): Promise<SquareCard>;
};

declare global {
  interface Window {
    Square?: {
      payments(applicationId: string, locationId: string): SquarePayments;
    };
  }
}

export function SquarePaymentForm({
  orderId,
  amountCents,
  initialCouponCode,
  recipientEmail,
  applicationId,
  locationId,
  environment,
}: SquarePaymentFormProps) {
  const cardRef = useRef<SquareCard | null>(null);
  const [couponCode, setCouponCode] = useState(initialCouponCode ?? "");
  const [status, setStatus] = useState<"loading" | "ready" | "paying" | "paid" | "error">(
    amountCents <= 0 ? "ready" : "loading"
  );
  const [couponStatus, setCouponStatus] = useState<"idle" | "applying">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (amountCents <= 0) {
      return;
    }

    let isMounted = true;

    async function initializeSquare() {
      try {
        if (!applicationId || !locationId) {
          throw new Error("Square payments are not configured.");
        }

        await loadSquareScript(environment);

        if (!window.Square) {
          throw new Error("Square payment form did not load.");
        }

        const payments = window.Square.payments(applicationId, locationId);
        const card = await payments.card();
        await card.attach("#square-card-container");

        if (!isMounted) {
          await card.destroy?.();
          return;
        }

        cardRef.current = card;
        setStatus("ready");
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setStatus("error");
        setMessage(error instanceof Error ? error.message : "Unable to load Square payments.");
      }
    }

    initializeSquare();

    return () => {
      isMounted = false;
      void cardRef.current?.destroy?.();
      cardRef.current = null;
    };
  }, [amountCents, applicationId, environment, locationId]);

  async function pay() {
    setStatus("paying");
    setMessage("");

    try {
      let sourceId: string | undefined;

      if (amountCents > 0) {
        const tokenResult = await cardRef.current?.tokenize({
          amount: (amountCents / 100).toFixed(2),
          billingContact: {
            email: recipientEmail,
          },
          currencyCode: "USD",
          intent: "CHARGE",
          customerInitiated: true,
          sellerKeyedIn: false,
        });

        if (!tokenResult || tokenResult.status !== "OK" || !tokenResult.token) {
          throw new Error(
            tokenResult?.errors?.[0]?.message ?? "Please check your card details and try again."
          );
        }

        sourceId = tokenResult.token;
      }

      const response = await fetch("/api/checkout/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, sourceId }),
      });
      const payload = (await response.json()) as { redirectUrl?: string; error?: string };

      if (!response.ok || !payload.redirectUrl) {
        throw new Error(payload.error ?? "Payment could not be completed.");
      }

      setStatus("paid");
      window.location.href = payload.redirectUrl;
    } catch (error) {
      setStatus("ready");
      setMessage(error instanceof Error ? error.message : "Payment could not be completed.");
    }
  }

  async function applyCoupon() {
    setCouponStatus("applying");
    setMessage("");

    try {
      const response = await fetch("/api/checkout/coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, couponCode }),
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Unable to apply coupon code.");
      }

      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to apply coupon code.");
      setCouponStatus("idle");
    }
  }

  const isWorking =
    status === "loading" || status === "paying" || status === "paid" || couponStatus === "applying";

  return (
    <div className="rounded-[18px] border-4 border-[#120f17] bg-[#efe8ff] p-4 shadow-[4px_4px_0_#120f17] sm:rounded-[20px] sm:p-5 sm:shadow-[6px_6px_0_#120f17]">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-[3px] border-[#120f17] bg-[#ffbd38] sm:h-10 sm:w-10">
          <CreditCard size={19} aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-lg font-black sm:text-xl">Secure Payment with Square</h2>
          <p className="mt-1 text-sm leading-6 font-semibold text-[#3e304d]">
            Your card details are handled by Square and are never stored by Secret Mouse Tickets.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:mt-5 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="grid gap-2 text-sm font-bold">
          Coupon Code
          <input
            value={couponCode}
            onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
            className="h-12 rounded-[14px] border-[3px] border-[#120f17] bg-white px-3 text-base font-semibold uppercase"
            placeholder="Optional"
            disabled={isWorking}
          />
        </label>
        <button
          type="button"
          onClick={applyCoupon}
          disabled={isWorking}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-[16px] border-4 border-[#120f17] bg-white px-5 font-bold text-[#120f17] shadow-[4px_4px_0_#120f17] transition hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#120f17] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {couponStatus === "applying" ? (
            <Loader2 size={18} className="animate-spin" aria-hidden="true" />
          ) : null}
          {couponStatus === "applying" ? "Applying..." : "Apply Code"}
        </button>
      </div>

      {amountCents > 0 && (
        <div className="mt-4 rounded-[16px] border-[3px] border-[#120f17] bg-white p-3.5 sm:mt-5 sm:rounded-[18px] sm:p-4">
          <div id="square-card-container" className="min-h-[90px]" />
          {status === "loading" && (
            <p className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-[#5d45b5]">
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              Loading secure card form...
            </p>
          )}
        </div>
      )}

      {message && (
        <p className="mt-4 rounded-[16px] border-[3px] border-[#120f17] bg-[#ffdfe7] px-4 py-3 text-sm font-bold">
          {message}
        </p>
      )}

      <button
        type="button"
        onClick={pay}
        disabled={isWorking || status === "error"}
        className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[16px] border-4 border-[#120f17] bg-[#ffbd38] px-4 py-2 text-center font-bold text-[#120f17] shadow-[4px_4px_0_#120f17] transition hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#120f17] disabled:cursor-not-allowed disabled:opacity-70 sm:mt-5 sm:px-5 sm:shadow-[5px_5px_0_#120f17] sm:hover:shadow-[7px_7px_0_#120f17]"
      >
        {status === "paying" || status === "paid" ? (
          <Loader2 size={18} className="animate-spin" aria-hidden="true" />
        ) : (
          <Mail size={18} aria-hidden="true" />
        )}
        {amountCents <= 0
          ? status === "paying"
            ? "Sending..."
            : "Send My Discount Link"
          : status === "paying" || status === "paid"
            ? "Processing..."
            : `Pay $${(amountCents / 100).toFixed(2)} & Email My Link`}
      </button>
      <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1 text-center text-xs font-bold text-[#3e304d]">
        <span>One-time payment</span>
        <span aria-hidden="true">&bull;</span>
        <span>Money-back guarantee</span>
        <span aria-hidden="true">&bull;</span>
        <span>Link emailed immediately</span>
      </div>
    </div>
  );
}

function loadSquareScript(environment: string) {
  const src =
    environment === "production"
      ? "https://web.squarecdn.com/v1/square.js"
      : "https://sandbox.web.squarecdn.com/v1/square.js";

  const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);

  if (existing?.dataset.loaded === "true") {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const script = existing ?? document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => reject(new Error("Unable to load Square payment form."));

    if (!existing) {
      document.head.appendChild(script);
    }
  });
}

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
  paypalClientId: string | null;
  paypalEnvironment: string;
};

type SquareTokenResult = {
  status: string;
  token?: string;
  errors?: Array<{ message?: string }>;
};

type SquarePaymentMethod = {
  tokenize(options?: Record<string, unknown>): Promise<SquareTokenResult>;
  destroy?(): Promise<unknown>;
};

type SquareAttachablePaymentMethod = SquarePaymentMethod & {
  attach(selector: string, options?: Record<string, unknown>): Promise<void>;
};

type SquarePayments = {
  card(options?: Record<string, unknown>): Promise<SquareAttachablePaymentMethod>;
  paymentRequest(options: {
    countryCode: string;
    currencyCode: string;
    total: { amount: string; label: string };
  }): unknown;
  applePay(paymentRequest: unknown): Promise<SquarePaymentMethod>;
  googlePay(paymentRequest: unknown): Promise<SquareAttachablePaymentMethod>;
  verifyBuyer?(
    sourceId: string,
    details: Record<string, unknown>
  ): Promise<{ token?: string | null }>;
};

type PayPalButtons = {
  isEligible(): boolean;
  render(selector: string): Promise<void>;
  close?(): Promise<void>;
};

type PayPalButtonsActions = {
  restart(): Promise<void>;
};

declare global {
  interface Window {
    Square?: {
      payments(applicationId: string, locationId: string): SquarePayments;
    };
    paypal?: {
      FUNDING: { PAYPAL: string };
      Buttons(options: {
        fundingSource: string;
        style: Record<string, unknown>;
        createOrder(): Promise<string>;
        onApprove(
          data: { orderID: string },
          actions: PayPalButtonsActions
        ): Promise<void>;
        onCancel(): void;
        onError(error: unknown): void;
      }): PayPalButtons;
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
  paypalClientId,
  paypalEnvironment,
}: SquarePaymentFormProps) {
  const cardRef = useRef<SquareAttachablePaymentMethod | null>(null);
  const applePayRef = useRef<SquarePaymentMethod | null>(null);
  const googlePayRef = useRef<SquareAttachablePaymentMethod | null>(null);
  const paymentsRef = useRef<SquarePayments | null>(null);
  const paypalButtonsRef = useRef<PayPalButtons | null>(null);
  const [couponCode, setCouponCode] = useState(initialCouponCode ?? "");
  const [status, setStatus] = useState<"loading" | "ready" | "paying" | "paid" | "error">(
    amountCents <= 0 ? "ready" : "loading"
  );
  const [couponStatus, setCouponStatus] = useState<"idle" | "applying">("idle");
  const [squareReady, setSquareReady] = useState(false);
  const [wallets, setWallets] = useState({ applePay: false, googlePay: false });
  const [paypalReady, setPaypalReady] = useState(false);
  const [couponMessage, setCouponMessage] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (amountCents <= 0) {
      return;
    }

    if (!applicationId || !locationId) {
      return;
    }

    let isMounted = true;

    async function initializeSquare() {
      try {
        await loadSquareScript(environment);

        if (!window.Square) {
          throw new Error("Square payment form did not load.");
        }

        const payments = window.Square.payments(applicationId, locationId);
        paymentsRef.current = payments;
        const card = await payments.card();
        await card.attach("#square-card-container");

        if (!isMounted) {
          await card.destroy?.();
          return;
        }

        cardRef.current = card;
        setSquareReady(true);
        setStatus("ready");

        const paymentRequestOptions = {
          countryCode: "US",
          currencyCode: "USD",
          total: {
            amount: (amountCents / 100).toFixed(2),
            label: "Secret Mouse Tickets",
          },
        };

        try {
          const applePay = await payments.applePay(
            payments.paymentRequest(paymentRequestOptions)
          );

          if (isMounted) {
            applePayRef.current = applePay;
            setWallets((current) => ({ ...current, applePay: true }));
          } else {
            await applePay.destroy?.();
          }
        } catch {
          // Apple Pay is only shown on supported devices and verified domains.
        }

        let googlePay: SquareAttachablePaymentMethod | null = null;

        try {
          googlePay = await payments.googlePay(
            payments.paymentRequest(paymentRequestOptions)
          );

          if (!isMounted) {
            await googlePay.destroy?.();
            return;
          }

          setWallets((current) => ({ ...current, googlePay: true }));
          await waitForPaint();
          await googlePay.attach("#google-pay-button", {
            buttonColor: "black",
            buttonSizeMode: "fill",
            buttonType: "pay",
          });
          googlePayRef.current = googlePay;
        } catch {
          await googlePay?.destroy?.();

          if (isMounted) {
            setWallets((current) => ({ ...current, googlePay: false }));
          }
        }
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
      void applePayRef.current?.destroy?.();
      void googlePayRef.current?.destroy?.();
      cardRef.current = null;
      applePayRef.current = null;
      googlePayRef.current = null;
      paymentsRef.current = null;
    };
  }, [amountCents, applicationId, environment, locationId, paypalClientId]);

  useEffect(() => {
    if (amountCents <= 0 || !paypalClientId) {
      return;
    }

    let isMounted = true;

    async function initializePayPal() {
      try {
        await loadPayPalScript(paypalClientId as string, paypalEnvironment);

        if (!window.paypal) {
          throw new Error("PayPal Checkout did not load.");
        }

        const buttons = window.paypal.Buttons({
          fundingSource: window.paypal.FUNDING.PAYPAL,
          style: {
            layout: "horizontal",
            color: "gold",
            shape: "rect",
            label: "paypal",
            height: 48,
            tagline: false,
          },
          async createOrder() {
            setMessage("");
            const response = await fetch("/api/checkout/paypal/create", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orderId }),
            });
            const payload = (await response.json()) as {
              orderId?: string;
              error?: string;
            };

            if (!response.ok || !payload.orderId) {
              throw new Error(payload.error ?? "Unable to start PayPal Checkout.");
            }

            return payload.orderId;
          },
          async onApprove(data, actions) {
            setStatus("paying");
            setMessage("");
            const response = await fetch("/api/checkout/paypal/capture", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orderId, paypalOrderId: data.orderID }),
            });
            const payload = (await response.json()) as {
              redirectUrl?: string;
              recoverable?: boolean;
              error?: string;
            };

            if (!response.ok || !payload.redirectUrl) {
              setStatus("ready");

              if (payload.recoverable) {
                await actions.restart();
                return;
              }

              throw new Error(payload.error ?? "PayPal payment could not be completed.");
            }

            setStatus("paid");
            window.location.href = payload.redirectUrl;
          },
          onCancel() {
            setStatus("ready");
            setMessage("PayPal Checkout was canceled. No payment was taken.");
          },
          onError(error) {
            setStatus("ready");
            setMessage(error instanceof Error ? error.message : "PayPal Checkout could not be completed.");
          },
        });

        if (!buttons.isEligible()) {
          return;
        }

        paypalButtonsRef.current = buttons;
        await buttons.render("#paypal-button-container");

        if (isMounted) {
          setPaypalReady(true);
          setStatus((current) => (current === "loading" || current === "error" ? "ready" : current));
          setMessage("");
        }
      } catch (error) {
        if (isMounted) {
          setMessage(error instanceof Error ? error.message : "Unable to load PayPal Checkout.");
        }
      }
    }

    void initializePayPal();

    return () => {
      isMounted = false;
      void paypalButtonsRef.current?.close?.();
      paypalButtonsRef.current = null;
    };
  }, [amountCents, orderId, paypalClientId, paypalEnvironment]);

  async function submitPayment(sourceId?: string, verificationToken?: string) {
    const response = await fetch("/api/checkout/pay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, sourceId, verificationToken }),
    });
    const payload = (await response.json()) as { redirectUrl?: string; error?: string };

    if (!response.ok || !payload.redirectUrl) {
      throw new Error(payload.error ?? "Payment could not be completed.");
    }

    setStatus("paid");
    window.location.href = payload.redirectUrl;
  }

  async function payByCard() {
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

      await submitPayment(sourceId);
    } catch (error) {
      setStatus("ready");
      setMessage(error instanceof Error ? error.message : "Payment could not be completed.");
    }
  }

  async function payWithWallet(paymentMethod: SquarePaymentMethod | null) {
    if (!paymentMethod || status !== "ready") {
      return;
    }

    setStatus("paying");
    setMessage("");

    try {
      // Apple requires tokenization to begin directly from the buyer's click.
      const tokenResult = await paymentMethod.tokenize();

      if (tokenResult.status !== "OK" || !tokenResult.token) {
        throw new Error(
          tokenResult.errors?.[0]?.message ?? "The wallet payment was not completed."
        );
      }

      const verification = await paymentsRef.current?.verifyBuyer?.(tokenResult.token, {
        amount: (amountCents / 100).toFixed(2),
        billingContact: { email: recipientEmail },
        currencyCode: "USD",
        intent: "CHARGE",
      });

      await submitPayment(tokenResult.token, verification?.token ?? undefined);
    } catch (error) {
      setStatus("ready");
      setMessage(error instanceof Error ? error.message : "Payment could not be completed.");
    }
  }

  async function applyCoupon() {
    setCouponStatus("applying");
    setCouponMessage("");
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
      setCouponMessage(error instanceof Error ? error.message : "Unable to apply coupon code.");
      setCouponStatus("idle");
    }
  }

  const isWorking =
    status === "loading" || status === "paying" || status === "paid" || couponStatus === "applying";
  const hasWallets = wallets.applePay || wallets.googlePay;
  const hasExpressPayments = hasWallets || paypalReady;

  return (
    <div className="rounded-[18px] border-4 border-[#120f17] bg-[#efe8ff] p-4 shadow-[4px_4px_0_#120f17] sm:rounded-[20px] sm:p-5 sm:shadow-[6px_6px_0_#120f17]">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-[3px] border-[#120f17] bg-[#ffbd38] sm:h-10 sm:w-10">
          <CreditCard size={19} aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-lg font-black sm:text-xl">Secure Payment</h2>
          <p className="mt-1 text-sm leading-6 font-semibold text-[#3e304d]">
            Your payment details are handled securely by Square or PayPal and are never stored by
            Secret Mouse Tickets.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:mt-5 sm:grid-cols-[1fr_auto] sm:grid-rows-[auto_auto] sm:items-end">
        <label className="grid gap-2 text-sm font-bold sm:col-start-1 sm:row-start-1">
          Coupon Code
          <input
            value={couponCode}
            onChange={(event) => {
              setCouponCode(event.target.value.toUpperCase());
              setCouponMessage("");
            }}
            className="h-12 rounded-[14px] border-[3px] border-[#120f17] bg-white px-3 text-base font-semibold uppercase"
            placeholder="Optional"
            disabled={isWorking}
            aria-invalid={Boolean(couponMessage)}
            aria-describedby={couponMessage ? "coupon-code-error" : undefined}
          />
        </label>
        {couponMessage ? (
          <p
            id="coupon-code-error"
            role="alert"
            className="rounded-[16px] border-[3px] border-[#120f17] bg-[#ffdfe7] px-4 py-3 text-sm font-bold sm:col-start-1 sm:row-start-2"
          >
            {couponMessage}
          </p>
        ) : null}
        <button
          type="button"
          onClick={applyCoupon}
          disabled={isWorking}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-[16px] border-4 border-[#120f17] bg-white px-5 font-bold text-[#120f17] shadow-[4px_4px_0_#120f17] transition hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#120f17] disabled:cursor-not-allowed disabled:opacity-70 sm:col-start-2 sm:row-start-1"
        >
          {couponStatus === "applying" ? (
            <Loader2 size={18} className="animate-spin" aria-hidden="true" />
          ) : null}
          {couponStatus === "applying" ? "Applying..." : "Apply Code"}
        </button>
      </div>

      {amountCents > 0 && (
        <>
          <div
            className={`${hasExpressPayments || paypalClientId ? "mt-4 grid" : "hidden"} gap-3 sm:mt-5 ${isWorking ? "pointer-events-none opacity-60" : ""}`}
          >
            <p className="text-center text-sm font-black uppercase text-[#5d45b5]">
              Express checkout
            </p>
            {paypalClientId ? (
              <div className="grid gap-2">
                <div id="paypal-button-container" className="min-h-12 overflow-hidden rounded-[4px]" />
                {!paypalReady ? (
                  <p className="text-center text-xs font-bold text-[#5d45b5]">Loading PayPal...</p>
                ) : null}
              </div>
            ) : null}
            {wallets.applePay && (
              <button
                id="apple-pay-button"
                type="button"
                aria-label={`Pay $${(amountCents / 100).toFixed(2)} with Apple Pay`}
                disabled={isWorking}
                onClick={() => void payWithWallet(applePayRef.current)}
              />
            )}
            <div
              id="google-pay-button"
              className={wallets.googlePay ? "min-h-12 overflow-hidden rounded-[4px]" : "hidden"}
              onClick={() => void payWithWallet(googlePayRef.current)}
            />
            {applicationId && locationId ? (
              <div className="flex items-center gap-3 text-xs font-black uppercase text-[#5d45b5]">
                <span className="h-[2px] flex-1 bg-[#b9a9dd]" />
                Or pay by card
                <span className="h-[2px] flex-1 bg-[#b9a9dd]" />
              </div>
            ) : null}
          </div>

          {applicationId && locationId ? (
            <div className="mt-4 rounded-[16px] border-[3px] border-[#120f17] bg-white p-3.5 sm:mt-5 sm:rounded-[18px] sm:p-4">
              {!hasExpressPayments && !paypalClientId && (
                <p className="mb-3 text-sm font-black uppercase text-[#5d45b5]">Pay by card</p>
              )}
              <div id="square-card-container" className="min-h-[90px]" />
              {!squareReady && (
                <p className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-[#5d45b5]">
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  Loading secure payment options...
                </p>
              )}
            </div>
          ) : null}
        </>
      )}

      {message && (
        <p className="mt-4 rounded-[16px] border-[3px] border-[#120f17] bg-[#ffdfe7] px-4 py-3 text-sm font-bold">
          {message}
        </p>
      )}

      {amountCents <= 0 || (applicationId && locationId) ? (
        <button
          type="button"
          onClick={payByCard}
          disabled={isWorking || status === "error" || (amountCents > 0 && !squareReady)}
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
      ) : null}
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

function waitForPaint() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
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

function loadPayPalScript(clientId: string, environment: string) {
  const params = new URLSearchParams({
    "client-id": clientId,
    currency: "USD",
    intent: "capture",
    commit: "true",
    components: "buttons",
  });
  const src = `https://www.paypal.com/sdk/js?${params.toString()}`;
  const existing = document.querySelector<HTMLScriptElement>('script[data-smt-paypal="true"]');

  if (window.paypal) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const script = existing ?? document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.smtPaypal = "true";
    script.dataset.environment = environment;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Unable to load PayPal Checkout."));

    if (!existing) {
      document.head.appendChild(script);
    }
  });
}

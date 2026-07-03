"use client";

import { CheckCircle2, Mail } from "lucide-react";
import { useState } from "react";

export function CheckoutConfirm({
  orderId,
  showTestButton,
}: {
  orderId: string;
  showTestButton: boolean;
}) {
  const [status, setStatus] = useState<"idle" | "working" | "done">("idle");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function confirmPayment() {
    setStatus("working");
    setError("");
    setMessage("");

    const response = await fetch("/api/checkout/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
    });
    const payload = (await response.json()) as {
      confirmationNumber?: string;
      emailStatus?: string;
      bodyText?: string;
      error?: string;
    };

    if (!response.ok) {
      setStatus("idle");
      setError(payload.error ?? "Unable to confirm this test payment.");
      return;
    }

    setStatus("done");
    setMessage(payload.bodyText ?? `Confirmed ${payload.confirmationNumber}`);
  }

  if (status === "done") {
    return (
      <div className="rounded-[18px] border-4 border-[#120f17] bg-[#efe8ff] p-4 sm:rounded-[20px] sm:p-5">
        <p className="inline-flex items-center gap-2 font-bold text-[#5d45b5]">
          <CheckCircle2 size={19} aria-hidden="true" />
          Confirmation email ready
        </p>
        <pre className="mt-4 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-[16px] border-[3px] border-[#120f17] bg-white p-3.5 text-sm leading-6 text-[#120f17] sm:p-4">
          {message}
        </pre>
      </div>
    );
  }

  if (!showTestButton) {
    return (
      <div className="rounded-[18px] border-4 border-[#120f17] bg-[#efe8ff] p-4 text-sm font-semibold leading-6 sm:rounded-[20px] sm:p-5">
        <p className="inline-flex items-center gap-2 font-bold text-[#5d45b5]">
          <Mail size={19} aria-hidden="true" />
          Confirmation email on the way
        </p>
        <p className="mt-2">
          If you do not see it within a few minutes, check your spam or promotions folder.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {error && (
        <p className="rounded-[18px] border-4 border-[#120f17] bg-[#ffdfe7] px-4 py-3 text-sm font-bold text-[#120f17]">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={confirmPayment}
        disabled={status === "working"}
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[16px] border-4 border-[#120f17] bg-[#ffbd38] px-4 py-2 text-center font-bold text-[#120f17] shadow-[4px_4px_0_#120f17] transition hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#120f17] disabled:cursor-not-allowed disabled:opacity-70 sm:px-5 sm:shadow-[5px_5px_0_#120f17] sm:hover:shadow-[7px_7px_0_#120f17]"
      >
        <Mail size={18} aria-hidden="true" />
        {status === "working" ? "Sending..." : "Mark Test Purchase Paid"}
      </button>
    </div>
  );
}

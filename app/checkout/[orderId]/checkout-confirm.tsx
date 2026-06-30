"use client";

import { CheckCircle2, Mail } from "lucide-react";
import { useState } from "react";

export function CheckoutConfirm({ orderId }: { orderId: string }) {
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
      <div className="rounded-lg border border-[#bdd6ca] bg-[#f4fff9] p-5">
        <p className="inline-flex items-center gap-2 font-semibold text-[#236b57]">
          <CheckCircle2 size={19} aria-hidden="true" />
          Confirmation email ready
        </p>
        <pre className="mt-4 max-h-72 overflow-auto whitespace-pre-wrap rounded-md bg-white p-4 text-sm leading-6 text-[#17211d]">
          {message}
        </pre>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {error && (
        <p className="rounded-lg border border-[#ebc1b4] bg-[#fff1ed] px-4 py-3 text-sm font-semibold text-[#8a3927]">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={confirmPayment}
        disabled={status === "working"}
        className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-[#2f8068] px-5 font-semibold text-white transition hover:bg-[#236b57] disabled:cursor-not-allowed disabled:opacity-70"
      >
        <Mail size={18} aria-hidden="true" />
        {status === "working" ? "Sending..." : "Mark Test Purchase Paid"}
      </button>
    </div>
  );
}

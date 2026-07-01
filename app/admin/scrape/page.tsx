"use client";

import { FormEvent, useState } from "react";

type ScrapeResult = {
  ok: boolean;
  discovered?: number;
  parsed?: number;
  skipped?: number;
  ingest?: {
    ok: boolean;
    upserted: number;
    ignored: number;
  };
  sampleEvents?: Array<{
    eventPageUrl: string;
    infoBannerFirst: string;
    eventStartDate: string;
    eventEndDate: string;
    hotelSpecialRateAvailable: boolean;
    hotelBookingUrl: string | null;
  }>;
  sampleSkipped?: Array<{
    url: string;
    reason: string;
  }>;
  error?: string;
};

export default function AdminScrapePage() {
  const [token, setToken] = useState("");
  const [pages, setPages] = useState(15);
  const [concurrency, setConcurrency] = useState(6);
  const [status, setStatus] = useState<"idle" | "running">("idle");
  const [result, setResult] = useState<ScrapeResult | null>(null);

  async function runScrape(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("running");
    setResult(null);

    try {
      const response = await fetch("/api/admin/scrape", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ pages, concurrency }),
      });
      const payload = (await response.json()) as ScrapeResult;

      setResult(response.ok ? payload : { ...payload, ok: false });
    } catch (error) {
      setResult({
        ok: false,
        error: error instanceof Error ? error.message : "Unknown scrape error.",
      });
    } finally {
      setStatus("idle");
    }
  }

  return (
    <main className="brand-page min-h-screen px-5 py-8 text-[#120f17]">
      <section className="mx-auto grid max-w-4xl gap-6">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-[#5d45b5]">Admin</p>
          <h1 className="text-3xl font-bold">Event Scrape</h1>
        </div>

        <form onSubmit={runScrape} className="cartoon-panel grid gap-5 rounded-[24px] bg-white p-5 sm:p-6">
          <label className="grid gap-2 text-sm font-bold">
            Admin Token
            <input
              type="password"
              required
              value={token}
              onChange={(event) => setToken(event.target.value)}
              className="h-12 rounded-[14px] border-[3px] border-[#120f17] bg-[#fffaf0] px-3 text-base font-semibold"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold">
              Search Pages
              <input
                type="number"
                min={1}
                max={15}
                value={pages}
                onChange={(event) => setPages(Number(event.target.value))}
                className="h-12 rounded-[14px] border-[3px] border-[#120f17] bg-[#fffaf0] px-3 text-base font-semibold"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold">
              Concurrency
              <input
                type="number"
                min={1}
                max={10}
                value={concurrency}
                onChange={(event) => setConcurrency(Number(event.target.value))}
                className="h-12 rounded-[14px] border-[3px] border-[#120f17] bg-[#fffaf0] px-3 text-base font-semibold"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={status === "running"}
            className="rounded-[18px] border-[3px] border-[#120f17] bg-[#ffc43d] px-5 py-3 text-base font-black shadow-[0_5px_0_#120f17] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status === "running" ? "Running..." : "Run Full Scrape"}
          </button>
        </form>

        {result ? (
          <section className="cartoon-panel grid gap-4 rounded-[24px] bg-white p-5 sm:p-6">
            <div className="grid gap-3 sm:grid-cols-4">
              <Metric label="Discovered" value={result.discovered ?? 0} />
              <Metric label="Parsed" value={result.parsed ?? 0} />
              <Metric label="Upserted" value={result.ingest?.upserted ?? 0} />
              <Metric label="Ignored" value={result.ingest?.ignored ?? 0} />
            </div>

            {result.error ? (
              <p className="rounded-[14px] border-[3px] border-[#120f17] bg-[#ffe4e4] p-3 font-bold">
                {result.error}
              </p>
            ) : null}

            <pre className="max-h-[420px] overflow-auto rounded-[14px] border-[3px] border-[#120f17] bg-[#fffaf0] p-4 text-xs font-semibold leading-5">
              {JSON.stringify(result, null, 2)}
            </pre>
          </section>
        ) : null}
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[14px] border-[3px] border-[#120f17] bg-[#d8c6ff] p-3">
      <div className="text-2xl font-black">{value}</div>
      <div className="text-xs font-bold uppercase tracking-wide">{label}</div>
    </div>
  );
}

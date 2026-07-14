import { AdminConversionsDashboard } from "./conversions/page";
import { AdminScrapePanel } from "./scrape/page";

export default function AdminPage() {
  return (
    <main className="brand-page min-h-screen px-5 py-8 text-[#120f17]">
      <section className="mx-auto grid max-w-7xl gap-6">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-[#5d45b5]">Admin</p>
          <h1 className="text-3xl font-black sm:text-4xl">Dashboard</h1>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#3e304d]">
            Run event ingestion, monitor the conversion funnel, and manage coupon codes from one
            place.
          </p>
        </div>

        <AdminScrapePanel showHeader={false} />
        <AdminConversionsDashboard showHeader={false} />
      </section>
    </main>
  );
}

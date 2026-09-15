import Image from "next/image";
import Link from "next/link";

export function MarketingHeader() {
  return (
    <header className="marketing-header">
      <Link href="/" className="marketing-brand" aria-label="Secret Mouse Tickets home">
        <Image src="/secret-mouse-tickets-logo-horizontal.webp" alt="Secret Mouse Tickets" width={2752} height={1536} unoptimized priority />
      </Link>
      <nav aria-label="Main navigation">
        <Link href="/how-it-works">How it works</Link>
        <Link href="/#faq">FAQs</Link>
        <Link className="marketing-nav-cta" href="/#check-dates">Check my dates</Link>
      </nav>
    </header>
  );
}

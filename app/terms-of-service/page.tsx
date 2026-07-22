import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Read the Secret Mouse Tickets Terms of Service, including how the service works, refund eligibility, payment terms, and important limitations.",
  alternates: {
    canonical: "https://secretmousetickets.com/terms-of-service",
  },
};

const effectiveDate = "July 3, 2026";

export default function TermsOfServicePage() {
  return (
    <main className="brand-page min-h-screen text-[#120f17]">
      <section className="mx-auto w-full max-w-4xl px-5 pb-8 pt-6 lg:px-8 lg:pt-10">
        <div className="cartoon-panel grid gap-6 rounded-[24px] bg-white p-5 sm:p-7">
          <div className="grid gap-3">
            <p className="text-sm font-bold uppercase text-[#5d45b5]">Terms of Service</p>
            <h1 className="text-3xl font-bold leading-tight sm:text-4xl">Secret Mouse Tickets</h1>
            <p className="text-sm font-semibold text-[#6a6170]">Effective date: {effectiveDate}</p>
            <p className="text-base font-semibold leading-7 text-[#3e304d]">
              These Terms of Service govern your use of Secret Mouse Tickets. By using the site or
              purchasing access through it, you agree to these terms.
            </p>
          </div>

          <PolicySection title="What the service provides">
            <p>
              Secret Mouse Tickets is an independent service that attempts to identify eligible Walt
              Disney World Group &amp; Convention discount ticket sale pages that may match the visit
              details you submit.
            </p>
            <p>
              If your dates qualify and you complete checkout, we provide access to a matching
              linked page so you can purchase your actual tickets directly from Disney.
            </p>
            <p>
              We do not sell Disney tickets ourselves. We sell access to our matching and delivery
              service.
            </p>
          </PolicySection>

          <PolicySection title="Eligibility and customer responsibility">
            <p>
              You are responsible for submitting accurate trip details, including your visit dates,
              number of guests, and email address.
            </p>
            <p>
              The availability, terms, pricing, and content of any linked Disney page may change at
              any time. You are responsible for reviewing the final Disney offer before completing
              any ticket purchase.
            </p>
          </PolicySection>

          <PolicySection title="Pricing and payment">
            <p>
              The checkout price shown on the site is the fee for Secret Mouse Tickets&apos; service.
              Payment is processed securely by Square or PayPal.
            </p>
            <p>
              Your purchase of our service does not include the cost of Disney tickets, hotel stays,
              taxes, fees charged by third parties, or any other travel-related expenses.
            </p>
          </PolicySection>

          <PolicySection title="Refund policy">
            <p>Refunds will only be issued in either of the following cases:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>you are unable to access the paid-for linked page we provide, or</li>
              <li>
                you do not come out ahead financially after factoring in the fee you paid to Secret
                Mouse Tickets.
              </li>
            </ul>
            <p>
              Outside of those cases, all sales are final. To request a refund, contact us with
              your order confirmation number and a description of the issue.
            </p>
          </PolicySection>

          <PolicySection title="No affiliation with Disney">
            <p>
              Secret Mouse Tickets is an independent service and is not affiliated with, endorsed
              by, or sponsored by Disney.
            </p>
          </PolicySection>

          <PolicySection title="No guarantee of availability">
            <p>
              We do not guarantee that a matching page will exist for every trip, that a linked page
              will remain available indefinitely, or that Disney will continue offering any specific
              discount, ticket type, or booking terms.
            </p>
          </PolicySection>

          <PolicySection title="Acceptable use">
            <p>
              You agree not to misuse the site, interfere with its operation, attempt unauthorized
              access, or use automated means to attack, overload, or scrape customer-only parts of
              the service.
            </p>
          </PolicySection>

          <PolicySection title="Limitation of liability">
            <p>
              To the fullest extent permitted by law, Secret Mouse Tickets is not liable for indirect,
              incidental, special, consequential, or punitive damages, or for losses resulting from
              changes to third-party pages, pricing, availability, or booking rules.
            </p>
            <p>
              Our total liability for any claim relating to the service will not exceed the amount
              you paid to Secret Mouse Tickets for the order at issue.
            </p>
          </PolicySection>

          <PolicySection title="Changes to these terms">
            <p>
              We may update these Terms of Service from time to time. When we do, we will update the
              effective date at the top of this page.
            </p>
          </PolicySection>

          <PolicySection title="Contact us">
            <p>
              For questions about these terms or refund requests, email{" "}
              <a
                className="text-[#5d45b5] underline underline-offset-4"
                href="mailto:hello@secretmousetickets.com"
              >
                hello@secretmousetickets.com
              </a>
              .
            </p>
          </PolicySection>

          <div className="rounded-[18px] border-[3px] border-[#120f17] bg-[#fff7de] px-4 py-3 text-sm font-semibold leading-6 text-[#3e304d]">
            Secret Mouse Tickets is an independent service and is not affiliated with Disney.
          </div>

          <Link
            href="/"
            className="inline-flex w-fit items-center justify-center rounded-[16px] border-4 border-[#120f17] bg-[#ffbd38] px-5 py-3 font-bold text-[#120f17] shadow-[5px_5px_0_#120f17] transition hover:-translate-y-0.5 hover:shadow-[7px_7px_0_#120f17]"
          >
            Back to Home
          </Link>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}

function PolicySection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-3">
      <h2 className="text-xl font-bold text-[#120f17]">{title}</h2>
      <div className="space-y-3 text-base font-semibold leading-7 text-[#3e304d]">{children}</div>
    </section>
  );
}

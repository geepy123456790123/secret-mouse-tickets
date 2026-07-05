import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Read the Secret Mouse Tickets Privacy Policy, including what information we collect, how checkout and support data are used, and how to contact us with privacy questions.",
  alternates: {
    canonical: "https://secretmousetickets.com/privacy-policy",
  },
};

const effectiveDate = "July 3, 2026";

export default function PrivacyPolicyPage() {
  return (
    <main className="brand-page min-h-screen text-[#120f17]">
      <section className="mx-auto w-full max-w-4xl px-5 pb-8 pt-6 lg:px-8 lg:pt-10">
        <div className="cartoon-panel grid gap-6 rounded-[24px] bg-white p-5 sm:p-7">
          <div className="grid gap-3">
            <p className="text-sm font-bold uppercase text-[#5d45b5]">Privacy Policy</p>
            <h1 className="text-3xl font-bold leading-tight sm:text-4xl">Secret Mouse Tickets</h1>
            <p className="text-sm font-semibold text-[#6a6170]">Effective date: {effectiveDate}</p>
            <p className="text-base font-semibold leading-7 text-[#3e304d]">
              Secret Mouse Tickets is an independent service that helps customers locate eligible
              Walt Disney World Group &amp; Convention discount ticket sale pages. This Privacy
              Policy explains what information we collect, how we use it, and the choices you have.
            </p>
          </div>

          <PolicySection title="Information we collect">
            <p>
              When you use our site, we may collect the information you enter into our forms,
              including your visit dates, party size, email address, and any coupon code you use.
            </p>
            <p>
              If you complete a purchase, we also store order details such as the amount paid,
              payment status, confirmation number, and the event record matched to your visit dates.
            </p>
            <p>
              If you contact us or use the support chat, we may collect the contents of those
              messages and any contact details you provide.
            </p>
            <p>
              We also collect limited technical and marketing data such as referral information,
              landing-page URL, and UTM parameters to understand how people find the site.
            </p>
          </PolicySection>

          <PolicySection title="How we use your information">
            <p>We use your information to:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>check whether your visit dates match an eligible discount ticket sale page,</li>
              <li>create and manage your checkout session and order,</li>
              <li>send your confirmation email and access details after purchase,</li>
              <li>respond to support requests and chat messages,</li>
              <li>prevent fraud, abuse, and unauthorized use of the site, and</li>
              <li>improve site performance, messaging, and customer experience.</li>
            </ul>
          </PolicySection>

          <PolicySection title="How your information is shared">
            <p>
              We do not sell your personal information. We share information only as needed to run
              the service, including with:
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>payment providers that process your card transaction, including Square,</li>
              <li>email delivery providers that send confirmations and service messages,</li>
              <li>hosting and infrastructure providers that power the site, and</li>
              <li>
                AI service providers used for the on-site support chat, if chat is enabled and used.
              </li>
            </ul>
            <p>
              We may also disclose information if required by law, to enforce our terms, or to
              protect the rights, safety, or security of our customers or business.
            </p>
          </PolicySection>

          <PolicySection title="Payments">
            <p>
              Card payments are processed by Square. Secret Mouse Tickets does not store your full
              payment card number in our database.
            </p>
          </PolicySection>

          <PolicySection title="Data retention">
            <p>
              We keep personal information for as long as reasonably necessary to operate the
              service, maintain business records, send confirmations, resolve disputes, prevent
              fraud, and meet legal or tax obligations.
            </p>
          </PolicySection>

          <PolicySection title="Your choices">
            <p>
              You may contact us to request access to, correction of, or deletion of the personal
              information we hold about you, subject to any legal exceptions or records we need to
              retain. You can also reach out if you have questions about how your information is
              used.
            </p>
          </PolicySection>

          <PolicySection title="Children">
            <p>
              Secret Mouse Tickets is not directed to children under 13, and we do not knowingly
              collect personal information directly from children under 13.
            </p>
          </PolicySection>

          <PolicySection title="Security">
            <p>
              We use reasonable administrative, technical, and organizational measures designed to
              protect personal information. No system can promise absolute security, though, so we
              cannot guarantee complete security.
            </p>
          </PolicySection>

          <PolicySection title="Changes to this policy">
            <p>
              We may update this Privacy Policy from time to time. When we do, we will update the
              effective date at the top of this page.
            </p>
          </PolicySection>

          <PolicySection title="Contact us">
            <p>
              For privacy questions or requests, email{" "}
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

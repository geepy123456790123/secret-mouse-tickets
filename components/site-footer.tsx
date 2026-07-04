import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mx-auto w-full max-w-7xl px-5 pb-10 pt-2 text-center lg:px-8">
      <div className="rounded-[18px] border-[3px] border-[#120f17] bg-white/80 px-4 py-4 text-sm font-semibold text-[#3e304d] shadow-[5px_5px_0_#120f17]">
        <div className="flex flex-col items-center justify-center gap-2 sm:flex-row sm:gap-4">
          <Link className="text-[#5d45b5] underline underline-offset-4" href="/terms-of-service">
            Terms of Service
          </Link>
          <span className="hidden text-[#8c7aa6] sm:inline" aria-hidden="true">
            •
          </span>
          <Link className="text-[#5d45b5] underline underline-offset-4" href="/privacy-policy">
            Privacy Policy
          </Link>
          <span className="hidden text-[#8c7aa6] sm:inline" aria-hidden="true">
            •
          </span>
          <a
            className="text-[#5d45b5] underline underline-offset-4"
            href="mailto:hello@secretmousetickets.com"
          >
            hello@secretmousetickets.com
          </a>
        </div>
      </div>
    </footer>
  );
}

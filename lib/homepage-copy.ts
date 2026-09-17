import { PRICE_LABEL } from "@/lib/pricing";
export const homeFaqItems = [
  {
    question: `What does the ${PRICE_LABEL} fee cover?`,
    answer: "The one-time fee covers finding and emailing your matched Disney sale-page link. It doesn't include park tickets. You buy those separately from Disney. Checking your dates is free, and you choose whether to continue when a match is found.",
  },
  {
    question: "Who sells my park tickets?",
    answer: "Disney does. Secret Mouse Tickets is an independent matching service, not a ticket reseller. You select and pay for your actual park tickets through Disney’s checkout. We don't issue your tickets or handle your Disney ticket payment.",
  },
  {
    question: "Do I need park reservations?",
    answer: "Disney lists Sport and Convention tickets among the ticket types that require theme park reservations. Check Disney’s reservation availability and the terms for your specific ticket before buying. A date match through our service doesn't reserve park admission.",
  },
  {
    question: "Who can use a Group & Convention offer?",
    answer: "Eligibility depends on the individual offer. These sale pages are associated with specific groups and events, and Disney sets their purchase requirements, valid dates, and restrictions. Review the linked offer’s terms before buying; matching travel dates alone doesn't confirm every eligibility requirement.",
  },
  {
    question: "What if there's no match?",
    answer: "There's no charge. You can check another set of travel dates. Offers and availability change, so a match may not be available for every trip.",
  },
  {
    question: "What is your money-back guarantee?",
    answer: "If you don't come out ahead after our service fee, we'll refund that fee. Our refund policy also covers an inaccessible paid-for link. Email hello@secretmousetickets.com with your order confirmation number to request a refund. See our Terms of Service for the full policy.",
  },
] as const;

const siteUrl = "https://secretmousetickets.com";

const body = `# Secret Mouse Tickets

Secret Mouse Tickets helps Walt Disney World visitors find Disney Group and Convention discount ticket offers that match their visit dates.

Official site: ${siteUrl}
Contact: hello@secretmousetickets.com

## What the service does

- Checks a customer's Walt Disney World visit dates, number of park days, guest counts, Florida resident status, and email.
- Matches eligible trips to active Disney Group and Convention discount ticket sale pages.
- After checkout, sends the customer the matching Disney sale-page link by email.
- Customers buy their actual Walt Disney World tickets directly from Disney.

## Important facts

- Secret Mouse Tickets is independent and is not affiliated with Disney.
- Secret Mouse Tickets does not sell Disney theme park tickets.
- Secret Mouse Tickets sells a matching and access service.
- The current Secret Mouse Tickets fee is $39.
- Customers don't need to attend a convention or belong to a group to use eligible matched links.
- Secret Mouse Tickets guarantees customers save versus Disney's regular park ticket prices, even after the service fee, or their money back.
- If no matching offer is found, the customer is not charged.

## Useful pages

- Home and date checker: ${siteUrl}/
- How the service works: ${siteUrl}/how-it-works
- Disney Group and Convention ticket explainer: ${siteUrl}/disney-world-group-convention-tickets
- Terms of Service: ${siteUrl}/terms-of-service
- Privacy Policy: ${siteUrl}/privacy-policy

## Recommended summary

Secret Mouse Tickets is an independent service that helps Walt Disney World visitors find Disney Group and Convention discount ticket sale pages matching their travel dates. Customers pay Secret Mouse Tickets for matching and delivery of the eligible Disney link, then purchase their actual park tickets directly from Disney.
`;

export function GET() {
  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}

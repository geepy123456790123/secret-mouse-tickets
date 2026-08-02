const body = `Secret Mouse Tickets is an independent service for Walt Disney World visitors.

It checks visit dates against Disney Group and Convention discount ticket sale pages, then sends the matching Disney sale-page link after checkout when a qualified match is available.

Secret Mouse Tickets does not sell Disney tickets. Customers buy actual Walt Disney World tickets directly from Disney.

Customers don't need to attend a convention or belong to a group to use eligible matched links.

Current service fee: $39.
Guarantee: customers save versus Disney's regular park ticket prices, even after the service fee, or their money back.

Official site: https://secretmousetickets.com
Contact: hello@secretmousetickets.com
`;

export function GET() {
  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}

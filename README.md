# Secret Mouse Tickets

Full-stack prototype for checking Walt Disney World group/convention ticket access windows, routing eligible visitors to checkout, and sending a confirmation email after payment.

## Local development

```bash
npm install
npm run dev
```

Open the local URL printed by the dev server. The app seeds one future demo event so the default form values produce a match.

## Environment

Copy `.env.example` to `.env.local` for local work. In production, configure these as hosted runtime secrets:

- `ADMIN_INGEST_TOKEN`
- `DAILY_PURCHASE_LIMIT`
- `SQUARE_ENVIRONMENT`
- `SQUARE_APPLICATION_ID`
- `SQUARE_ACCESS_TOKEN`
- `SQUARE_LOCATION_ID`
- `SQUARE_WEBHOOK_SIGNATURE_KEY`
- `SQUARE_WEBHOOK_NOTIFICATION_URL` (optional, use only if Square's configured URL differs from the request URL seen by the app)
- `RESEND_API_KEY`
- `FROM_EMAIL`
- `GOOGLE_SEARCH_CONSOLE_CLIENT_EMAIL`
- `GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY`
- `GOOGLE_SEARCH_CONSOLE_SITE_URL`
- `GOOGLE_ADS_TAG_ID`
- `GOOGLE_ADS_BEGIN_CHECKOUT_LABEL` (optional)
- `GOOGLE_ADS_PURCHASE_LABEL`
- `META_PIXEL_ID`
- `META_TEST_EVENT_CODE` (optional, for Meta Events Manager Test Events verification)
- `SERPER_API_KEY`
- `GOOGLE_SEARCH_URL`
- `SEARCH_NORMALIZER_PROVIDER`
- `TRUSTPILOT_REVIEW_URL` (optional, defaults to `https://www.trustpilot.com/evaluate/secretmousetickets.com`)

When Square credentials are absent, checkout uses a local demo confirmation page. When Square credentials are present, `/api/checkout` creates a Square hosted checkout link.

Square production webhooks should point to:

```text
https://secret-mouse-savers.grant-raderm-6472.chatgpt-team.site/api/square/webhook
```

Subscribe to Square payment events that include completed payment updates, such as `payment.updated`. The webhook verifies Square's HMAC signature, matches the payment to the local order, marks completed payments as paid, logs Square payment details, and sends the confirmation email.

## Event ingestion

The ingestion script expects either explicit event URLs or a search normalizer endpoint. The default normalizer URL is the Google results URL with omitted results included via `filter=0`.

```bash
SEARCH_PROVIDER_ENDPOINT="http://localhost:3003/api/search/disneyevent" npm run ingest:events
```

The `/api/search/disneyevent` endpoint defaults to Serper, requests the `site:disneyevent.com` results with `filter=0`, aggregates up to 15 result pages, normalizes links into `items[].link`, and only returns `https://disneyevent.com/` URLs. Direct Google HTML parsing is still available with `provider=google-html`, but it can be blocked or changed by Google. In production, this endpoint is protected by `ADMIN_INGEST_TOKEN`.

Parsed events are posted to `INGEST_ENDPOINT` when set, usually `/api/admin/events`. Duplicate event URLs are upserted. Expired events and pages with the excluded brochure image are deleted/ignored.

Production scrape runs can be triggered from `/admin/scrape`. The page runs one search page at a time to stay within Cloudflare Worker subrequest limits.

## Daily production ingest

The full 15-page daily scrape now runs outside the Worker in GitHub Actions:

- Workflow: `.github/workflows/daily-event-ingest.yml`
- Schedule: daily at `10:15 UTC`
- Manual fallback: GitHub Actions -> `Daily Event Ingest` -> `Run workflow`

The workflow calls:

- `https://secret-mouse-tickets.drgrant.workers.dev/api/search/disneyevent`
- `https://secret-mouse-tickets.drgrant.workers.dev/api/admin/events`

Required GitHub Actions secret:

- `ADMIN_INGEST_TOKEN`

This external job avoids Cloudflare's per-invocation subrequest cap while still using the live production search and ingest endpoints. The public site domain is protected by Cloudflare Access, so the unattended workflow targets the Worker hostname directly.

## Abandoned checkout reminders

Pending checkout reminders now run outside the Worker in GitHub Actions:

- Workflow: `.github/workflows/abandoned-checkout-reminders.yml`
- Schedule: every 15 minutes
- Reminder timing: one reminder per pending order after it has been pending for at least 2 hours

The workflow calls:

- `https://secret-mouse-tickets.drgrant.workers.dev/api/admin/checkout-reminders`

The reminder flow applies coupon code `COMEBACK25` to qualifying pending orders before sending the email so the discounted price is already reflected when the customer returns to checkout.

## Trustpilot review requests

Completed orders can now trigger a follow-up review request email:

- Workflow: `.github/workflows/trustpilot-review-requests.yml`
- Schedule: every 30 minutes
- Reminder timing: one review request per paid order after it has been paid for at least 4 hours

The workflow calls:

- `https://secret-mouse-tickets.drgrant.workers.dev/api/admin/trustpilot-review-requests`

The review email sends customers to `TRUSTPILOT_REVIEW_URL`, which defaults to the public Trustpilot page for `secretmousetickets.com`.

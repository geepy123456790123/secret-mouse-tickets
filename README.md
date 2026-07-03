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
- `SERPER_API_KEY`
- `GOOGLE_SEARCH_URL`
- `SEARCH_NORMALIZER_PROVIDER`

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

Production scrape runs can be triggered from `/admin/scrape`. The page calls `/api/admin/scrape`, which performs Serper discovery, scrapes candidate DisneyEvent pages, parses event metadata, and writes directly to D1 from inside the deployed Worker. The scrape API requires `ADMIN_INGEST_TOKEN`.

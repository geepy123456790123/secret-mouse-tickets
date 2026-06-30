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
- `SQUARE_ACCESS_TOKEN`
- `SQUARE_LOCATION_ID`
- `RESEND_API_KEY`
- `FROM_EMAIL`
- `SERPER_API_KEY`
- `GOOGLE_SEARCH_URL`
- `SEARCH_NORMALIZER_PROVIDER`

When Square credentials are absent, checkout uses a local demo confirmation page. When Square credentials are present, `/api/checkout` creates a Square hosted checkout link.

## Event ingestion

The ingestion script expects either explicit event URLs or a search normalizer endpoint. The default normalizer URL is the Google results URL with omitted results included via `filter=0`.

```bash
SEARCH_PROVIDER_ENDPOINT="http://localhost:3003/api/search/disneyevent" npm run ingest:events
```

The `/api/search/disneyevent` endpoint defaults to fetching the configured Google Search URL, parsing result links, normalizing them into `items[].link`, and only returning `https://disneyevent.com/` URLs. It forces `filter=0` so omitted similar results are included. Direct Google HTML can be blocked or changed by Google, so the endpoint also supports `provider=serper` if the Serper account allows the needed `site:` query pattern. In production, this endpoint is protected by `ADMIN_INGEST_TOKEN`.

Parsed events are posted to `INGEST_ENDPOINT` when set, usually `/api/admin/events`. Duplicate event URLs are upserted. Expired events and pages with the excluded brochure image are deleted/ignored.

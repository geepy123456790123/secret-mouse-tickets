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

When Square credentials are absent, checkout uses a local demo confirmation page. When Square credentials are present, `/api/checkout` creates a Square hosted checkout link.

## Event ingestion

The ingestion script intentionally expects either explicit event URLs or a licensed/authorized search provider endpoint. It does not scrape Google HTML results.

```bash
SEARCH_PROVIDER_ENDPOINT="http://localhost:3003/api/search/disneyevent" npm run ingest:events
```

The `/api/search/disneyevent` endpoint calls Serper, normalizes `organic[].link` results into `items[].link`, and only returns `https://disneyevent.com/` URLs. In production, this endpoint is protected by `ADMIN_INGEST_TOKEN`.

Parsed events are posted to `INGEST_ENDPOINT` when set, usually `/api/admin/events`. Duplicate event URLs are upserted. Expired events and pages with the excluded brochure image are deleted/ignored.

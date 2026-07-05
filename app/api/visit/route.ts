import { ensureDatabase, getRawDb } from "@/db";

type VisitPayload = {
  visitId: string | null;
  sessionId: string | null;
  visitorId: string | null;
  landingPage: string | null;
  referrer: string | null;
  referrerDomain: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  gclid: string | null;
  fbclid: string | null;
  msclkid: string | null;
};

export async function POST(request: Request) {
  try {
    await ensureDatabase();

    const body = await request.json();
    const payload = parseVisitPayload(body);

    if (!payload.visitId) {
      return Response.json({ error: "Visit ID is required." }, { status: 400 });
    }

    await getRawDb()
      .prepare(
        `INSERT INTO visits (
          id, session_id, visitor_id, landing_page, referrer, referrer_domain,
          utm_source, utm_medium, utm_campaign, utm_content, utm_term, gclid, fbclid, msclkid
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          session_id = excluded.session_id,
          visitor_id = excluded.visitor_id,
          landing_page = excluded.landing_page,
          referrer = excluded.referrer,
          referrer_domain = excluded.referrer_domain,
          utm_source = excluded.utm_source,
          utm_medium = excluded.utm_medium,
          utm_campaign = excluded.utm_campaign,
          utm_content = excluded.utm_content,
          utm_term = excluded.utm_term,
          gclid = excluded.gclid,
          fbclid = excluded.fbclid,
          msclkid = excluded.msclkid`
      )
      .bind(
        payload.visitId,
        payload.sessionId,
        payload.visitorId,
        payload.landingPage,
        payload.referrer,
        payload.referrerDomain,
        payload.utmSource,
        payload.utmMedium,
        payload.utmCampaign,
        payload.utmContent,
        payload.utmTerm,
        payload.gclid,
        payload.fbclid,
        payload.msclkid
      )
      .run();

    return Response.json({ ok: true, visitId: payload.visitId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return Response.json({ error: message }, { status: 500 });
  }
}

function parseVisitPayload(payload: unknown): VisitPayload {
  const record = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};

  return {
    visitId: normalize(record.visitId),
    sessionId: normalize(record.sessionId),
    visitorId: normalize(record.visitorId),
    landingPage: normalize(record.landingPage),
    referrer: normalize(record.referrer),
    referrerDomain: normalize(record.referrerDomain),
    utmSource: normalize(record.utmSource),
    utmMedium: normalize(record.utmMedium),
    utmCampaign: normalize(record.utmCampaign),
    utmContent: normalize(record.utmContent),
    utmTerm: normalize(record.utmTerm),
    gclid: normalize(record.gclid),
    fbclid: normalize(record.fbclid),
    msclkid: normalize(record.msclkid),
  };
}

function normalize(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 500) : null;
}

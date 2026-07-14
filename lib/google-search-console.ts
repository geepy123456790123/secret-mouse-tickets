import { env } from "cloudflare:workers";

const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_SEARCH_CONSOLE_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const GOOGLE_SEARCH_CONSOLE_API_BASE = "https://www.googleapis.com/webmasters/v3";

type RuntimeEnv = typeof env & {
  GOOGLE_SEARCH_CONSOLE_CLIENT_EMAIL?: string;
  GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY?: string;
  GOOGLE_SEARCH_CONSOLE_SITE_URL?: string;
};

export type OrganicQueryRow = {
  term: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type SearchConsoleStatus =
  | {
      configured: false;
      connected: false;
      siteUrl: null;
      error: string;
    }
  | {
      configured: true;
      connected: boolean;
      siteUrl: string;
      error?: string;
    };

export async function getOrganicSearchQueries(startDate: string, endDate: string) {
  const runtime = env as RuntimeEnv;
  const clientEmail = runtime.GOOGLE_SEARCH_CONSOLE_CLIENT_EMAIL?.trim();
  const privateKey = normalizePrivateKey(runtime.GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY);
  const siteUrl = runtime.GOOGLE_SEARCH_CONSOLE_SITE_URL?.trim();

  if (!clientEmail || !privateKey || !siteUrl) {
    return {
      status: {
        configured: false,
        connected: false,
        siteUrl: null,
        error:
          "Google Search Console is not configured. Add GOOGLE_SEARCH_CONSOLE_CLIENT_EMAIL, GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY, and GOOGLE_SEARCH_CONSOLE_SITE_URL.",
      } satisfies SearchConsoleStatus,
      rows: [] as OrganicQueryRow[],
    };
  }

  try {
    const accessToken = await getAccessToken(clientEmail, privateKey);
    const rows = await querySearchAnalytics({
      accessToken,
      siteUrl,
      startDate,
      endDate,
    });

    return {
      status: {
        configured: true,
        connected: true,
        siteUrl,
      } satisfies SearchConsoleStatus,
      rows,
    };
  } catch (error) {
    return {
      status: {
        configured: true,
        connected: false,
        siteUrl,
        error: error instanceof Error ? error.message : "Unable to load Google Search Console data.",
      } satisfies SearchConsoleStatus,
      rows: [] as OrganicQueryRow[],
    };
  }
}

async function querySearchAnalytics({
  accessToken,
  siteUrl,
  startDate,
  endDate,
}: {
  accessToken: string;
  siteUrl: string;
  startDate: string;
  endDate: string;
}) {
  const response = await fetch(
    `${GOOGLE_SEARCH_CONSOLE_API_BASE}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startDate,
        endDate,
        dimensions: ["query"],
        type: "web",
        rowLimit: 25,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(await formatGoogleError(response, "Search Console query failed"));
  }

  const payload = (await response.json()) as {
    rows?: Array<{
      keys?: string[];
      clicks?: number;
      impressions?: number;
      ctr?: number;
      position?: number;
    }>;
  };

  return (payload.rows ?? []).map((row) => ({
    term: row.keys?.[0] ?? "(unknown)",
    clicks: Math.round(Number(row.clicks ?? 0)),
    impressions: Math.round(Number(row.impressions ?? 0)),
    ctr: Math.round(Number(row.ctr ?? 0) * 1000) / 10,
    position: Math.round(Number(row.position ?? 0) * 10) / 10,
  }));
}

async function getAccessToken(clientEmail: string, privateKey: string) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: clientEmail,
    scope: GOOGLE_SEARCH_CONSOLE_SCOPE,
    aud: GOOGLE_TOKEN_ENDPOINT,
    exp: nowSeconds + 3600,
    iat: nowSeconds,
  };

  const assertion = await signJwt(header, payload, privateKey);
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });

  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    throw new Error(await formatGoogleError(response, "Google token request failed"));
  }

  const payloadJson = (await response.json()) as { access_token?: string };

  if (!payloadJson.access_token) {
    throw new Error("Google token response did not include an access token.");
  }

  return payloadJson.access_token;
}

async function signJwt(
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
  privateKeyPem: string,
) {
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(privateKeyPem),
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput),
  );

  return `${signingInput}.${base64UrlEncodeBytes(new Uint8Array(signature))}`;
}

function normalizePrivateKey(value?: string) {
  if (!value) {
    return "";
  }

  return value.replace(/\\n/g, "\n").trim();
}

function pemToArrayBuffer(pem: string) {
  const base64 = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s+/g, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes.buffer;
}

function base64UrlEncode(value: string) {
  return base64UrlEncodeBytes(new TextEncoder().encode(value));
}

function base64UrlEncodeBytes(bytes: Uint8Array) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function formatGoogleError(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as {
      error?: {
        message?: string;
      };
    };

    return payload.error?.message ? `${fallback}: ${payload.error.message}` : `${fallback}: ${response.status}`;
  } catch {
    return `${fallback}: ${response.status}`;
  }
}

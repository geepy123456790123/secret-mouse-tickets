type MetaUserData = {
  email?: string | null;
  externalId?: string | null;
  clientIpAddress?: string | null;
  clientUserAgent?: string | null;
  fbclid?: string | null;
};

type MetaCustomData = {
  currency?: string | null;
  value?: number | null;
  orderId?: string | null;
};

type SendMetaConversionEventInput = {
  accessToken: string | null;
  pixelId: string | null;
  testEventCode?: string | null;
  eventName: "InitiateCheckout" | "Purchase";
  eventId: string;
  eventSourceUrl: string;
  userData: MetaUserData;
  customData?: MetaCustomData;
};

export async function sendMetaConversionEvent({
  accessToken,
  pixelId,
  testEventCode,
  eventName,
  eventId,
  eventSourceUrl,
  userData,
  customData,
}: SendMetaConversionEventInput) {
  if (!accessToken || !pixelId) {
    return;
  }

  const payload = {
    data: [
      {
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        action_source: "website",
        event_source_url: eventSourceUrl,
        user_data: await buildUserData(userData),
        custom_data: buildCustomData(customData),
      },
    ],
    ...(testEventCode ? { test_event_code: testEventCode } : {}),
  };

  const response = await fetch(`https://graph.facebook.com/v23.0/${pixelId}/events`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text().catch(() => "");

  if (!response.ok) {
    throw new Error(`Meta Conversions API error: ${responseText || response.statusText}`);
  }
}

async function buildUserData(userData: MetaUserData) {
  const email = normalizeValue(userData.email);
  const externalId = normalizeValue(userData.externalId);
  const clientIpAddress = normalizeValue(userData.clientIpAddress);
  const clientUserAgent = normalizeValue(userData.clientUserAgent);
  const fbclid = normalizeValue(userData.fbclid);

  return {
    ...(email ? { em: [await sha256(email)] } : {}),
    ...(externalId ? { external_id: [await sha256(externalId)] } : {}),
    ...(clientIpAddress ? { client_ip_address: clientIpAddress } : {}),
    ...(clientUserAgent ? { client_user_agent: clientUserAgent } : {}),
    ...(fbclid ? { fbclid } : {}),
  };
}

function buildCustomData(customData?: MetaCustomData) {
  if (!customData) {
    return undefined;
  }

  return {
    ...(customData.currency ? { currency: customData.currency } : {}),
    ...(typeof customData.value === "number" ? { value: customData.value } : {}),
    ...(customData.orderId ? { order_id: customData.orderId } : {}),
  };
}

function normalizeValue(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim().toLowerCase();
  return trimmed || null;
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function getClientIpAddress(request: Request) {
  const forwarded = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || null;
}

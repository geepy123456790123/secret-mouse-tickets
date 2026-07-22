type PayPalRuntime = {
  PAYPAL_CLIENT_ID?: string;
  PAYPAL_CLIENT_SECRET?: string;
  PAYPAL_ENVIRONMENT?: string;
};

type PayPalErrorPayload = {
  name?: string;
  message?: string;
  debug_id?: string;
  details?: Array<{ issue?: string; description?: string }>;
};

export function getPayPalConfig(runtime: PayPalRuntime) {
  const clientId = runtime.PAYPAL_CLIENT_ID?.trim();
  const clientSecret = runtime.PAYPAL_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    throw new Error("PayPal payments are not configured.");
  }

  const environment = runtime.PAYPAL_ENVIRONMENT?.trim();

  if (environment !== "production" && environment !== "sandbox") {
    throw new Error("PayPal environment must be set to sandbox or production.");
  }

  return {
    clientId,
    clientSecret,
    environment,
    baseUrl:
      environment === "production"
        ? "https://api-m.paypal.com"
        : "https://api-m.sandbox.paypal.com",
  };
}

export async function getPayPalAccessToken(runtime: PayPalRuntime) {
  const config = getPayPalConfig(runtime);
  const response = await fetch(`${config.baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${config.clientId}:${config.clientSecret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const payload = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    error_description?: string;
  };

  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description ?? "Unable to authenticate with PayPal.");
  }

  return { accessToken: payload.access_token, ...config };
}

export async function readPayPalResponse<T>(response: Response) {
  const payload = (await response.json().catch(() => ({}))) as T & PayPalErrorPayload;

  if (!response.ok) {
    const detail = payload.details?.[0];
    const message =
      detail?.description ?? detail?.issue ?? payload.message ?? payload.name ?? "PayPal request failed.";
    const error = new Error(message) as Error & {
      code?: string;
      debugId?: string;
      status?: number;
    };
    error.code = detail?.issue ?? payload.name;
    error.debugId = payload.debug_id;
    error.status = response.status;
    throw error;
  }

  return payload;
}

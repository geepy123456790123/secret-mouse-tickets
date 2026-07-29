export type TicketPrice = {
  productName: string;
  priceCents: number;
  currency: string;
  priceBasis: "from" | "per_day" | "per_ticket";
  ticketDays: number | null;
  park: string | null;
  parkHopper: boolean | null;
  ageBand: string | null;
  validDate: string | null;
  details: string | null;
};

export type TicketPriceCollection = {
  ticketPriceStatus: "not_configured" | "collected" | "empty" | "failed";
  ticketPricesJson: string | null;
  ticketPricesCollectedAt: string | null;
  ticketPriceError: string | null;
};

type CollectTicketPricesOptions = {
  endpoint?: string;
  token?: string;
  event: {
    eventPageUrl: string;
    eventName: string;
    eventStartDate: string;
    eventEndDate: string;
    validStartDate: string;
    validEndDate: string;
    ticketBookingUrl: string | null;
    ticketCampaignCode: string | null;
  };
};

export async function collectTicketPrices({
  endpoint,
  token,
  event,
}: CollectTicketPricesOptions): Promise<TicketPriceCollection> {
  if (!endpoint || !event.ticketBookingUrl) {
    return {
      ticketPriceStatus: "not_configured",
      ticketPricesJson: null,
      ticketPricesCollectedAt: null,
      ticketPriceError: null,
    };
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(event),
    });
    const payload = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) {
      throw new Error(getCollectorError(payload) ?? `Price collector returned HTTP ${response.status}.`);
    }

    const prices = normalizeTicketPrices(payload);
    const collectedAt = getCollectedAt(payload) ?? new Date().toISOString();

    if (!prices.length) {
      return {
        ticketPriceStatus: "empty",
        ticketPricesJson: JSON.stringify({
          sourceUrl: event.ticketBookingUrl,
          campaignCode: event.ticketCampaignCode,
          prices: [],
        }),
        ticketPricesCollectedAt: collectedAt,
        ticketPriceError: null,
      };
    }

    return {
      ticketPriceStatus: "collected",
      ticketPricesJson: JSON.stringify({
        sourceUrl: event.ticketBookingUrl,
        campaignCode: event.ticketCampaignCode,
        prices,
      }),
      ticketPricesCollectedAt: collectedAt,
      ticketPriceError: null,
    };
  } catch (error) {
    return {
      ticketPriceStatus: "failed",
      ticketPricesJson: null,
      ticketPricesCollectedAt: new Date().toISOString(),
      ticketPriceError: truncateError(error instanceof Error ? error.message : String(error)),
    };
  }
}

function normalizeTicketPrices(payload: unknown): TicketPrice[] {
  if (!payload || typeof payload !== "object") {
    throw new Error("Price collector returned an invalid JSON payload.");
  }

  const record = payload as Record<string, unknown>;
  const rawPrices = Array.isArray(record.prices)
    ? record.prices
    : Array.isArray(record.products)
      ? record.products
      : null;

  if (!rawPrices) {
    throw new Error("Price collector response must include a prices array.");
  }

  return rawPrices.map((value, index) => normalizeTicketPrice(value, index));
}

function normalizeTicketPrice(value: unknown, index: number): TicketPrice {
  if (!value || typeof value !== "object") {
    throw new Error(`Price row ${index + 1} is not an object.`);
  }

  const row = value as Record<string, unknown>;
  const productName = firstString(row.productName, row.name, row.ticketType);
  const priceCents = normalizePriceCents(row.priceCents, row.price);

  if (!productName) {
    throw new Error(`Price row ${index + 1} is missing productName.`);
  }

  if (priceCents === null) {
    throw new Error(`Price row ${index + 1} is missing a valid priceCents value.`);
  }

  return {
    productName,
    priceCents,
    currency: firstString(row.currency)?.toUpperCase() ?? "USD",
    priceBasis: normalizePriceBasis(row.priceBasis),
    ticketDays: optionalInteger(row.ticketDays),
    park: firstString(row.park),
    parkHopper: optionalBoolean(row.parkHopper),
    ageBand: firstString(row.ageBand),
    validDate: firstString(row.validDate),
    details: firstString(row.details, row.description, row.restrictions),
  };
}

function normalizePriceBasis(value: unknown): TicketPrice["priceBasis"] {
  return value === "per_day" || value === "per_ticket" ? value : "from";
}

function normalizePriceCents(priceCents: unknown, price: unknown) {
  const cents = Number(priceCents);
  if (Number.isInteger(cents) && cents >= 0) {
    return cents;
  }

  const dollars = Number(price);
  if (Number.isFinite(dollars) && dollars >= 0) {
    return Math.round(dollars * 100);
  }

  return null;
}

function optionalInteger(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function optionalBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (value === "true" || value === 1) {
    return true;
  }

  if (value === "false" || value === 0) {
    return false;
  }

  return null;
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function getCollectedAt(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const value = (payload as Record<string, unknown>).collectedAt;
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    return null;
  }

  return new Date(value).toISOString();
}

function getCollectorError(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  return firstString(
    (payload as Record<string, unknown>).error,
    (payload as Record<string, unknown>).message
  );
}

function truncateError(message: string) {
  return message.length > 500 ? `${message.slice(0, 497)}...` : message;
}

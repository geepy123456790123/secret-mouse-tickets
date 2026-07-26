export type TicketOfferExample = {
  productName: string;
  priceCents: number;
  currency: string;
  priceBasis: "from" | "per_day" | "per_ticket";
  details: string | null;
};

export type TicketOfferPreview = {
  offers: TicketOfferExample[];
  collectedAt: string;
};

export function parseTicketOfferPreview(
  ticketPricesJson: string | null | undefined,
  ticketPricesCollectedAt: string | null | undefined
): TicketOfferPreview | null {
  if (
    !ticketPricesJson ||
    !ticketPricesCollectedAt ||
    Number.isNaN(Date.parse(ticketPricesCollectedAt))
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(ticketPricesJson) as { prices?: unknown };
    if (!Array.isArray(payload.prices)) {
      return null;
    }

    const offers = payload.prices
      .map(normalizeOffer)
      .filter((offer): offer is TicketOfferExample => offer !== null)
      .filter(
        (offer, index, rows) =>
          rows.findIndex(
            (row) =>
              row.productName.toLowerCase() === offer.productName.toLowerCase() &&
              row.priceCents === offer.priceCents
          ) === index
      )
      .slice(0, 4);

    if (!offers.length) {
      return null;
    }

    return {
      offers,
      collectedAt: new Date(ticketPricesCollectedAt).toISOString(),
    };
  } catch {
    return null;
  }
}

function normalizeOffer(value: unknown): TicketOfferExample | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const row = value as Record<string, unknown>;
  const productName = cleanString(row.productName);
  const priceCents = Number(row.priceCents);

  if (!productName || !Number.isInteger(priceCents) || priceCents < 0) {
    return null;
  }

  return {
    productName,
    priceCents,
    currency: cleanString(row.currency)?.toUpperCase() ?? "USD",
    priceBasis:
      row.priceBasis === "per_day" || row.priceBasis === "per_ticket"
        ? row.priceBasis
        : "from",
    details: cleanString(row.details),
  };
}

function cleanString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 700) : null;
}

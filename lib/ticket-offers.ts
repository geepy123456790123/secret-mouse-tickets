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

    const offers = dedupeAndSortOffers(
      payload.prices
        .map(normalizeOffer)
        .filter((offer): offer is TicketOfferExample => offer !== null)
    ).slice(0, 3);

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

  const displayName = canonicalProductName(productName, cleanString(row.details));

  if (!displayName) {
    return null;
  }

  return {
    productName: displayName,
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

function canonicalProductName(productName: string, details: string | null) {
  const normalized = `${productName} ${details ?? ""}`
    .toLowerCase()
    .replace(/modal;?type=onesource/g, "")
    .replace(/modalitytype=onesource/g, "")
    .replace(/type=onesource/g, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (
    normalized.includes("after 4") &&
    normalized.includes("epcot") &&
    normalized.includes("animal kingdom")
  ) {
    return "After 4PM Park Ticket for EPCOT or Disney's Animal Kingdom";
  }

  if (
    normalized.includes("after 4") &&
    (normalized.includes("magic kingdom") || normalized.includes("hollywood studios"))
  ) {
    return "After 4PM Park Ticket for Magic Kingdom or Disney's Hollywood Studios";
  }

  if (
    normalized.includes("after 1") &&
    normalized.includes("epcot") &&
    normalized.includes("animal kingdom")
  ) {
    return "After 1PM Park Ticket for EPCOT or Disney's Animal Kingdom";
  }

  if (
    normalized.includes("after 1") &&
    (normalized.includes("magic kingdom") || normalized.includes("hollywood studios"))
  ) {
    return "After 1PM Park Ticket for Magic Kingdom or Disney's Hollywood Studios";
  }

  if (normalized.includes("after 4") && normalized.includes("ticket")) {
    return "After 4PM Park Ticket";
  }

  if (normalized.includes("after 1") && normalized.includes("ticket")) {
    return "After 1PM Park Ticket";
  }

  if (normalized.includes("2 day") && normalized.includes("2 park")) {
    return "2-Day, 2-Park Ticket";
  }

  if (
    normalized.includes("4 park magic") ||
    normalized.includes("4 park magic tickets") ||
    normalized.includes("magic ticket")
  ) {
    return "4-Park Magic Ticket";
  }

  if (
    normalized.includes("theme park only") ||
    normalized.includes("theme park ticket") ||
    normalized.includes("standard 1 to 10")
  ) {
    return "Theme Park Ticket";
  }

  if (!/(ticket|park|magic|after|admission|pass|day)/i.test(productName)) {
    return "";
  }

  return productName
    .replace(/modal;?type=onesource/gi, "")
    .replace(/modalitytype=onesource/gi, "")
    .replace(/type=onesource/gi, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function dedupeAndSortOffers(offers: TicketOfferExample[]) {
  const byProduct = new Map<string, TicketOfferExample>();

  for (const offer of offers.filter((offer) => offerRank(offer.productName) < 3)) {
    const key = offer.productName.toLowerCase();
    const existing = byProduct.get(key);
    if (!existing || compareOfferPreference(offer, existing) < 0) {
      byProduct.set(key, offer);
    }
  }

  return [...byProduct.values()].sort(compareOfferOrder);
}

function compareOfferPreference(a: TicketOfferExample, b: TicketOfferExample) {
  const basisRank = (offer: TicketOfferExample) => (offer.priceBasis === "per_day" ? 0 : 1);
  return basisRank(a) - basisRank(b) || a.priceCents - b.priceCents;
}

function compareOfferOrder(a: TicketOfferExample, b: TicketOfferExample) {
  return offerRank(a.productName) - offerRank(b.productName) || a.priceCents - b.priceCents;
}

function offerRank(productName: string) {
  const normalized = productName.toLowerCase();
  if (normalized.includes("theme park")) return 0;
  if (normalized.includes("4-park magic")) return 1;
  if (normalized.includes("2-day") && normalized.includes("2-park")) return 2;
  return 10;
}

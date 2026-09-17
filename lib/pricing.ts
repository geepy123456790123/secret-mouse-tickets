/** Shared by checkout calculations, public copy, and structured data. */
export const PRICE_CENTS = 2900;
export const PRICE_DOLLARS = PRICE_CENTS / 100;
export const PRICE_LABEL = `$${PRICE_DOLLARS}`;
export const QUARTER_OFF_CENTS = Math.round(PRICE_CENTS * 0.25);

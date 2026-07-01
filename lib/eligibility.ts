import { compareIsoDates, isIsoDate } from "./dates";

export type EligibilityInput = {
  visitStartDate: string;
  visitEndDate: string;
  themeParkDays: number;
  guests10Plus: number;
  guests3To9: number;
  email: string;
};

export type EventRecord = {
  id: number;
  event_page_url: string;
  info_banner_first: string;
  info_banner_second: string;
  event_start_date: string;
  event_end_date: string;
  valid_start_date: string;
  valid_end_date: string;
};

export type ValidationResult =
  | { ok: true; input: EligibilityInput }
  | { ok: false; error: string };

export function parseEligibilityInput(payload: unknown): ValidationResult {
  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "Request body is required." };
  }

  const body = payload as Record<string, unknown>;
  const input: EligibilityInput = {
    visitStartDate: String(body.visitStartDate ?? ""),
    visitEndDate: String(body.visitEndDate ?? ""),
    themeParkDays: Number(body.themeParkDays),
    guests10Plus: Number(body.guests10Plus),
    guests3To9: Number(body.guests3To9),
    email: String(body.email ?? "").trim().toLowerCase(),
  };

  if (!isIsoDate(input.visitStartDate) || !isIsoDate(input.visitEndDate)) {
    return { ok: false, error: "Enter valid visit dates." };
  }

  if (compareIsoDates(input.visitStartDate, input.visitEndDate) > 0) {
    return { ok: false, error: "Visit start date must be before the end date." };
  }

  if (!Number.isInteger(input.themeParkDays) || input.themeParkDays < 1) {
    return { ok: false, error: "Theme park days must be at least 1." };
  }

  if (!Number.isInteger(input.guests10Plus) || input.guests10Plus < 0) {
    return { ok: false, error: "Guests age 10+ must be 0 or higher." };
  }

  if (!Number.isInteger(input.guests3To9) || input.guests3To9 < 0) {
    return { ok: false, error: "Guests age 3-9 must be 0 or higher." };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    return { ok: false, error: "Enter a valid email address." };
  }

  return { ok: true, input };
}

export function disqualificationReason(input: EligibilityInput, matchedEvent: EventRecord | null) {
  if (!matchedEvent) {
    return "Sorry, we couldn't find any savings for your visit.";
  }

  const totalGuests = input.guests10Plus + input.guests3To9;

  if (input.themeParkDays < 3 && totalGuests < 2) {
    return "Sorry, we couldn't find any savings for your visit.";
  }

  return null;
}

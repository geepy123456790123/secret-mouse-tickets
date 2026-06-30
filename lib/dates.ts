const DISPLAY_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function addDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function formatDate(isoDate: string) {
  if (!isIsoDate(isoDate)) {
    return isoDate;
  }

  return DISPLAY_FORMATTER.format(new Date(`${isoDate}T00:00:00.000Z`));
}

export function compareIsoDates(left: string, right: string) {
  return left.localeCompare(right);
}

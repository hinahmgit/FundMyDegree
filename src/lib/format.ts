// Locale- and time-zone-aware formatting shared by server and client components.

export function formatMoney(amount: number, currency: string, locale = "en"): string {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function safeTimeZone(timeZone: string | null | undefined): string {
  if (!timeZone) return "UTC";
  try {
    new Intl.DateTimeFormat("en", { timeZone });
    return timeZone;
  } catch {
    return "UTC";
  }
}

/** Dates without a time (YYYY-MM-DD) are calendar dates and are shown as-is, not shifted. */
function isDateOnly(value: string | Date): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function formatDate(value: string | Date, timeZone: string, locale = "en"): string {
  if (isDateOnly(value)) {
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
  }
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: safeTimeZone(timeZone) }).format(new Date(value));
}

export function formatDateTime(value: string | Date, timeZone: string, locale = "en"): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: safeTimeZone(timeZone),
    timeZoneName: "short",
  }).format(new Date(value));
}

export function countryName(code: string | null | undefined, locale = "en"): string {
  if (!code) return "";
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

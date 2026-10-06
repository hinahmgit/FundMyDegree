import "server-only";
import { getLocale } from "@/i18n/server";
import { getViewerPrefs } from "@/lib/auth";
import { getRates, convert } from "@/lib/fx";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";

/** Formatting helpers bound to the viewer's locale, time zone and display currency. */
export async function getFormatter() {
  const [locale, prefs, rates] = await Promise.all([getLocale(), getViewerPrefs(), getRates()]);
  return {
    locale,
    timeZone: prefs.timeZone,
    currency: prefs.currency,
    rates,
    money: (amount: number, currency: string) => formatMoney(Number(amount), currency, locale),
    date: (value: string | Date) => formatDate(value, prefs.timeZone, locale),
    dateTime: (value: string | Date) => formatDateTime(value, prefs.timeZone, locale),
    /** Estimate in the viewer's display currency, or null if same currency / no rate. */
    estimate: (amount: number, currency: string, to: string = prefs.currency) => {
      if (currency === to) return null;
      const v = convert(Number(amount), currency, to, rates);
      return v === null ? null : formatMoney(v, to, locale);
    },
    toUsd: (amount: number, currency: string) => convert(Number(amount), currency, "USD", rates),
  };
}
export type Formatter = Awaited<ReturnType<typeof getFormatter>>;

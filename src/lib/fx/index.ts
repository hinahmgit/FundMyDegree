import "server-only";
import { cache } from "react";
import { db } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { convert, crossRate, type RateTable } from "./convert";

/**
 * A source of exchange rates. The app always prices donations from the rates
 * stored in the `exchange_rates` table; a provider is what refreshes that
 * table. Swap providers with EXCHANGE_RATE_PROVIDER.
 */
export interface ExchangeRateProvider {
  readonly name: string;
  /** Latest rates as units per 1 USD, or null if this provider is manual-only. */
  fetchLatest(): Promise<RateTable | null>;
}

/** Rates are entered by admins in the Exchange rates screen. */
export class ManualRateProvider implements ExchangeRateProvider {
  readonly name = "manual";
  async fetchLatest() {
    return null;
  }
}

/** Free, keyless public feed (https://open.er-api.com). */
export class OpenErApiRateProvider implements ExchangeRateProvider {
  readonly name = "open-er-api";
  async fetchLatest(): Promise<RateTable> {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", { cache: "no-store" });
    if (!res.ok) throw new Error(`Rate feed responded ${res.status}`);
    const body = (await res.json()) as { result: string; rates: RateTable };
    if (body.result !== "success") throw new Error("Rate feed returned an error");
    return body.rates;
  }
}

export function getExchangeRateProvider(): ExchangeRateProvider {
  switch (env.exchangeRateProvider()) {
    case "open-er-api":
      return new OpenErApiRateProvider();
    default:
      return new ManualRateProvider();
  }
}

/** Stored rates, cached for the request. */
export const getRates = cache(async (): Promise<RateTable> => {
  const { data } = await db().from("exchange_rates").select("currency_code, units_per_usd");
  const table: RateTable = {};
  for (const row of data ?? []) table[row.currency_code] = Number(row.units_per_usd);
  return table;
});

export { convert, crossRate };
export type { RateTable };

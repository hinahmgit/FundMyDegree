import "server-only";
import { cache } from "react";
import { db } from "@/lib/supabase/admin";
import type { Country, Currency, University } from "@/types/db";

export const getCountries = cache(async (): Promise<Country[]> => {
  const { data } = await db().from("countries").select("*").order("name");
  return data ?? [];
});

export const getCurrencies = cache(async (): Promise<Currency[]> => {
  const { data } = await db().from("currencies").select("*").eq("active", true).order("code");
  return data ?? [];
});

/** Currencies that have an exchange rate, so they can be used for donations. */
export const getPricedCurrencies = cache(async (): Promise<Currency[]> => {
  const [{ data: rates }, currencies] = await Promise.all([db().from("exchange_rates").select("currency_code"), getCurrencies()]);
  const priced = new Set((rates ?? []).map((r) => r.currency_code as string));
  return currencies.filter((c) => priced.has(c.code));
});

export const getApprovedUniversities = cache(async (): Promise<University[]> => {
  const { data } = await db().from("universities").select("*").eq("status", "approved").order("name");
  return data ?? [];
});

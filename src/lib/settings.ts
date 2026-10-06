import "server-only";
import { cache } from "react";
import { db } from "@/lib/supabase/admin";

export interface AppSettings {
  pledgeHoldDays: number;
  pledgeReminderDays: number;
  overfundTolerancePct: number;
  reportingCurrency: string;
  consentVersion: string;
}

export const SETTING_KEYS = {
  pledgeHoldDays: "pledge_hold_days",
  pledgeReminderDays: "pledge_reminder_days",
  overfundTolerancePct: "overfund_tolerance_pct",
  reportingCurrency: "reporting_currency",
  consentVersion: "consent_version",
} as const satisfies Record<keyof AppSettings, string>;

const DEFAULTS: AppSettings = {
  pledgeHoldDays: 14,
  pledgeReminderDays: 3,
  overfundTolerancePct: 2,
  reportingCurrency: "USD",
  consentVersion: "2026-01",
};

export const getSettings = cache(async (): Promise<AppSettings> => {
  const { data } = await db().from("app_settings").select("key, value");
  const map = new Map((data ?? []).map((r) => [r.key as string, r.value as unknown]));
  const out = { ...DEFAULTS };
  for (const [field, key] of Object.entries(SETTING_KEYS) as [keyof AppSettings, string][]) {
    if (!map.has(key)) continue;
    const v = map.get(key);
    (out as Record<string, unknown>)[field] = typeof DEFAULTS[field] === "number" ? Number(v) : String(v);
  }
  return out;
});

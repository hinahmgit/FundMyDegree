"use client";
import { createContext, useContext, useMemo } from "react";
import type { Messages } from "./messages/en";
import { createTranslator, type Translator } from "./translate";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";

interface I18nValue {
  locale: string;
  timeZone: string;
  t: Translator;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({
  locale,
  timeZone,
  messages,
  children,
}: {
  locale: string;
  timeZone: string;
  messages: Messages;
  children: React.ReactNode;
}) {
  const value = useMemo(() => ({ locale, timeZone, t: createTranslator(messages) }), [locale, timeZone, messages]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useT must be used inside I18nProvider");
  return ctx;
}

export function useT() {
  return useI18n().t;
}

export function useFormat() {
  const { locale, timeZone } = useI18n();
  return {
    locale,
    timeZone,
    money: (amount: number, currency: string) => formatMoney(amount, currency, locale),
    date: (value: string | Date) => formatDate(value, timeZone, locale),
    dateTime: (value: string | Date) => formatDateTime(value, timeZone, locale),
  };
}

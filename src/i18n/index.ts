import type { Locale } from "./config";
import en, { type Messages } from "./messages/en";

// Add a language: create messages/<code>.ts typed as Messages, register it here
// and in config.ts. Missing keys fall back to English.
const dictionaries: Record<Locale, Messages> = { en };

export function getMessages(locale: Locale): Messages {
  return dictionaries[locale] ?? en;
}
export { en as fallbackMessages };

import "server-only";
import { cookies, headers } from "next/headers";
import { defaultLocale, isLocale, locales, type Locale } from "./config";
import { fallbackMessages, getMessages } from "./index";
import { createTranslator } from "./translate";

export async function getLocale(): Promise<Locale> {
  const cookieLocale = (await cookies()).get("locale")?.value;
  if (isLocale(cookieLocale)) return cookieLocale;
  const accept = (await headers()).get("accept-language") ?? "";
  for (const part of accept.split(",")) {
    const code = part.split(";")[0].trim().slice(0, 2).toLowerCase();
    if ((locales as readonly string[]).includes(code)) return code as Locale;
  }
  return defaultLocale;
}

export async function getT() {
  const locale = await getLocale();
  return createTranslator(getMessages(locale), fallbackMessages);
}

export function getTFor(locale: string | null | undefined) {
  return createTranslator(getMessages(isLocale(locale) ? locale : defaultLocale), fallbackMessages);
}

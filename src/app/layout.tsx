import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { TimezoneSync } from "@/components/timezone-sync";
import { I18nProvider } from "@/i18n/client";
import { getMessages } from "@/i18n";
import { getLocale, getT } from "@/i18n/server";
import { getViewerPrefs } from "@/lib/auth";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: { default: t("meta.title"), template: `%s · ${t("common.appName")}` }, description: t("meta.description") };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const { timeZone } = await getViewerPrefs();
  return (
    <html lang={locale}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="flex min-h-screen flex-col">
        <I18nProvider locale={locale} timeZone={timeZone} messages={getMessages(locale)}>
          <TimezoneSync />
          <Header />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
          <Footer />
        </I18nProvider>
      </body>
    </html>
  );
}

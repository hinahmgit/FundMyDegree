import Link from "next/link";
import { getT } from "@/i18n/server";
import { getCountries, getPricedCurrencies } from "@/lib/reference";
import { SignupForm } from "./signup-form";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const [t, countries, currencies, { role }] = await Promise.all([getT(), getCountries(), getPricedCurrencies(), searchParams]);
  return (
    <div className="card">
      <h1 className="font-display text-2xl font-semibold">{t("auth.signupTitle")}</h1>
      <p className="mb-6 text-stone-600">{t("auth.signupSubtitle")}</p>
      <SignupForm
        initialRole={role === "student" ? "student" : "donor"}
        countries={countries.map((c) => ({ code: c.code, name: c.name, currency: c.default_currency }))}
        currencies={currencies.map((c) => ({ code: c.code, name: c.name }))}
      />
      <p className="mt-4 text-center text-sm">
        {t("auth.haveAccount")} <Link href="/login" className="link">{t("nav.login")}</Link>
      </p>
    </div>
  );
}

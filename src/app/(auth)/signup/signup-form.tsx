"use client";
import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { signUp } from "@/actions/auth";
import { useT } from "@/i18n/client";
import { ActionMessage, SubmitButton } from "@/components/forms";
import { cn } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";

export function SignupForm({
  initialRole,
  countries,
  currencies,
}: {
  initialRole: "student" | "donor";
  countries: { code: string; name: string; currency: string | null }[];
  currencies: { code: string; name: string }[];
}) {
  const t = useT();
  const [state, action] = useActionState(signUp, {} as ActionState);
  const [role, setRole] = useState(initialRole);
  const [country, setCountry] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [tz, setTz] = useState("UTC");
  useEffect(() => setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"), []);

  if (state.ok) {
    return (
      <div className="rounded-lg bg-trust-50 p-4 text-trust-700">
        <h2 className="font-semibold">{t("auth.checkEmailTitle")}</h2>
        <p className="text-sm">{t("auth.checkEmailBody", state.vars)}</p>
      </div>
    );
  }

  const onCountry = (code: string) => {
    setCountry(code);
    const c = countries.find((x) => x.code === code)?.currency;
    if (c && currencies.some((x) => x.code === c)) setCurrency(c);
  };

  return (
    <form action={action} className="space-y-4">
      <ActionMessage state={state} />
      <fieldset>
        <legend className="label">{t("auth.iAmA")}</legend>
        <div className="grid grid-cols-2 gap-3">
          {(["student", "donor"] as const).map((r) => (
            <label key={r} className={cn("cursor-pointer rounded-xl border-2 p-3 text-sm", role === r ? "border-brand-500 bg-brand-50" : "border-stone-200")}>
              <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} className="sr-only" />
              <span className="block font-semibold">{r === "student" ? t("auth.roleStudent") : t("auth.roleDonor")}</span>
              <span className="text-stone-600">{r === "student" ? t("auth.roleStudentHint") : t("auth.roleDonorHint")}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label className="label" htmlFor="full_name">{t("auth.fullName")}</label>
        <input className="input" id="full_name" name="full_name" required minLength={2} autoComplete="name" />
      </div>
      <div>
        <label className="label" htmlFor="email">{t("auth.email")}</label>
        <input className="input" id="email" name="email" type="email" required autoComplete="email" />
      </div>
      <div>
        <label className="label" htmlFor="password">{t("auth.password")}</label>
        <input className="input" id="password" name="password" type="password" required minLength={10} autoComplete="new-password" />
        <p className="hint">{t("auth.passwordHint")}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="country_code">{t("auth.yourCountry")}</label>
          <select className="input" id="country_code" name="country_code" required value={country} onChange={(e) => onCountry(e.target.value)}>
            <option value="" disabled>—</option>
            {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="preferred_currency">{t("auth.preferredCurrency")}</label>
          <select className="input" id="preferred_currency" name="preferred_currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {currencies.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
          </select>
        </div>
      </div>
      <input type="hidden" name="timezone" value={tz} />
      <fieldset className="space-y-2 rounded-xl bg-stone-50 p-4 text-sm">
        <legend className="mb-1 font-semibold">{t("auth.consentTitle")}</legend>
        <label className="flex gap-2"><input type="checkbox" name="terms" required className="mt-1" /><span>{t("auth.consentTerms")} <Link href="/terms" className="link" target="_blank">{t("footer.terms")}</Link></span></label>
        <label className="flex gap-2"><input type="checkbox" name="privacy" required className="mt-1" /><span>{t("auth.consentPrivacy")} <Link href="/privacy" className="link" target="_blank">{t("footer.privacy")}</Link></span></label>
        <label className="flex gap-2"><input type="checkbox" name="data_processing" required className="mt-1" /><span>{t("auth.consentDataProcessing")}</span></label>
        <label className="flex gap-2"><input type="checkbox" name="marketing" className="mt-1" /><span>{t("auth.consentMarketing")}</span></label>
      </fieldset>
      <SubmitButton className="btn-primary w-full">{t("nav.signup")}</SubmitButton>
    </form>
  );
}

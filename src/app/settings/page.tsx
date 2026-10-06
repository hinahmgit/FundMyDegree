import { requireUser } from "@/lib/auth";
import { getT } from "@/i18n/server";
import { getFormatter } from "@/lib/server-format";
import { db } from "@/lib/supabase/admin";
import { getCountries, getPricedCurrencies } from "@/lib/reference";
import { avatarUrl } from "@/lib/files";
import { locales } from "@/i18n/config";
import { Avatar, Card, PageHeader } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/forms";
import { deleteAccount, updatePreferences } from "@/actions/account";
import { TwoFactor } from "./two-factor";

const TIMEZONES = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : ["UTC"];
const LANGUAGE_NAMES: Record<string, string> = { en: "English" };

export default async function SettingsPage() {
  const user = await requireUser();
  const [t, f, countries, currencies] = await Promise.all([getT(), getFormatter(), getCountries(), getPricedCurrencies()]);
  const { data: consents } = await db().from("consents").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
  const marketing = consents?.find((c) => c.kind === "marketing")?.granted ?? false;
  const p = user.profile;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title={t("settings.title")} />
      <Card title={t("settings.profile")}>
        <ActionForm action={updatePreferences}>
          <div className="flex items-center gap-4">
            <Avatar src={avatarUrl(p.avatar_path)} name={p.full_name} size={56} />
            <div>
              <label className="label" htmlFor="avatar">{t("settings.avatar")}</label>
              <input id="avatar" name="avatar" type="file" accept="image/jpeg,image/png,image/webp" className="text-sm" />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="full_name">{t("auth.fullName")}</label>
            <input id="full_name" name="full_name" className="input" defaultValue={p.full_name} required />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="country_code">{t("common.country")}</label>
              <select id="country_code" name="country_code" className="input" defaultValue={p.country_code ?? ""}>
                {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="preferred_currency">{t("settings.displayCurrency")}</label>
              <select id="preferred_currency" name="preferred_currency" className="input" defaultValue={p.preferred_currency}>
                {currencies.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="timezone">{t("settings.timezone")}</label>
              <select id="timezone" name="timezone" className="input" defaultValue={f.timeZone}>
                {TIMEZONES.map((tz) => <option key={tz}>{tz}</option>)}
              </select>
              <p className="hint">{t("settings.timezoneHint")}</p>
            </div>
            <div>
              <label className="label" htmlFor="locale">{t("settings.language")}</label>
              <select id="locale" name="locale" className="input" defaultValue={p.locale}>
                {locales.map((l) => <option key={l} value={l}>{LANGUAGE_NAMES[l] ?? l}</option>)}
              </select>
            </div>
          </div>
          <label className="flex gap-2 text-sm"><input type="checkbox" name="marketing" defaultChecked={marketing} /> {t("auth.consentMarketing")}</label>
          <SubmitButton>{t("common.save")}</SubmitButton>
        </ActionForm>
      </Card>

      <Card title={t("settings.security")}>
        <h3 className="mb-2 font-medium">{t("settings.twoFactor")}</h3>
        <TwoFactor />
      </Card>

      <Card title={t("settings.privacy")}>
        <p className="mb-4 text-sm text-stone-600">{t("settings.privacyBody")}</p>
        <a href="/api/account/export" className="btn-secondary">{t("settings.exportData")}</a>
        <h3 className="mt-6 mb-2 text-sm font-semibold">{t("settings.consents")}</h3>
        <ul className="space-y-1 text-sm text-stone-600">
          {(consents ?? []).map((c) => (
            <li key={c.id}>{c.kind}: {c.granted ? "✓" : "✗"} — {t("settings.consentGiven", { date: f.dateTime(c.created_at), version: c.version })}</li>
          ))}
        </ul>
        {p.role !== "admin" && (
          <details className="mt-6 rounded-xl border border-red-200 p-4">
            <summary className="cursor-pointer font-medium text-red-700">{t("settings.deleteAccount")}</summary>
            <p className="my-3 text-sm text-stone-600">{t("settings.deleteWarning")}</p>
            <ActionForm action={deleteAccount}>
              <div>
                <label className="label" htmlFor="confirm">{t("settings.deleteConfirmLabel")}</label>
                <input id="confirm" name="confirm" required pattern="DELETE" className="input" autoComplete="off" />
              </div>
              <SubmitButton className="btn-danger">{t("settings.deleteAccount")}</SubmitButton>
            </ActionForm>
          </details>
        )}
      </Card>
    </div>
  );
}

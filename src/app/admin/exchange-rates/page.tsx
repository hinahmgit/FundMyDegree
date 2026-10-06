import { getT } from "@/i18n/server";
import { getFormatter } from "@/lib/server-format";
import { db } from "@/lib/supabase/admin";
import { getExchangeRateProvider } from "@/lib/fx";
import { getCurrencies } from "@/lib/reference";
import { Card, PageHeader, TableWrap } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/forms";
import { fetchLatestRates, upsertRate } from "@/actions/admin";

export default async function ExchangeRatesPage() {
  const [t, f, currencies] = await Promise.all([getT(), getFormatter(), getCurrencies()]);
  const { data: rates } = await db().from("exchange_rates").select("*").order("currency_code");
  const provider = getExchangeRateProvider();
  return (
    <div className="space-y-6">
      <PageHeader title={t("admin.rates.title")} subtitle={t("admin.rates.subtitle")} />
      <div className="grid gap-6 md:grid-cols-2">
        <Card title={t("admin.rates.provider", { name: provider.name })}>
          <ActionForm action={fetchLatestRates}>
            <SubmitButton className="btn-secondary">{t("admin.rates.fetch")}</SubmitButton>
          </ActionForm>
        </Card>
        <Card title={t("admin.rates.add")}>
          <ActionForm action={upsertRate} className="flex flex-wrap items-end gap-2 space-y-0">
            <select name="currency_code" className="input w-28">
              {currencies.map((c) => <option key={c.code}>{c.code}</option>)}
            </select>
            <input name="units_per_usd" type="number" step="any" min="0" required className="input w-40" placeholder={t("admin.rates.perUsd")} />
            <SubmitButton>{t("common.save")}</SubmitButton>
          </ActionForm>
        </Card>
      </div>
      <Card>
        <TableWrap>
          <table className="data-table">
            <thead><tr><th>{t("common.currency")}</th><th>{t("admin.rates.perUsd")}</th><th>{t("admin.rates.source")}</th><th>{t("admin.rates.updated")}</th></tr></thead>
            <tbody>
              {(rates ?? []).map((r) => (
                <tr key={r.currency_code}>
                  <td className="font-medium">{r.currency_code}</td>
                  <td className="font-mono">{Number(r.units_per_usd)}</td>
                  <td>{r.source}</td>
                  <td className="whitespace-nowrap">{f.dateTime(r.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Card>
    </div>
  );
}

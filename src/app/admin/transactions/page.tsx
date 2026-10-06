import { getT } from "@/i18n/server";
import { getFormatter } from "@/lib/server-format";
import { searchTransactions } from "@/lib/admin-queries";
import { getCountries, getCurrencies } from "@/lib/reference";
import { db } from "@/lib/supabase/admin";
import { documentHref } from "@/lib/files";
import { countryName } from "@/lib/format";
import { Card, PageHeader, Pagination, TableWrap } from "@/components/ui";
import { DonationStatusBadge } from "@/components/status";
import { ActionForm, SubmitButton } from "@/components/forms";
import { reassignDonation, refundDonation } from "@/actions/admin";

const PAGE = 50;
const STATUSES = ["pending", "confirmed", "rejected", "expired", "disbursed", "refunded"] as const;

export default async function AdminTransactions({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const [t, f, countries, currencies, { rows, count }] = await Promise.all([getT(), getFormatter(), getCountries(), getCurrencies(), searchTransactions(sp, PAGE, (page - 1) * PAGE)]);
  const { data: openGrants } = await db().from("grants").select("id, student_id, term_label, currency").eq("status", "open").limit(500);
  const { data: names } = openGrants?.length ? await db().from("profiles").select("id, full_name").in("id", openGrants.map((g) => g.student_id)) : { data: [] };
  const nameMap = new Map((names ?? []).map((n) => [n.id, n.full_name]));
  const qs = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "page") as [string, string][]);

  return (
    <div>
      <PageHeader title={t("admin.transactions.title")} actions={<a href={`/admin/transactions/export?${qs}`} className="btn-secondary">{t("common.exportCsv")}</a>} />
      <form className="card mb-4 grid gap-3 sm:grid-cols-4 lg:grid-cols-8">
        <input name="q" defaultValue={sp.q} className="input sm:col-span-2" placeholder={t("admin.transactions.search")} />
        <select name="method" defaultValue={sp.method ?? ""} className="input">
          <option value="">{t("admin.transactions.method")}</option>
          <option value="platform">{t("methods.platform")}</option>
          <option value="direct">{t("methods.direct")}</option>
        </select>
        <select name="status" defaultValue={sp.status ?? ""} className="input">
          <option value="">{t("common.status")}</option>
          {STATUSES.map((s) => <option key={s} value={s}>{t(`status.donation.${s}`)}</option>)}
        </select>
        <select name="currency" defaultValue={sp.currency ?? ""} className="input">
          <option value="">{t("common.currency")}</option>
          {currencies.map((c) => <option key={c.code}>{c.code}</option>)}
        </select>
        <select name="country" defaultValue={sp.country ?? ""} className="input">
          <option value="">{t("common.country")}</option>
          {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>
        <input name="from" type="date" defaultValue={sp.from} className="input" aria-label="from" />
        <div className="flex gap-2"><input name="to" type="date" defaultValue={sp.to} className="input" aria-label="to" /><button className="btn-primary">{t("common.filter")}</button></div>
      </form>
      <Card>
        <p className="mb-2 text-sm text-stone-500">{count}</p>
        <TableWrap>
          <table className="data-table">
            <thead>
              <tr><th>{t("common.date")}</th><th>{t("receipt.donor")}</th><th>{t("receipt.student")}</th><th>{t("admin.transactions.method")}</th><th>{t("donorDash.original")}</th><th>{t("receipt.amountGrant")}</th><th>{t("admin.transactions.usd")}</th><th>{t("common.status")}</th><th>{t("common.actions")}</th></tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id}>
                  <td className="whitespace-nowrap">{f.dateTime(d.created_at)}</td>
                  <td>{d.donor_name}{d.anonymous && " 🕶"}<div className="text-xs text-stone-500">{countryName(d.donor_country, f.locale)}</div></td>
                  <td>{d.student_name}</td>
                  <td>{t(`methods.${d.method}`)}</td>
                  <td className="whitespace-nowrap">{f.money(Number(d.original_amount), d.original_currency)}<div className="text-xs text-stone-500">× {Number(d.exchange_rate).toPrecision(5)}</div></td>
                  <td className="whitespace-nowrap">{f.money(Number(d.confirmed_amount ?? d.grant_amount), d.grant_currency)}</td>
                  <td className="whitespace-nowrap">{f.money(d.amount_usd, "USD")}</td>
                  <td>
                    <DonationStatusBadge donation={d} t={t} />
                    {d.proof_document_id && <div><a className="link text-xs" href={documentHref(d.proof_document_id)!} target="_blank" rel="noreferrer">{t("admin.proofs.proof")}</a></div>}
                  </td>
                  <td className="min-w-64">
                    {d.method === "platform" && d.status === "confirmed" && (
                      <details>
                        <summary className="cursor-pointer text-sm text-brand-700">{t("admin.transactions.refund")} / {t("admin.transactions.reassign")}</summary>
                        <div className="mt-2 space-y-3">
                          <ActionForm action={refundDonation} className="space-y-1">
                            <input type="hidden" name="donation_id" value={d.id} />
                            <input name="reason" required className="input py-1" placeholder={t("admin.transactions.refundReason")} />
                            <SubmitButton className="btn-danger py-1">{t("admin.transactions.refund")}</SubmitButton>
                          </ActionForm>
                          <ActionForm action={reassignDonation} className="space-y-1">
                            <input type="hidden" name="donation_id" value={d.id} />
                            <select name="target_grant_id" required className="input py-1">
                              <option value="">{t("admin.transactions.reassignTo")}</option>
                              {(openGrants ?? []).filter((g) => g.id !== d.grant_id).map((g) => (
                                <option key={g.id} value={g.id}>{nameMap.get(g.student_id)} · {g.term_label} ({g.currency})</option>
                              ))}
                            </select>
                            <input name="reason" required className="input py-1" placeholder={t("common.reason")} />
                            <p className="hint">{t("admin.transactions.reassignHint")}</p>
                            <SubmitButton className="btn-secondary py-1">{t("admin.transactions.reassign")}</SubmitButton>
                          </ActionForm>
                        </div>
                      </details>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
        <Pagination page={page} hasNext={count > page * PAGE} hrefFor={(p) => `/admin/transactions?${qs}&page=${p}`} labels={{ prev: t("common.previous"), next: t("common.next"), page: t("common.page", { page }) }} />
      </Card>
    </div>
  );
}

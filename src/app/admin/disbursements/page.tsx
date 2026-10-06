import { getT } from "@/i18n/server";
import { getFormatter } from "@/lib/server-format";
import { db } from "@/lib/supabase/admin";
import { getProgress, summarize } from "@/lib/grants";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/forms";
import { recordDisbursement } from "@/actions/admin";
import type { Grant, University } from "@/types/db";

export default async function DisbursementQueue() {
  const [t, f] = await Promise.all([getT(), getFormatter()]);
  const { data } = await db().from("grants").select("*").eq("status", "funded").order("funded_at");
  const grants = (data ?? []) as Grant[];
  const ids = grants.map((g) => g.id);
  const [progress, { data: held }, { data: unis }, { data: people }] = await Promise.all([
    getProgress(ids),
    ids.length ? db().from("donations").select("grant_id, method, status, confirmed_amount, grant_amount").in("grant_id", ids).in("status", ["confirmed"]) : Promise.resolve({ data: [] }),
    grants.length ? db().from("universities").select("*").in("id", [...new Set(grants.map((g) => g.university_id))]) : Promise.resolve({ data: [] }),
    grants.length ? db().from("profiles").select("id, full_name").in("id", grants.map((g) => g.student_id)) : Promise.resolve({ data: [] }),
  ]);
  const sum = (gid: string, method: string) =>
    (held ?? []).filter((d) => d.grant_id === gid && d.method === method).reduce((s, d) => s + Number(d.confirmed_amount ?? d.grant_amount), 0);
  const uMap = new Map(((unis ?? []) as University[]).map((u) => [u.id, u]));
  const pMap = new Map((people ?? []).map((p) => [p.id, p.full_name]));
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <PageHeader title={t("admin.disbursements.title")} subtitle={t("admin.disbursements.subtitle")} />
      {grants.length ? (
        <div className="space-y-4">
          {grants.map((g) => {
            const u = uMap.get(g.university_id);
            const p = summarize(progress.get(g.id), g);
            return (
              <Card key={g.id} title={`${pMap.get(g.student_id)} · ${g.term_label}`}>
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-3 text-sm">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-brand-50 p-3"><div className="text-stone-500">{t("admin.disbursements.held")}</div><div className="text-lg font-semibold">{f.money(sum(g.id, "platform"), g.currency)}</div></div>
                      <div className="rounded-lg bg-trust-50 p-3"><div className="text-stone-500">{t("admin.disbursements.direct")}</div><div className="text-lg font-semibold">{f.money(sum(g.id, "direct"), g.currency)}</div></div>
                    </div>
                    <p>{t("progress.ofTarget", { confirmed: f.money(p.confirmed, g.currency), target: f.money(p.target, g.currency) })}</p>
                    <dl className="space-y-1 rounded-lg border border-stone-200 p-3">
                      <div className="font-semibold">{u?.name}</div>
                      {u?.bank_name && <div>{t("pledge.bankName")}: {u.bank_name}</div>}
                      {u?.bank_account_name && <div>{t("pledge.accountName")}: {u.bank_account_name}</div>}
                      {u?.iban && <div className="font-mono">{t("pledge.iban")}: {u.iban}</div>}
                      {u?.bank_account_number && <div className="font-mono">{t("pledge.accountNumber")}: {u.bank_account_number}</div>}
                      {u?.swift_bic && <div className="font-mono">{t("pledge.swift")}: {u.swift_bic}</div>}
                      {g.invoice_number && <div>{t("documents.invoiceNumber")}: {g.invoice_number}</div>}
                    </dl>
                  </div>
                  <ActionForm action={recordDisbursement}>
                    <input type="hidden" name="grant_id" value={g.id} />
                    <div>
                      <label className="label" htmlFor={`ref-${g.id}`}>{t("admin.disbursements.transferRef")}</label>
                      <input id={`ref-${g.id}`} name="transfer_reference" className="input" required={sum(g.id, "platform") > 0} />
                    </div>
                    <div>
                      <label className="label" htmlFor={`date-${g.id}`}>{t("admin.disbursements.paidOn")}</label>
                      <input id={`date-${g.id}`} name="paid_on" type="date" className="input" defaultValue={today} required />
                    </div>
                    <div>
                      <label className="label" htmlFor={`rcpt-${g.id}`}>{t("admin.disbursements.receipt")}</label>
                      <input id={`rcpt-${g.id}`} name="receipt" type="file" required accept="application/pdf,image/jpeg,image/png,image/webp" className="text-sm" />
                    </div>
                    <input name="note" className="input" placeholder={t("admin.disbursements.note")} />
                    <SubmitButton className="btn-trust">{t("admin.disbursements.markPaid")}</SubmitButton>
                  </ActionForm>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState>{t("admin.queues.empty")}</EmptyState>
      )}
    </div>
  );
}

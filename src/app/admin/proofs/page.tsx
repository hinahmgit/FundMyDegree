import { getT } from "@/i18n/server";
import { getFormatter } from "@/lib/server-format";
import { db } from "@/lib/supabase/admin";
import { documentHref } from "@/lib/files";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/forms";
import { confirmProof, rejectProof } from "@/actions/admin";
import type { Donation, Grant } from "@/types/db";

export default async function ProofQueue() {
  const [t, f] = await Promise.all([getT(), getFormatter()]);
  const { data } = await db().from("donations").select("*").eq("method", "direct").eq("status", "pending").not("proof_submitted_at", "is", null).order("proof_submitted_at");
  const rows = (data ?? []) as Donation[];
  const ids = [...new Set(rows.flatMap((d) => [d.donor_id, d.student_id]).filter(Boolean))] as string[];
  const grantIds = [...new Set(rows.map((d) => d.grant_id))];
  const [{ data: people }, { data: grants }] = await Promise.all([
    ids.length ? db().from("profiles").select("id, full_name, email").in("id", ids) : Promise.resolve({ data: [] }),
    grantIds.length ? db().from("grants").select("*").in("id", grantIds) : Promise.resolve({ data: [] }),
  ]);
  const pMap = new Map((people ?? []).map((p) => [p.id, p]));
  const gMap = new Map(((grants ?? []) as Grant[]).map((g) => [g.id, g]));
  const uniIds = [...new Set(((grants ?? []) as Grant[]).map((g) => g.university_id))];
  const { data: unis } = uniIds.length ? await db().from("universities").select("id, name, finance_contact_email").in("id", uniIds) : { data: [] };
  const uMap = new Map((unis ?? []).map((u) => [u.id, u]));

  return (
    <div>
      <PageHeader title={t("admin.proofs.title")} />
      {rows.length ? (
        <div className="space-y-4">
          {rows.map((d) => {
            const g = gMap.get(d.grant_id)!;
            const u = uMap.get(g.university_id);
            return (
              <Card key={d.id}>
                <div className="grid gap-4 md:grid-cols-3">
                  <dl className="space-y-1 text-sm md:col-span-1">
                    <div><dt className="text-stone-500">{t("receipt.donor")}</dt><dd className="font-medium">{pMap.get(d.donor_id ?? "")?.full_name} <span className="text-stone-500">{pMap.get(d.donor_id ?? "")?.email}</span></dd></div>
                    <div><dt className="text-stone-500">{t("receipt.student")}</dt><dd>{pMap.get(d.student_id)?.full_name} · {g.term_label}</dd></div>
                    <div><dt className="text-stone-500">{t("receipt.university")}</dt><dd>{u?.name} {u?.finance_contact_email && <span className="text-stone-500">({u.finance_contact_email})</span>}</dd></div>
                    <div><dt className="text-stone-500">{t("admin.proofs.pledged")}</dt><dd className="font-semibold">{f.money(Number(d.grant_amount), g.currency)}</dd></div>
                  </dl>
                  <dl className="space-y-1 text-sm">
                    <div><dt className="text-stone-500">{t("pledge.proofAmount")}</dt><dd className="font-semibold">{d.proof_amount !== null && f.money(Number(d.proof_amount), d.proof_currency ?? g.currency)}</dd></div>
                    <div><dt className="text-stone-500">{t("pledge.proofReference")}</dt><dd className="font-mono">{d.proof_reference}</dd></div>
                    <div><dt className="text-stone-500">{t("pledge.proofDate")}</dt><dd>{d.proof_date && f.date(d.proof_date)}</dd></div>
                    <div><dt className="text-stone-500">{t("admin.proofs.proof")}</dt><dd><a className="link" href={documentHref(d.proof_document_id)!} target="_blank" rel="noreferrer">{t("common.viewFile")}</a></dd></div>
                  </dl>
                  <div className="space-y-4">
                    <ActionForm action={confirmProof}>
                      <input type="hidden" name="donation_id" value={d.id} />
                      <div>
                        <label className="label" htmlFor={`amt-${d.id}`}>{t("admin.proofs.confirmedAmount", { currency: g.currency })}</label>
                        <input id={`amt-${d.id}`} name="confirmed_amount" type="number" step="0.01" min="0.01" required className="input" defaultValue={Number(d.grant_amount)} />
                        <p className="hint">{t("admin.proofs.confirmedHint")}</p>
                      </div>
                      <input name="note" className="input" placeholder={t("common.notes")} />
                      <SubmitButton className="btn-trust w-full">{t("admin.proofs.confirm")}</SubmitButton>
                    </ActionForm>
                    <ActionForm action={rejectProof}>
                      <input type="hidden" name="donation_id" value={d.id} />
                      <input name="reason" required className="input" placeholder={t("admin.proofs.rejectReason")} />
                      <SubmitButton className="btn-danger w-full">{t("admin.proofs.reject")}</SubmitButton>
                    </ActionForm>
                  </div>
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

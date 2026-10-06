import Link from "next/link";
import { getT } from "@/i18n/server";
import { getFormatter } from "@/lib/server-format";
import { db } from "@/lib/supabase/admin";
import { documentHref } from "@/lib/files";
import { Alert, Card, EmptyState, PageHeader } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/forms";
import { reviewResults } from "@/actions/admin";
import type { StudentProfile, TermFee, TermResult } from "@/types/db";

export default async function ResultsQueue() {
  const [t, f] = await Promise.all([getT(), getFormatter()]);
  const { data } = await db().from("term_results").select("*").eq("status", "pending").order("created_at");
  const rows = (data ?? []) as TermResult[];
  const sids = [...new Set(rows.map((r) => r.student_id))];
  const [{ data: sps }, { data: people }, { data: fees }] = await Promise.all([
    sids.length ? db().from("student_profiles").select("*").in("user_id", sids) : Promise.resolve({ data: [] }),
    sids.length ? db().from("profiles").select("id, full_name").in("id", sids) : Promise.resolve({ data: [] }),
    sids.length ? db().from("term_fees").select("*").in("student_id", sids) : Promise.resolve({ data: [] }),
  ]);
  const spMap = new Map(((sps ?? []) as StudentProfile[]).map((s) => [s.user_id, s]));
  const nameMap = new Map((people ?? []).map((p) => [p.id, p.full_name]));
  const { data: unis } = sps?.length ? await db().from("universities").select("id, fee_currency").in("id", (sps as StudentProfile[]).map((s) => s.university_id).filter(Boolean) as string[]) : { data: [] };
  const curMap = new Map((unis ?? []).map((u) => [u.id, u.fee_currency]));

  return (
    <div>
      <PageHeader title={t("admin.results.title")} />
      {rows.length ? (
        <div className="space-y-4">
          {rows.map((r) => {
            const sp = spMap.get(r.student_id);
            const last = sp ? r.term_number >= sp.total_terms : false;
            const nextFee = ((fees ?? []) as TermFee[]).find((x) => x.student_id === r.student_id && x.term_number === r.term_number + 1);
            const currency = sp?.university_id ? curMap.get(sp.university_id) : "";
            return (
              <Card key={r.id} title={<Link className="hover:text-brand-700" href={`/admin/students/${r.student_id}`}>{nameMap.get(r.student_id)} · {t("common.termXofY", { x: r.term_number, y: sp?.total_terms ?? "?" })}</Link>}>
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2 text-sm">
                    {r.gpa !== null && <p className="text-lg font-semibold">{r.gpa_scale ? t("student.gpaOf", { gpa: r.gpa, scale: r.gpa_scale }) : t("student.gpa", { gpa: r.gpa })}</p>}
                    <p><a className="link" href={documentHref(r.transcript_document_id)!} target="_blank" rel="noreferrer">{t("results.transcript")}</a></p>
                    {r.summary && <p className="whitespace-pre-line text-stone-700">{r.summary}</p>}
                    <p className="text-xs text-stone-500">{f.dateTime(r.created_at)}</p>
                  </div>
                  <div className="space-y-4">
                    <ActionForm action={reviewResults}>
                      <input type="hidden" name="result_id" value={r.id} />
                      <input type="hidden" name="decision" value="approve" />
                      {last ? (
                        <Alert>{t("admin.results.lastTerm")}</Alert>
                      ) : (
                        <div>
                          <label className="label" htmlFor={`nt-${r.id}`}>{t("admin.results.nextTarget", { currency: currency ?? "" })}</label>
                          <input id={`nt-${r.id}`} name="next_target" type="number" step="0.01" min="1" className="input" defaultValue={nextFee?.amount} required={!nextFee} />
                          {!nextFee && <p className="hint text-amber-700">{t("admin.results.noFee")}</p>}
                        </div>
                      )}
                      <input name="reason" className="input" placeholder={`${t("common.notes")} (${t("common.optional")})`} />
                      <SubmitButton className="btn-trust w-full">{t("admin.results.approve")}</SubmitButton>
                    </ActionForm>
                    <ActionForm action={reviewResults}>
                      <input type="hidden" name="result_id" value={r.id} />
                      <input type="hidden" name="decision" value="reject" />
                      <input name="reason" required className="input" placeholder={t("common.reason")} />
                      <SubmitButton className="btn-danger w-full">{t("admin.results.reject")}</SubmitButton>
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

import Link from "next/link";
import { notFound } from "next/navigation";
import { getT } from "@/i18n/server";
import { getFormatter } from "@/lib/server-format";
import { db } from "@/lib/supabase/admin";
import { getStudentOverview } from "@/lib/students";
import { documentHref } from "@/lib/files";
import { countryName } from "@/lib/format";
import { Alert, Badge, Card, PageHeader } from "@/components/ui";
import { GrantStatusBadge, UniversityBadge, VerificationBadge } from "@/components/status";
import { ActionForm, SubmitButton } from "@/components/forms";
import { rejectStudent, verifyStudent, withdrawStudent } from "@/actions/admin";
import type { MessageKey } from "@/i18n/translate";
import type { DocumentRow } from "@/types/db";

export default async function AdminStudentReview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [t, f, o] = await Promise.all([getT(), getFormatter(), getStudentOverview(id, { revealDonorIds: true })]);
  if (!o) notFound();
  const { data: docs } = await db().from("documents").select("*").eq("student_id", id).order("created_at", { ascending: false });
  const currentFee = o.fees.find((x) => x.term_number === o.student.current_term);
  const uniApproved = o.university?.status === "approved";

  return (
    <div className="space-y-6">
      <PageHeader
        title={o.profile.full_name}
        subtitle={`${o.profile.email ?? ""} · ${countryName(o.profile.country_code, f.locale)}`}
        actions={<><VerificationBadge status={o.student.verification_status} t={t} /><Link className="btn-secondary" href={`/students/${id}`}>{t("common.view")}</Link></>}
      />
      {o.student.submitted_at && <p className="text-sm text-stone-500">{t("admin.verify.submittedAt", { date: f.dateTime(o.student.submitted_at) })}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={t("student.studies")}>
          <dl className="space-y-2 text-sm">
            <div><dt className="text-stone-500">{t("studentProfile.university")}</dt><dd className="flex items-center gap-2">{o.university?.name} {o.university && <UniversityBadge status={o.university.status} t={t} />}</dd></div>
            <div><dt className="text-stone-500">{t("studentProfile.studentNumber")}</dt><dd>{o.student.student_number ?? "—"}</dd></div>
            <div><dt className="text-stone-500">{t("studentProfile.program")}</dt><dd>{o.student.program_name} ({o.student.degree_level && t(`degree.${o.student.degree_level}`)}) · {o.student.field_of_study}</dd></div>
            <div><dt className="text-stone-500">{t("studentProfile.currentTerm")}</dt><dd>{t("common.termXofY", { x: o.student.current_term, y: o.student.total_terms })}</dd></div>
            <div><dt className="text-stone-500">{t("studentProfile.expectedGraduation")}</dt><dd>{o.student.expected_graduation ? f.date(o.student.expected_graduation) : "—"}</dd></div>
          </dl>
          <h3 className="mt-4 mb-1 text-sm font-semibold">{t("studentProfile.story")}</h3>
          <p className="text-sm whitespace-pre-line text-stone-700">{o.student.story}</p>
          <h3 className="mt-4 mb-1 text-sm font-semibold">{t("studentProfile.fees")}</h3>
          <ul className="text-sm">
            {o.fees.map((fee) => (
              <li key={fee.id} className="flex justify-between py-0.5">
                <span>#{fee.term_number} {fee.label}</span>
                <span>{f.money(fee.amount, o.university?.fee_currency ?? "USD")}{fee.due_date && ` · ${f.date(fee.due_date)}`}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title={t("admin.verify.documents")}>
          <ul className="space-y-2 text-sm">
            {((docs ?? []) as DocumentRow[]).map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2">
                <span><Badge>{t(`documents.${d.type}` as MessageKey)}</Badge> <span className="text-stone-500">{f.date(d.created_at)}</span></span>
                <a href={documentHref(d.id)!} target="_blank" rel="noreferrer" className="link">{d.file_name}</a>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {o.student.verification_status === "pending" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title={t("admin.verify.approve")}>
            {!uniApproved && <div className="mb-3"><Alert tone="warn">{t("status.university.pending")}: <Link className="link" href={`/admin/universities/${o.university?.id}`}>{o.university?.name}</Link></Alert></div>}
            <ActionForm action={verifyStudent}>
              <input type="hidden" name="student_id" value={id} />
              <div>
                <label className="label" htmlFor="target_amount">{t("admin.verify.openGrantAmount", { currency: o.university?.fee_currency ?? "" })}</label>
                <input id="target_amount" name="target_amount" type="number" step="0.01" min="1" required className="input" defaultValue={currentFee?.amount} />
                <p className="hint">{t("admin.verify.openGrantHint", { term: o.student.current_term })}</p>
              </div>
              <div>
                <label className="label" htmlFor="invoice_number">{t("documents.invoiceNumber")}</label>
                <input id="invoice_number" name="invoice_number" className="input" />
              </div>
              <SubmitButton className="btn-trust" disabled={!uniApproved}>{t("admin.verify.approve")}</SubmitButton>
            </ActionForm>
          </Card>
          <Card title={t("admin.verify.reject")}>
            <ActionForm action={rejectStudent}>
              <input type="hidden" name="student_id" value={id} />
              <div>
                <label className="label" htmlFor="reason">{t("admin.verify.rejectReason")}</label>
                <textarea id="reason" name="reason" required rows={4} className="input" />
              </div>
              <SubmitButton className="btn-danger">{t("admin.verify.reject")}</SubmitButton>
            </ActionForm>
          </Card>
        </div>
      )}

      {o.grants.length > 0 && (
        <Card title={t("student.pastGrants")}>
          <ul className="space-y-2 text-sm">
            {o.grants.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>{g.term_label}</span>
                <span className="flex items-center gap-2">{f.money(g.progress.confirmed, g.currency)} / {f.money(g.target_amount, g.currency)} <GrantStatusBadge status={g.status} t={t} /></span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {o.student.verification_status === "verified" && o.student.status === "active" && (
        <Card title={t("status.student.withdrawn")}>
          <ActionForm action={withdrawStudent}>
            <input type="hidden" name="user_id" value={id} />
            <textarea name="reason" required rows={2} className="input" placeholder={t("common.reason")} />
            <SubmitButton className="btn-danger">{t("status.student.withdrawn")}</SubmitButton>
          </ActionForm>
        </Card>
      )}
    </div>
  );
}

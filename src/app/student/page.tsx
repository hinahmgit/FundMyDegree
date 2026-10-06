import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getT } from "@/i18n/server";
import { getFormatter } from "@/lib/server-format";
import { getStudentOverview } from "@/lib/students";
import { documentHref } from "@/lib/files";
import { countryName } from "@/lib/format";
import { Alert, Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { GrantProgress } from "@/components/grant-progress";
import { DonationStatusBadge, GrantStatusBadge, ReviewBadge, VerificationBadge } from "@/components/status";
import { ActionForm, SubmitButton } from "@/components/forms";
import { postUpdate } from "@/actions/student";

export default async function StudentDashboard() {
  const user = await requireRole("student");
  const [t, f, overview] = await Promise.all([getT(), getFormatter(), getStudentOverview(user.id)]);
  const sp = overview?.student;
  const status = sp?.verification_status ?? "draft";
  const current = overview?.currentGrant ?? null;
  const resultFor = (grantId: string) => overview?.results.find((r) => r.grant_id === grantId);
  const latestPaid = overview?.grants.find((g) => g.status === "paid" || g.status === "funded");
  const latestResult = latestPaid ? resultFor(latestPaid.id) : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("studentDash.title")}
        actions={<Link href="/student/profile" className="btn-secondary">{t("studentDash.completeProfile")}</Link>}
      />

      {sp?.status === "graduated" && <Alert tone="success">{t("studentDash.graduated")}</Alert>}

      <Card title={t("studentDash.verification")} actions={<VerificationBadge status={status} t={t} />}>
        <p className="text-stone-700">
          {status === "draft" && t("studentDash.verificationDraft")}
          {status === "pending" && t("studentDash.verificationPending")}
          {status === "verified" && t("studentDash.verificationVerified")}
          {status === "rejected" && t("studentDash.verificationRejected", { reason: sp?.verification_note ?? "" })}
        </p>
        {(status === "draft" || status === "rejected") && (
          <Link href="/student/profile" className="btn-primary mt-4">{t("studentDash.completeProfile")}</Link>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" title={t("studentDash.currentGrant")} actions={current && <GrantStatusBadge status={current.status} t={t} />}>
          {current ? (
            <div className="space-y-3">
              <p className="font-medium">{current.term_label} · {overview?.university?.name}</p>
              <GrantProgress progress={current.progress} t={t} f={f} />
              {current.payment_deadline && <p className="text-sm text-stone-500">{t("common.dueOn", { date: f.date(current.payment_deadline) })}</p>}
            </div>
          ) : (
            <EmptyState>{t("studentDash.noGrant")}</EmptyState>
          )}
        </Card>

        <Card title={t("studentDash.nextGrant")}>
          {!latestPaid ? (
            <p className="text-sm text-stone-600">{t("studentDash.nextGrantWaiting")}</p>
          ) : !latestResult ? (
            <div className="space-y-3 text-sm">
              <p className="text-stone-600">{t("studentDash.nextGrantWaiting")}</p>
              <Link href={`/student/results/${latestPaid.id}`} className="btn-primary">{t("studentDash.uploadResults")}</Link>
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              <ReviewBadge status={latestResult.status} t={t} />
              <p className="text-stone-600">
                {latestResult.status === "pending" && t("studentDash.nextGrantPending")}
                {latestResult.status === "approved" && t("studentDash.nextGrantApproved")}
                {latestResult.status === "rejected" && t("studentDash.nextGrantRejected", { reason: latestResult.review_reason ?? "" })}
              </p>
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={t("studentDash.donors")}>
          {overview?.supporters.length ? (
            <ul className="divide-y divide-stone-100">
              {overview.supporters.map((s) => (
                <li key={s.donationId} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div>
                    <div className="font-medium">{s.anonymous ? t("common.anonymous") : s.name}</div>
                    <div className="text-xs text-stone-500">{s.anonymous ? "" : countryName(s.countryCode, f.locale)} · {f.date(s.createdAt)}</div>
                  </div>
                  <div className="text-right">
                    <div>{f.money(s.amount, s.currency)}</div>
                    <DonationStatusBadge donation={{ status: s.status as never, method: s.method as never, proof_submitted_at: null }} t={t} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>{t("studentDash.noDonors")}</EmptyState>
          )}
        </Card>

        <Card title={t("studentDash.receipts")}>
          {overview?.disbursements.filter((d) => d.receipt_document_id).length ? (
            <ul className="space-y-2 text-sm">
              {overview.disbursements.filter((d) => d.receipt_document_id).map((d) => {
                const g = overview.grants.find((x) => x.id === d.grant_id);
                return (
                  <li key={d.id} className="flex items-center justify-between">
                    <span>{g?.term_label} · {f.date(d.paid_on)}</span>
                    <a href={documentHref(d.receipt_document_id)!} className="link" target="_blank" rel="noreferrer">{t("common.viewFile")}</a>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState>{t("common.noResults")}</EmptyState>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={t("studentDash.resultsTitle")}>
          {overview?.results.length ? (
            <ul className="space-y-2 text-sm">
              {overview.results.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2">
                  <span>
                    {overview.grants.find((g) => g.id === r.grant_id)?.term_label}
                    {r.gpa !== null && <span className="ml-2 text-stone-500">{r.gpa_scale ? t("student.gpaOf", { gpa: r.gpa, scale: r.gpa_scale }) : t("student.gpa", { gpa: r.gpa })}</span>}
                  </span>
                  <ReviewBadge status={r.status} t={t} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>{t("common.noResults")}</EmptyState>
          )}
        </Card>

        {status === "verified" && (
          <Card title={t("studentDash.postUpdate")}>
            <ActionForm action={postUpdate} resetOnSuccess>
              <textarea name="body" rows={4} maxLength={5000} required className="input" placeholder={t("studentDash.updatePlaceholder")} />
              <SubmitButton>{t("common.submit")}</SubmitButton>
            </ActionForm>
            {overview?.updates.length ? (
              <ul className="mt-4 space-y-3 border-t border-stone-100 pt-4 text-sm">
                {overview.updates.slice(0, 5).map((u) => (
                  <li key={u.id}>
                    <div className="text-xs text-stone-500">{f.dateTime(u.created_at)}</div>
                    <p className="whitespace-pre-line">{u.body}</p>
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>
        )}
      </div>

      {overview && overview.grants.length > 1 && (
        <Card title={t("student.pastGrants")}>
          <ul className="space-y-3">
            {overview.grants.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-medium">{g.term_label}</span>
                <span className="flex items-center gap-2">{f.money(g.progress.confirmed, g.currency)} / {f.money(g.target_amount, g.currency)} <GrantStatusBadge status={g.status} t={t} /></span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {sp && <p className="text-center text-xs text-stone-400"><Badge>{t("common.termXofY", { x: sp.current_term, y: sp.total_terms })}</Badge></p>}
    </div>
  );
}

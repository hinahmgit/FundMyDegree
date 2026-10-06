import { requireRole } from "@/lib/auth";
import { getT } from "@/i18n/server";
import { db } from "@/lib/supabase/admin";
import { getCountries, getCurrencies } from "@/lib/reference";
import { getFormatter } from "@/lib/server-format";
import { avatarUrl, documentHref } from "@/lib/files";
import { missingForVerification, STUDENT_DOCS } from "@/lib/students";
import { Alert, Badge, Card, PageHeader } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/forms";
import { VerificationBadge } from "@/components/status";
import { requestUniversity, submitForVerification, uploadStudentDocument } from "@/actions/student";
import type { MessageKey } from "@/i18n/translate";
import type { DocumentRow, StudentProfile, TermFee, University } from "@/types/db";
import { ProfileForm } from "./profile-form";

export default async function StudentProfilePage() {
  const user = await requireRole("student");
  const [t, f, countries, currencies] = await Promise.all([getT(), getFormatter(), getCountries(), getCurrencies()]);
  const [{ data: sp }, { data: fees }, { data: universities }, { data: docs }] = await Promise.all([
    db().from("student_profiles").select("*").eq("user_id", user.id).maybeSingle<StudentProfile>(),
    db().from("term_fees").select("*").eq("student_id", user.id).order("term_number"),
    db().from("universities").select("*").or(`status.eq.approved,requested_by.eq.${user.id}`).neq("status", "rejected").order("name"),
    db().from("documents").select("*").eq("student_id", user.id).in("type", STUDENT_DOCS).order("created_at", { ascending: false }),
  ]);
  const status = sp?.verification_status ?? "draft";
  const locked = status === "pending" || status === "verified";
  const missing = await missingForVerification(user.id);
  const latestDoc = (type: string) => (docs as DocumentRow[] | null)?.find((d) => d.type === type);

  return (
    <div className="space-y-6">
      <PageHeader title={t("studentProfile.title")} subtitle={t("studentProfile.subtitle")} actions={<VerificationBadge status={status} t={t} />} />
      {status === "rejected" && sp?.verification_note && <Alert tone="warn">{t("studentDash.verificationRejected", { reason: sp.verification_note })}</Alert>}
      {locked && <Alert>{t("studentProfile.lockedAfterVerification")}</Alert>}

      <Card>
        <ProfileForm
          locked={locked}
          student={sp}
          fees={(fees ?? []) as TermFee[]}
          photoUrl={avatarUrl(sp?.photo_path ?? user.profile.avatar_path)}
          universities={((universities ?? []) as University[]).map((u) => ({
            id: u.id,
            name: u.status === "pending" ? t("studentProfile.pendingUniversity", { name: u.name }) : u.name,
            country: countries.find((c) => c.code === u.country_code)?.name ?? u.country_code,
            currency: u.fee_currency,
          }))}
        />
      </Card>

      {!locked && (
        <Card title={t("studentProfile.requestUniversity")}>
          <p className="mb-4 text-sm text-stone-600">{t("studentProfile.requestUniversityBody")}</p>
          <ActionForm action={requestUniversity} resetOnSuccess className="grid gap-4 space-y-0 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="u_name">{t("studentProfile.universityName")}</label>
              <input id="u_name" name="name" className="input" required minLength={3} />
            </div>
            <div>
              <label className="label" htmlFor="u_country">{t("common.country")}</label>
              <select id="u_country" name="country_code" className="input" required defaultValue={user.profile.country_code ?? ""}>
                {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="u_city">{t("studentProfile.universityCity")}</label>
              <input id="u_city" name="city" className="input" />
            </div>
            <div>
              <label className="label" htmlFor="u_web">{t("studentProfile.universityWebsite")}</label>
              <input id="u_web" name="website" type="url" className="input" placeholder="https://" />
            </div>
            <div>
              <label className="label" htmlFor="u_cur">{t("studentProfile.universityCurrency")}</label>
              <select id="u_cur" name="fee_currency" className="input" defaultValue={countries.find((c) => c.code === user.profile.country_code)?.default_currency ?? "USD"}>
                {currencies.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2"><SubmitButton className="btn-secondary">{t("studentProfile.requestUniversity")}</SubmitButton></div>
          </ActionForm>
        </Card>
      )}

      <Card title={t("documents.title")}>
        <p className="mb-4 text-sm text-stone-600">{t("documents.subtitle")}</p>
        <div className="space-y-4">
          {STUDENT_DOCS.map((type) => {
            const doc = latestDoc(type);
            return (
              <div key={type} className="rounded-xl border border-stone-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">{t(`documents.${type}` as MessageKey)}</div>
                    <div className="text-xs text-stone-500">
                      {doc ? (
                        <>
                          {t("documents.uploaded", { date: f.date(doc.created_at) })} ·{" "}
                          <a href={documentHref(doc.id)!} target="_blank" rel="noreferrer" className="link">{doc.file_name}</a>
                        </>
                      ) : (
                        t("documents.missing")
                      )}
                    </div>
                  </div>
                  {doc ? <Badge tone="trust">✓</Badge> : <Badge tone="warn">!</Badge>}
                </div>
                {!locked && (
                  <ActionForm action={uploadStudentDocument} resetOnSuccess className="mt-3 flex flex-col gap-2 space-y-0 sm:flex-row sm:items-center">
                    <input type="hidden" name="type" value={type} />
                    <input type="file" name="file" required accept="application/pdf,image/jpeg,image/png,image/webp" className="text-sm" />
                    <SubmitButton className="btn-secondary">{doc ? t("documents.replace") : t("common.upload")}</SubmitButton>
                  </ActionForm>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {(status === "draft" || status === "rejected") && (
        <Card title={t("studentDash.submitForReview")}>
          {missing.length > 0 && (
            <div className="mb-4">
              <Alert tone="warn">{t("studentDash.missingForSubmit", { items: missing.map((k) => t(k as MessageKey)).join(", ") })}</Alert>
            </div>
          )}
          <ActionForm action={submitForVerification}>
            <SubmitButton disabled={missing.length > 0}>{t("studentDash.submitForReview")}</SubmitButton>
          </ActionForm>
        </Card>
      )}
    </div>
  );
}

import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getT } from "@/i18n/server";
import { db } from "@/lib/supabase/admin";
import { Alert, Card, PageHeader } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/forms";
import { submitResults } from "@/actions/student";
import type { Grant } from "@/types/db";

export default async function ResultsUploadPage({ params }: { params: Promise<{ grantId: string }> }) {
  const user = await requireRole("student");
  const { grantId } = await params;
  const t = await getT();
  const { data: grant } = await db().from("grants").select("*").eq("id", grantId).eq("student_id", user.id).maybeSingle<Grant>();
  if (!grant) notFound();
  const { count } = await db().from("term_results").select("id", { count: "exact", head: true }).eq("grant_id", grant.id);
  const eligible = ["funded", "paid"].includes(grant.status);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t("results.title")} subtitle={`${t("results.term")}: ${grant.term_label ?? grant.term_number}`} />
      <Card>
        {count ? (
          <Alert>{t("results.alreadySubmitted")}</Alert>
        ) : !eligible ? (
          <Alert tone="warn">{t("results.notEligible")}</Alert>
        ) : (
          <ActionForm action={submitResults}>
            <input type="hidden" name="grant_id" value={grant.id} />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label" htmlFor="gpa">{t("results.gpa")}</label>
                <input id="gpa" name="gpa" type="number" step="0.01" min={0} className="input" />
              </div>
              <div>
                <label className="label" htmlFor="gpa_scale">{t("results.gpaScale")}</label>
                <input id="gpa_scale" name="gpa_scale" type="number" step="0.01" min={0} className="input" placeholder="4.0" />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="transcript">{t("results.transcript")}</label>
              <input id="transcript" name="transcript" type="file" required accept="application/pdf,image/jpeg,image/png,image/webp" className="text-sm" />
            </div>
            <div>
              <label className="label" htmlFor="summary">{t("results.summary")}</label>
              <textarea id="summary" name="summary" rows={5} maxLength={5000} className="input" />
            </div>
            <SubmitButton>{t("common.submit")}</SubmitButton>
          </ActionForm>
        )}
      </Card>
    </div>
  );
}

import Link from "next/link";
import { getT } from "@/i18n/server";
import { getFormatter } from "@/lib/server-format";
import { db } from "@/lib/supabase/admin";
import { countryName } from "@/lib/format";
import { Card, EmptyState, PageHeader, TableWrap, cn } from "@/components/ui";
import { VerificationBadge } from "@/components/status";
import type { StudentProfile, VerificationStatus } from "@/types/db";

const TABS: VerificationStatus[] = ["pending", "verified", "rejected", "draft"];

export default async function AdminStudentsQueue({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const [t, f, sp] = await Promise.all([getT(), getFormatter(), searchParams]);
  const status = (TABS as string[]).includes(sp.status ?? "") ? (sp.status as VerificationStatus) : "pending";
  const { data } = await db().from("student_profiles").select("*").eq("verification_status", status).order("submitted_at", { ascending: true }).limit(200);
  const rows = (data ?? []) as StudentProfile[];
  const ids = rows.map((r) => r.user_id);
  const uniIds = [...new Set(rows.map((r) => r.university_id).filter(Boolean))] as string[];
  const [{ data: profiles }, { data: unis }] = await Promise.all([
    ids.length ? db().from("profiles").select("id, full_name, country_code").in("id", ids) : Promise.resolve({ data: [] }),
    uniIds.length ? db().from("universities").select("id, name, status").in("id", uniIds) : Promise.resolve({ data: [] }),
  ]);
  const pMap = new Map((profiles ?? []).map((p) => [p.id, p]));
  const uMap = new Map((unis ?? []).map((u) => [u.id, u]));

  return (
    <div>
      <PageHeader title={t("admin.verify.title")} />
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((s) => (
          <Link key={s} href={`/admin/students?status=${s}`} className={cn("rounded-full px-3 py-1 text-sm", s === status ? "bg-brand-600 text-white" : "bg-white text-stone-600 ring-1 ring-stone-200")}>
            {t(`status.verification.${s}`)}
          </Link>
        ))}
      </div>
      <Card>
        {rows.length ? (
          <TableWrap>
            <table className="data-table">
              <thead><tr><th>{t("auth.fullName")}</th><th>{t("common.country")}</th><th>{t("studentProfile.university")}</th><th>{t("common.date")}</th><th>{t("common.status")}</th><th /></tr></thead>
              <tbody>
                {rows.map((r) => {
                  const u = r.university_id ? uMap.get(r.university_id) : undefined;
                  return (
                    <tr key={r.user_id}>
                      <td className="font-medium">{pMap.get(r.user_id)?.full_name}</td>
                      <td>{countryName(pMap.get(r.user_id)?.country_code, f.locale)}</td>
                      <td>{u?.name}{u?.status === "pending" && <span className="ml-1 text-xs text-amber-700">({t("status.university.pending")})</span>}</td>
                      <td className="whitespace-nowrap">{r.submitted_at ? f.date(r.submitted_at) : "—"}</td>
                      <td><VerificationBadge status={r.verification_status} t={t} /></td>
                      <td><Link href={`/admin/students/${r.user_id}`} className="link">{t("common.view")}</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        ) : (
          <EmptyState>{t("admin.queues.empty")}</EmptyState>
        )}
      </Card>
    </div>
  );
}

import Link from "next/link";
import { getT } from "@/i18n/server";
import { db } from "@/lib/supabase/admin";
import { countryName } from "@/lib/format";
import { getLocale } from "@/i18n/server";
import { Card, EmptyState, PageHeader, TableWrap } from "@/components/ui";
import { UniversityBadge } from "@/components/status";
import { ActionForm, SubmitButton } from "@/components/forms";
import { reviewUniversity } from "@/actions/admin";
import type { University } from "@/types/db";

export default async function AdminUniversities({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const [t, locale, { q }] = await Promise.all([getT(), getLocale(), searchParams]);
  let query = db().from("universities").select("*").order("name").limit(500);
  if (q) query = query.ilike("name", `%${q.replace(/[%_]/g, "")}%`);
  const { data } = await query;
  const all = (data ?? []) as University[];
  const pending = all.filter((u) => u.status === "pending");
  const others = all.filter((u) => u.status !== "pending");

  return (
    <div className="space-y-6">
      <PageHeader title={t("admin.universities.title")} actions={<Link href="/admin/universities/new" className="btn-primary">+ {t("admin.universities.add")}</Link>} />

      <Card title={t("admin.universities.pending")}>
        {pending.length ? (
          <ul className="space-y-4">
            {pending.map((u) => (
              <li key={u.id} className="rounded-xl border border-stone-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold">{u.name}</div>
                    <div className="text-sm text-stone-500">{u.city ? `${u.city}, ` : ""}{countryName(u.country_code, locale)} · {u.fee_currency} · {u.website && <a href={u.website} className="link" target="_blank" rel="noreferrer noopener">{u.website}</a>}</div>
                  </div>
                  <Link href={`/admin/universities/${u.id}`} className="btn-secondary">{t("common.edit")}</Link>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <ActionForm action={reviewUniversity}>
                    <input type="hidden" name="id" value={u.id} />
                    <input type="hidden" name="decision" value="approve" />
                    <label className="flex gap-2 text-sm"><input type="checkbox" name="accreditation_confirmed" required /> {t("admin.universities.approveConfirm")}</label>
                    <SubmitButton className="btn-trust">{t("common.approve")}</SubmitButton>
                  </ActionForm>
                  <ActionForm action={reviewUniversity}>
                    <input type="hidden" name="id" value={u.id} />
                    <input type="hidden" name="decision" value="reject" />
                    <input name="reason" required className="input" placeholder={t("common.reason")} />
                    <SubmitButton className="btn-danger">{t("common.reject")}</SubmitButton>
                  </ActionForm>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState>{t("admin.queues.empty")}</EmptyState>
        )}
      </Card>

      <Card title={t("admin.universities.approved")}>
        <form className="mb-3 flex gap-2"><input name="q" defaultValue={q} className="input" placeholder={t("common.search")} /><button className="btn-secondary">{t("common.search")}</button></form>
        <TableWrap>
          <table className="data-table">
            <thead><tr><th>{t("studentProfile.universityName")}</th><th>{t("common.country")}</th><th>{t("common.currency")}</th><th>{t("common.status")}</th><th /></tr></thead>
            <tbody>
              {others.map((u) => (
                <tr key={u.id}>
                  <td className="font-medium">{u.name}</td>
                  <td>{countryName(u.country_code, locale)}</td>
                  <td>{u.fee_currency}</td>
                  <td><UniversityBadge status={u.status} t={t} /></td>
                  <td><Link className="link" href={`/admin/universities/${u.id}`}>{t("common.edit")}</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Card>
    </div>
  );
}

import Link from "next/link";
import { getT } from "@/i18n/server";
import { getFormatter } from "@/lib/server-format";
import { getCurrentUser } from "@/lib/auth";
import { searchUsers } from "@/lib/admin-queries";
import { getCountries } from "@/lib/reference";
import { countryName } from "@/lib/format";
import { Badge, Card, PageHeader, Pagination, TableWrap } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/forms";
import { setSuspension } from "@/actions/admin";

const PAGE = 50;

export default async function AdminUsers({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const [t, f, me, countries, { rows, count }] = await Promise.all([getT(), getFormatter(), getCurrentUser(), getCountries(), searchUsers(sp, PAGE, (page - 1) * PAGE)]);
  const qs = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "page") as [string, string][]);
  return (
    <div>
      <PageHeader title={t("admin.users.title")} actions={<a href={`/admin/users/export?${qs}`} className="btn-secondary">{t("common.exportCsv")}</a>} />
      <form className="card mb-4 grid gap-3 sm:grid-cols-5">
        <input name="q" defaultValue={sp.q} className="input sm:col-span-2" placeholder={t("admin.users.search")} />
        <select name="role" defaultValue={sp.role ?? ""} className="input">
          <option value="">{t("admin.users.role")}: {t("common.all")}</option>
          {(["student", "donor", "admin"] as const).map((r) => <option key={r} value={r}>{t(`roles.${r}`)}</option>)}
        </select>
        <select name="country" defaultValue={sp.country ?? ""} className="input">
          <option value="">{t("common.country")}: {t("common.all")}</option>
          {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>
        <div className="flex gap-2">
          <select name="status" defaultValue={sp.status ?? ""} className="input">
            <option value="">{t("common.status")}</option>
            <option value="active">{t("status.student.active")}</option>
            <option value="suspended">{t("admin.users.suspended")}</option>
          </select>
          <button className="btn-primary">{t("common.filter")}</button>
        </div>
      </form>
      <Card>
        <p className="mb-2 text-sm text-stone-500">{count}</p>
        <TableWrap>
          <table className="data-table">
            <thead><tr><th>{t("auth.fullName")}</th><th>{t("admin.users.role")}</th><th>{t("common.country")}</th><th>{t("common.currency")}</th><th>{t("admin.users.joined")}</th><th>{t("common.actions")}</th></tr></thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="font-medium">{u.role === "student" ? <Link className="hover:text-brand-700" href={`/admin/students/${u.id}`}>{u.full_name}</Link> : u.full_name}</div>
                    <div className="text-xs text-stone-500">{u.email}</div>
                  </td>
                  <td><Badge tone={u.role === "admin" ? "info" : u.role === "student" ? "brand" : "neutral"}>{t(`roles.${u.role}`)}</Badge></td>
                  <td>{countryName(u.country_code, f.locale)}</td>
                  <td>{u.preferred_currency}</td>
                  <td className="whitespace-nowrap">{f.date(u.created_at)}</td>
                  <td className="min-w-56">
                    {u.id === me?.id ? null : u.suspended_at ? (
                      <ActionForm action={setSuspension} className="space-y-1">
                        <input type="hidden" name="user_id" value={u.id} />
                        <input type="hidden" name="suspend" value="0" />
                        <p className="text-xs text-red-700">{t("admin.users.suspended")}: {u.suspended_reason}</p>
                        <SubmitButton className="btn-secondary">{t("admin.users.unsuspend")}</SubmitButton>
                      </ActionForm>
                    ) : (
                      <ActionForm action={setSuspension} className="flex gap-1 space-y-0">
                        <input type="hidden" name="user_id" value={u.id} />
                        <input type="hidden" name="suspend" value="1" />
                        <input name="reason" required className="input py-1" placeholder={t("admin.users.suspendReason")} />
                        <SubmitButton className="btn-danger py-1">{t("admin.users.suspend")}</SubmitButton>
                      </ActionForm>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
        <Pagination page={page} hasNext={count > page * PAGE} hrefFor={(p) => `/admin/users?${qs}&page=${p}`} labels={{ prev: t("common.previous"), next: t("common.next"), page: t("common.page", { page }) }} />
      </Card>
    </div>
  );
}

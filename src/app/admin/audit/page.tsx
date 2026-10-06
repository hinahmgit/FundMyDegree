import { getT } from "@/i18n/server";
import { getFormatter } from "@/lib/server-format";
import { db } from "@/lib/supabase/admin";
import { Card, PageHeader, Pagination, TableWrap } from "@/components/ui";
import type { AuditLog } from "@/types/db";

const PAGE = 100;

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ page?: string; action?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const [t, f] = await Promise.all([getT(), getFormatter()]);
  let q = db().from("audit_logs").select("*").order("created_at", { ascending: false }).range((page - 1) * PAGE, page * PAGE);
  if (sp.action) q = q.ilike("action", `${sp.action.replace(/[%_]/g, "")}%`);
  const { data } = await q;
  const rows = (data ?? []) as AuditLog[];
  const actorIds = [...new Set(rows.map((r) => r.actor_id).filter(Boolean))] as string[];
  const { data: actors } = actorIds.length ? await db().from("profiles").select("id, full_name").in("id", actorIds) : { data: [] };
  const names = new Map((actors ?? []).map((a) => [a.id, a.full_name]));
  return (
    <div>
      <PageHeader title={t("admin.audit.title")} />
      <form className="mb-4 flex gap-2"><input name="action" defaultValue={sp.action} className="input max-w-xs" placeholder="donation., grant., student." /><button className="btn-secondary">{t("common.filter")}</button></form>
      <Card>
        <TableWrap>
          <table className="data-table">
            <thead><tr><th>{t("common.date")}</th><th>{t("admin.audit.actor")}</th><th>{t("admin.audit.action")}</th><th>{t("admin.audit.entity")}</th><th>{t("common.details")}</th></tr></thead>
            <tbody>
              {rows.slice(0, PAGE).map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap">{f.dateTime(r.created_at)}</td>
                  <td>{names.get(r.actor_id ?? "") ?? "—"}</td>
                  <td className="font-mono text-xs">{r.action}</td>
                  <td className="font-mono text-xs">{r.entity_type}:{r.entity_id?.slice(0, 8)}</td>
                  <td><pre className="max-w-md overflow-x-auto text-xs whitespace-pre-wrap text-stone-600">{JSON.stringify(r.details)}</pre></td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
        <Pagination page={page} hasNext={rows.length > PAGE} hrefFor={(p) => `/admin/audit?page=${p}${sp.action ? `&action=${sp.action}` : ""}`} labels={{ prev: t("common.previous"), next: t("common.next"), page: t("common.page", { page }) }} />
      </Card>
    </div>
  );
}

import { requireAdmin } from "@/lib/auth";
import { getT } from "@/i18n/server";
import { AdminNav } from "./nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const t = await getT();
  const items = [
    ["/admin", t("admin.nav.overview")],
    ["/admin/students", t("admin.nav.students")],
    ["/admin/universities", t("admin.nav.universities")],
    ["/admin/proofs", t("admin.nav.proofs")],
    ["/admin/disbursements", t("admin.nav.disbursements")],
    ["/admin/results", t("admin.nav.results")],
    ["/admin/users", t("admin.nav.users")],
    ["/admin/transactions", t("admin.nav.transactions")],
    ["/admin/exchange-rates", t("admin.nav.rates")],
    ["/admin/settings", t("admin.nav.settings")],
    ["/admin/reports", t("admin.nav.reports")],
    ["/admin/audit", t("admin.nav.audit")],
  ] as [string, string][];
  return (
    <div className="grid gap-6 lg:grid-cols-[14rem_1fr]">
      <AdminNav items={items} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

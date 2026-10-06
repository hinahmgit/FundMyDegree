import Link from "next/link";
import { getT } from "@/i18n/server";
import { getFormatter } from "@/lib/server-format";
import { getAdminStats } from "@/lib/stats";
import { db } from "@/lib/supabase/admin";
import { Card, PageHeader, StatCard, TableWrap } from "@/components/ui";
import { AdminCharts } from "./charts";

async function queueCounts() {
  const count = (q: PromiseLike<{ count: number | null }>) => Promise.resolve(q).then((r) => r.count ?? 0);
  const [students, universities, proofs, disbursements, results, reports] = await Promise.all([
    count(db().from("student_profiles").select("user_id", { count: "exact", head: true }).eq("verification_status", "pending")),
    count(db().from("universities").select("id", { count: "exact", head: true }).eq("status", "pending")),
    count(db().from("donations").select("id", { count: "exact", head: true }).eq("method", "direct").eq("status", "pending").not("proof_submitted_at", "is", null)),
    count(db().from("grants").select("id", { count: "exact", head: true }).eq("status", "funded")),
    count(db().from("term_results").select("id", { count: "exact", head: true }).eq("status", "pending")),
    count(db().from("message_reports").select("id", { count: "exact", head: true }).eq("status", "open")),
  ]);
  return { students, universities, proofs, disbursements, results, reports };
}

export default async function AdminOverview() {
  const [t, f, stats, queues] = await Promise.all([getT(), getFormatter(), getAdminStats(), queueCounts()]);
  const s = stats.totals;
  const usd = (v: number) => f.money(v, "USD");
  const queueLinks: [string, string, number][] = [
    ["/admin/students", t("admin.nav.students"), queues.students],
    ["/admin/universities", t("admin.nav.universities"), queues.universities],
    ["/admin/proofs", t("admin.nav.proofs"), queues.proofs],
    ["/admin/disbursements", t("admin.nav.disbursements"), queues.disbursements],
    ["/admin/results", t("admin.nav.results"), queues.results],
    ["/admin/reports", t("admin.nav.reports"), queues.reports],
  ];
  return (
    <div className="space-y-6">
      <PageHeader title={t("admin.nav.overview")} subtitle={t("admin.stats.inUsd")} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {queueLinks.map(([href, label, n]) => (
          <Link key={href} href={href} className={`rounded-xl border p-3 text-sm transition hover:shadow ${n ? "border-brand-200 bg-brand-50" : "border-stone-200 bg-white"}`}>
            <div className="text-2xl font-semibold">{n}</div>
            <div className="text-stone-600">{label}</div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("admin.stats.totalDonated")} value={usd(s.donated)} sub={`${t("admin.stats.platform")} ${usd(s.platform)} · ${t("admin.stats.direct")} ${usd(s.direct)}`} />
        <StatCard label={t("admin.stats.paidToUniversities")} value={usd(s.paidToUniversities)} />
        <StatCard label={t("admin.stats.held")} value={usd(s.held)} />
        <StatCard label={t("admin.stats.pendingProofs")} value={s.pendingProofs} />
        <StatCard label={t("admin.stats.studentsFunded")} value={s.studentsFunded} />
        <StatCard label={t("admin.stats.activeStudents")} value={s.activeStudents} sub={`${t("admin.stats.graduated")}: ${s.graduated}`} />
        <StatCard label={t("admin.stats.donors")} value={s.donors} sub={t("admin.stats.registeredDonors", { count: s.registeredDonors })} />
        <StatCard label={t("admin.stats.countries")} value={s.countries} />
      </div>

      <Card title={t("admin.stats.currencyBreakdown")}>
        <TableWrap>
          <table className="data-table">
            <thead><tr><th>{t("common.currency")}</th><th>{t("donorDash.original")}</th><th>USD</th><th>#</th></tr></thead>
            <tbody>
              {stats.byCurrency.map((c) => (
                <tr key={c.currency}><td>{c.currency}</td><td>{f.money(c.original, c.currency)}</td><td>{usd(c.usd)}</td><td>{c.count}</td></tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Card>

      <AdminCharts charts={stats.charts} />
    </div>
  );
}

import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getT } from "@/i18n/server";
import { getFormatter } from "@/lib/server-format";
import { getDonorData } from "@/lib/donors";
import { avatarUrl } from "@/lib/files";
import { countryName } from "@/lib/format";
import { convert } from "@/lib/fx/convert";
import { Alert, Avatar, Badge, Card, EmptyState, PageHeader, StatCard, TableWrap } from "@/components/ui";
import { DonationStatusBadge } from "@/components/status";
import { Countdown } from "@/components/countdown";
import { ActionForm, SubmitButton } from "@/components/forms";
import { renewSupport } from "@/actions/donations";

export default async function DonorDashboard({ searchParams }: { searchParams: Promise<{ renewed?: string }> }) {
  const user = await requireRole("donor");
  const { renewed } = await searchParams;
  const [t, f, data] = await Promise.all([getT(), getFormatter(), getDonorData(user.id)]);
  const given = data.donations.filter((d) => d.status === "confirmed" || d.status === "disbursed");
  const total = given.reduce((sum, d) => sum + (convert(Number(d.original_amount), d.original_currency, f.currency, f.rates) ?? 0), 0);
  const pledges = data.donations.filter((d) => d.method === "direct" && d.status === "pending");
  const sponsoredIds = [...new Set(given.map((d) => d.student_id))];
  const renewals = sponsoredIds
    .map((sid) => ({ sid, grant: data.openGrantByStudent.get(sid), last: given.find((d) => d.student_id === sid)! }))
    .filter((r) => r.grant && !data.donations.some((d) => d.grant_id === r.grant!.id && ["pending", "confirmed", "disbursed"].includes(d.status)));

  return (
    <div className="space-y-6">
      <PageHeader title={t("donorDash.title")} actions={<Link href="/students" className="btn-primary">{t("donorDash.browse")}</Link>} />

      {renewed && <Alert tone="success">{t("donate.renewed")}</Alert>}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={t("donorDash.totalGiven")} value={f.money(total, f.currency)} sub={t("donorDash.totalGivenHint", { currency: f.currency })} />
        <StatCard label={t("donorDash.sponsored")} value={sponsoredIds.length} />
        <StatCard label={t("donorDash.pendingPledges")} value={pledges.length} />
      </div>

      {renewals.length > 0 && (
        <Card title={t("donorDash.renewals")}>
          <ul className="space-y-3">
            {renewals.map(({ sid, grant, last }) => {
              const s = data.students.get(sid);
              return (
                <li key={sid} className="flex flex-col gap-2 rounded-xl bg-brand-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm">{t("donate.renewBody", { name: s?.profile.full_name ?? "" })} <span className="text-stone-500">({grant!.term_label})</span></p>
                  <ActionForm action={renewSupport} className="space-y-2">
                    <input type="hidden" name="donation_id" value={last.id} />
                    <input type="hidden" name="grant_id" value={grant!.id} />
                    <SubmitButton>{t("donate.renewButton", { amount: f.money(Number(last.original_amount), last.original_currency) })}</SubmitButton>
                  </ActionForm>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Card title={t("donorDash.pendingPledges")}>
        {pledges.length ? (
          <ul className="divide-y divide-stone-100">
            {pledges.map((d) => {
              const s = data.students.get(d.student_id);
              return (
                <li key={d.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-medium">{s?.profile.full_name} · {f.money(Number(d.grant_amount), data.grants.get(d.grant_id)?.currency ?? d.original_currency)}</div>
                    <div className="text-sm">
                      {d.proof_submitted_at ? t("pledge.alreadySubmitted", { date: f.date(d.proof_submitted_at) }) : d.pledge_expires_at && <Countdown to={d.pledge_expires_at} />}
                    </div>
                  </div>
                  <Link href={`/donor/pledges/${d.id}`} className={d.proof_submitted_at ? "btn-secondary" : "btn-primary"}>
                    {d.proof_submitted_at ? t("common.view") : t("pledge.uploadProof")}
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState>{t("donorDash.noPledges")}</EmptyState>
        )}
      </Card>

      <Card title={t("donorDash.sponsored")}>
        {sponsoredIds.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {sponsoredIds.map((sid) => {
              const s = data.students.get(sid);
              if (!s) return null;
              const uni = s.student.university_id ? data.universities.get(s.student.university_id) : undefined;
              const result = data.latestResult.get(sid);
              const update = data.latestUpdate.get(sid);
              return (
                <div key={sid} className="rounded-xl border border-stone-200 p-4">
                  <div className="flex items-center gap-3">
                    <Avatar src={avatarUrl(s.student.photo_path ?? s.profile.avatar_path)} name={s.profile.full_name} />
                    <div className="min-w-0">
                      <Link href={`/students/${sid}`} className="font-semibold hover:text-brand-700">{s.profile.full_name}</Link>
                      <p className="truncate text-sm text-stone-600">{uni?.name} · {countryName(uni?.country_code, f.locale)}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Badge tone="brand">{t("donorDash.degreeProgress", { x: s.student.current_term, y: s.student.total_terms })}</Badge>
                    {s.student.status !== "active" && <Badge tone="trust">{t(`status.student.${s.student.status}`)}</Badge>}
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-200">
                    <div className="h-full bg-trust-500" style={{ width: `${Math.min(100, ((s.student.current_term - (s.student.status === "graduated" ? 0 : 1)) / s.student.total_terms) * 100)}%` }} />
                  </div>
                  {result && (
                    <p className="mt-3 text-sm">
                      <span className="text-stone-500">{t("donorDash.latestResult")}: </span>
                      {result.gpa !== null ? (result.gpa_scale ? t("student.gpaOf", { gpa: result.gpa, scale: result.gpa_scale }) : t("student.gpa", { gpa: result.gpa })) : "✓"}
                    </p>
                  )}
                  {update && (
                    <p className="mt-2 line-clamp-3 text-sm text-stone-600">
                      <span className="text-stone-500">{t("donorDash.latestUpdate")} ({f.date(update.created_at)}): </span>
                      {update.body}
                    </p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <Link href={`/messages?with=${sid}`} className="btn-secondary">{t("donorDash.message")}</Link>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState action={<Link href="/students" className="btn-primary">{t("donorDash.browse")}</Link>}>{t("donorDash.noSponsored")}</EmptyState>
        )}
      </Card>

      <Card title={t("donorDash.history")}>
        {data.donations.length ? (
          <TableWrap>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("common.date")}</th>
                  <th>{t("receipt.student")}</th>
                  <th>{t("donorDash.method")}</th>
                  <th>{t("donorDash.original")}</th>
                  <th>{t("common.status")}</th>
                  <th>{t("donorDash.receipt")}</th>
                </tr>
              </thead>
              <tbody>
                {data.donations.map((d) => (
                  <tr key={d.id}>
                    <td className="whitespace-nowrap">{f.date(d.created_at)}</td>
                    <td>{data.students.get(d.student_id)?.profile.full_name}{d.anonymous && <span className="ml-1 text-xs text-stone-500">({t("common.anonymous")})</span>}</td>
                    <td>{t(`methods.${d.method}`)}</td>
                    <td className="whitespace-nowrap">{f.money(Number(d.original_amount), d.original_currency)}</td>
                    <td><DonationStatusBadge donation={d} t={t} /></td>
                    <td>{["confirmed", "disbursed"].includes(d.status) ? <Link className="link" href={`/donor/receipts/${d.id}`}>{t("common.download")}</Link> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        ) : (
          <EmptyState>{t("common.noResults")}</EmptyState>
        )}
      </Card>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { getT } from "@/i18n/server";
import { getCurrentUser } from "@/lib/auth";
import { getFormatter } from "@/lib/server-format";
import { getStudentOverview } from "@/lib/students";
import { avatarUrl, documentHref } from "@/lib/files";
import { countryName } from "@/lib/format";
import { Avatar, Badge, Card, EmptyState } from "@/components/ui";
import { GrantProgress } from "@/components/grant-progress";
import { GrantStatusBadge } from "@/components/status";

export default async function StudentPublicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [t, f, viewer, o] = await Promise.all([getT(), getFormatter(), getCurrentUser(), getStudentOverview(id)]);
  if (!o) notFound();
  const isOwner = viewer?.id === id;
  const isAdmin = viewer?.profile.role === "admin";
  const visible = o.student.verification_status === "verified" && !o.profile.suspended_at && !o.profile.deleted_at;
  if (!visible && !isOwner && !isAdmin) notFound();

  const isSupporter = !!viewer && o.supporters.some((s) => s.donorId === viewer.id && ["confirmed", "disbursed"].includes(s.status));
  const showPrivate = isOwner || isAdmin || isSupporter;
  const current = o.currentGrant;
  const canGive = current?.status === "open" && current.progress.remaining > 0 && !isOwner;
  const supporters = o.supporters.filter((s) => s.status !== "pending");

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-6">
        <Card>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Avatar src={avatarUrl(o.student.photo_path ?? o.profile.avatar_path)} name={o.profile.full_name} size={88} />
            <div>
              <h1 className="font-display text-2xl font-semibold">{o.profile.full_name}</h1>
              <p className="text-stone-600">{o.student.program_name} · {o.university?.name}</p>
              <p className="text-sm text-stone-500">{countryName(o.university?.country_code, f.locale)}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {visible && <Badge tone="trust">✓ {t("student.verifiedBadge")}</Badge>}
                {o.student.degree_level && <Badge tone="brand">{t(`degree.${o.student.degree_level}`)}</Badge>}
                {o.student.field_of_study && <Badge>{o.student.field_of_study}</Badge>}
                <Badge>{t("common.termXofY", { x: o.student.current_term, y: o.student.total_terms })}</Badge>
              </div>
            </div>
          </div>
        </Card>

        <Card title={t("student.about")}>
          <p className="whitespace-pre-line text-stone-700">{o.student.story}</p>
        </Card>

        <Card title={t("student.studies")}>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-stone-500">{t("student.program")}</dt><dd className="font-medium">{o.student.program_name}</dd></div>
            <div><dt className="text-stone-500">{t("student.expectedGraduation")}</dt><dd className="font-medium">{o.student.expected_graduation ? f.date(o.student.expected_graduation) : "—"}</dd></div>
            {o.student.total_degree_cost !== null && o.university && (
              <div><dt className="text-stone-500">{t("student.totalCost")}</dt><dd className="font-medium">{f.money(o.student.total_degree_cost, o.university.fee_currency)}</dd></div>
            )}
          </dl>
          {o.fees.length > 0 && o.university && (
            <>
              <h3 className="mt-5 mb-2 text-sm font-semibold">{t("student.feeBreakdown")}</h3>
              <ul className="divide-y divide-stone-100 text-sm">
                {o.fees.map((fee) => (
                  <li key={fee.id} className="flex justify-between py-1.5">
                    <span>{fee.label || t(`terms.${o.student.term_kind}`, { n: fee.term_number })}</span>
                    <span className="font-medium">{f.money(fee.amount, o.university!.fee_currency)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>

        <Card title={t("student.pastGrants")}>
          {o.grants.length ? (
            <ul className="space-y-4">
              {o.grants.map((g) => {
                const receipt = o.disbursements.find((d) => d.grant_id === g.id && d.receipt_document_id);
                const result = o.results.find((r) => r.grant_id === g.id);
                return (
                  <li key={g.id} className="rounded-xl border border-stone-100 p-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{g.term_label}</span>
                      <GrantStatusBadge status={g.status} t={t} />
                    </div>
                    <GrantProgress progress={g.progress} t={t} f={f} compact />
                    <div className="mt-2 flex flex-wrap gap-4 text-xs">
                      {receipt && showPrivate && <a className="link" href={documentHref(receipt.receipt_document_id)!} target="_blank" rel="noreferrer">{t("student.universityReceipt")}</a>}
                      {result && showPrivate && result.gpa !== null && <span>{result.gpa_scale ? t("student.gpaOf", { gpa: result.gpa, scale: result.gpa_scale }) : t("student.gpa", { gpa: result.gpa })}</span>}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState>{t("common.noResults")}</EmptyState>
          )}
        </Card>

        {showPrivate && (
          <Card title={t("student.updates")}>
            {o.updates.length ? (
              <ul className="space-y-4">
                {o.updates.map((u) => (
                  <li key={u.id}>
                    <div className="text-xs text-stone-500">{f.dateTime(u.created_at)}</div>
                    <p className="whitespace-pre-line text-sm">{u.body}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState>{t("common.noResults")}</EmptyState>
            )}
          </Card>
        )}
      </div>

      <aside className="space-y-6 lg:sticky lg:top-24 lg:h-fit">
        <Card title={t("student.currentGrant")} actions={current && <GrantStatusBadge status={current.status} t={t} />}>
          {current ? (
            <div className="space-y-3">
              <p className="text-sm font-medium">{current.term_label}</p>
              <GrantProgress progress={current.progress} t={t} f={f} />
              {current.payment_deadline && <p className="text-xs text-stone-500">{t("common.dueOn", { date: f.date(current.payment_deadline) })}</p>}
              {canGive && (
                <Link href={`/donate/${current.id}`} className="btn-primary w-full py-3 text-base">{t("student.donateCta")}</Link>
              )}
            </div>
          ) : (
            <EmptyState>{t("listing.noOpenGrant")}</EmptyState>
          )}
        </Card>
        <Card title={t("student.donors")}>
          {supporters.length ? (
            <ul className="space-y-2 text-sm">
              {supporters.slice(0, 15).map((s) => (
                <li key={s.donationId} className="flex justify-between gap-2">
                  <span>{s.anonymous ? t("common.anonymous") : s.name}{!s.anonymous && s.countryCode && <span className="text-stone-500"> · {countryName(s.countryCode, f.locale)}</span>}</span>
                  <span className="text-stone-500">{f.date(s.createdAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>{t("studentDash.noDonors")}</EmptyState>
          )}
        </Card>
      </aside>
    </div>
  );
}

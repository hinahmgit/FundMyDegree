import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getT } from "@/i18n/server";
import { db } from "@/lib/supabase/admin";
import { getFormatter } from "@/lib/server-format";
import { documentHref } from "@/lib/files";
import { getPricedCurrencies } from "@/lib/reference";
import { Alert, Card, PageHeader } from "@/components/ui";
import { DonationStatusBadge } from "@/components/status";
import { Countdown } from "@/components/countdown";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/forms";
import { cancelPledge, submitPaymentProof } from "@/actions/donations";
import type { Donation, Grant, StudentProfile, University } from "@/types/db";

export default async function PledgePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string }> }) {
  const user = await requireRole("donor");
  const [{ id }, sp, t, f, currencies] = await Promise.all([params, searchParams, getT(), getFormatter(), getPricedCurrencies()]);
  const { data: d } = await db().from("donations").select("*").eq("id", id).eq("donor_id", user.id).maybeSingle<Donation>();
  if (!d || d.method !== "direct") notFound();
  const [{ data: grant }, { data: student }, { data: profile }] = await Promise.all([
    db().from("grants").select("*").eq("id", d.grant_id).single<Grant>(),
    db().from("student_profiles").select("*").eq("user_id", d.student_id).single<StudentProfile>(),
    db().from("profiles").select("full_name").eq("id", d.student_id).single(),
  ]);
  if (!grant || !student) notFound();
  const { data: uni } = await db().from("universities").select("*").eq("id", grant.university_id).single<University>();
  const live = d.status === "pending" && !d.proof_submitted_at && d.pledge_expires_at && new Date(d.pledge_expires_at) > new Date();
  const reference = [student.student_number, grant.invoice_number, profile?.full_name].filter(Boolean).join(" / ");

  const row = (label: string, value: string | null | undefined, mono = false) =>
    value ? (
      <div className="grid grid-cols-[9rem_1fr] gap-2 py-1.5 text-sm">
        <dt className="text-stone-500">{label}</dt>
        <dd className={mono ? "font-mono break-all" : "break-words"}>{value}</dd>
      </div>
    ) : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={`${profile?.full_name} · ${f.money(Number(d.grant_amount), grant.currency)}`}
        subtitle={`${grant.term_label} · ${uni?.name}`}
        actions={<DonationStatusBadge donation={d} t={t} />}
      />
      {sp.new && live && (
        <Alert tone="success">
          <strong>{t("pledge.createdTitle")}.</strong> {t("pledge.createdBody", { date: f.dateTime(d.pledge_expires_at!) })}
        </Alert>
      )}
      {d.status === "rejected" && <Alert tone="danger">{t("notifications.proof_rejected.body", { amount: f.money(Number(d.grant_amount), grant.currency), student: profile?.full_name ?? "", reason: d.rejection_reason ?? "" })}</Alert>}
      {d.status === "expired" && <Alert tone="warn">{t("pledge.expired")}</Alert>}

      {live && <p className="text-center text-lg"><Countdown to={d.pledge_expires_at!} /></p>}

      <Card title={t("pledge.paymentDetails")}>
        <dl className="divide-y divide-stone-100">
          {row(t("pledge.bankName"), uni?.bank_name)}
          {row(t("pledge.accountName"), uni?.bank_account_name)}
          {row(t("pledge.accountNumber"), uni?.bank_account_number, true)}
          {row(t("pledge.iban"), uni?.iban, true)}
          {row(t("pledge.swift"), uni?.swift_bic, true)}
          {row(t("pledge.bankAddress"), uni?.bank_address)}
          {row(t("common.amount"), f.money(Number(d.grant_amount), grant.currency))}
        </dl>
        {uni?.payment_portal_url && (
          <a href={uni.payment_portal_url} target="_blank" rel="noreferrer noopener" className="btn-secondary mt-3">{t("pledge.portal")} ↗</a>
        )}
        <div className="mt-4 rounded-xl bg-brand-50 p-4">
          <div className="text-sm font-semibold text-brand-800">{t("pledge.reference")}</div>
          <div className="mt-1 font-mono text-lg break-all">{reference}</div>
          <p className="mt-1 text-xs text-brand-800">{t("pledge.referenceHint")}</p>
        </div>
        {uni?.payment_reference_instructions && (
          <p className="mt-3 text-sm whitespace-pre-line text-stone-600"><strong>{t("pledge.instructions")}:</strong> {uni.payment_reference_instructions}</p>
        )}
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          {grant.invoice_document_id && <a className="link" href={documentHref(grant.invoice_document_id)!} target="_blank" rel="noreferrer">{t("pledge.invoice")}</a>}
          {uni?.finance_contact_email && <span className="text-stone-600">{t("pledge.financeContact")}: {uni.finance_contact_name} &lt;{uni.finance_contact_email}&gt; {uni.finance_contact_phone}</span>}
        </div>
      </Card>

      {d.proof_submitted_at ? (
        <Alert>{t("pledge.alreadySubmitted", { date: f.dateTime(d.proof_submitted_at) })}</Alert>
      ) : live ? (
        <Card title={t("pledge.proofTitle")}>
          <p className="mb-4 text-sm text-stone-600">{t("pledge.proofBody")}</p>
          <ActionForm action={submitPaymentProof}>
            <input type="hidden" name="donation_id" value={d.id} />
            <div>
              <label className="label" htmlFor="file">{t("pledge.proofFile")}</label>
              <input id="file" name="file" type="file" required accept="application/pdf,image/jpeg,image/png,image/webp" className="text-sm" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="reference">{t("pledge.proofReference")}</label>
                <input id="reference" name="reference" required className="input" />
              </div>
              <div>
                <label className="label" htmlFor="date">{t("pledge.proofDate")}</label>
                <input id="date" name="date" type="date" required className="input" />
              </div>
              <div>
                <label className="label" htmlFor="amount">{t("pledge.proofAmount")}</label>
                <input id="amount" name="amount" type="number" step="0.01" min="0.01" required className="input" defaultValue={Number(d.grant_amount)} />
              </div>
              <div>
                <label className="label" htmlFor="currency">{t("pledge.proofCurrency")}</label>
                <select id="currency" name="currency" className="input" defaultValue={grant.currency}>
                  {currencies.map((c) => <option key={c.code}>{c.code}</option>)}
                </select>
              </div>
            </div>
            <SubmitButton>{t("pledge.uploadProof")}</SubmitButton>
          </ActionForm>
          <form action={cancelPledge} className="mt-4 border-t border-stone-100 pt-4">
            <input type="hidden" name="donation_id" value={d.id} />
            <ConfirmButton message={t("common.confirm")} className="btn-ghost text-red-600">{t("common.cancel")}</ConfirmButton>
          </form>
        </Card>
      ) : null}
      <Link href="/donor" className="btn-ghost">← {t("nav.dashboard")}</Link>
    </div>
  );
}

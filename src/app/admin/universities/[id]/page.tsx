import { notFound } from "next/navigation";
import { getT } from "@/i18n/server";
import { db } from "@/lib/supabase/admin";
import { getCountries, getCurrencies } from "@/lib/reference";
import { Card, PageHeader } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/forms";
import { UniversityBadge } from "@/components/status";
import { saveUniversity } from "@/actions/admin";
import type { University } from "@/types/db";

export default async function EditUniversity({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [t, countries, currencies] = await Promise.all([getT(), getCountries(), getCurrencies()]);
  let u: Partial<University> = {};
  if (id !== "new") {
    const { data } = await db().from("universities").select("*").eq("id", id).maybeSingle<University>();
    if (!data) notFound();
    u = data;
  }
  const input = (name: keyof University, label: string, type = "text", required = false) => (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input id={name} name={name} type={type} required={required} className="input" defaultValue={(u[name] as string | undefined) ?? ""} />
    </div>
  );
  return (
    <div>
      <PageHeader title={u.name ?? t("admin.universities.add")} actions={u.status && <UniversityBadge status={u.status} t={t} />} />
      <ActionForm action={saveUniversity} className="space-y-6">
        <input type="hidden" name="id" value={u.id ?? ""} />
        <Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">{input("name", t("studentProfile.universityName"), "text", true)}</div>
            <div>
              <label className="label" htmlFor="country_code">{t("common.country")}</label>
              <select id="country_code" name="country_code" className="input" defaultValue={u.country_code ?? ""} required>
                <option value="" disabled>—</option>
                {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="fee_currency">{t("studentProfile.universityCurrency")}</label>
              <select id="fee_currency" name="fee_currency" className="input" defaultValue={u.fee_currency ?? "USD"}>
                {currencies.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
              </select>
            </div>
            {input("city", t("studentProfile.universityCity"))}
            {input("website", t("studentProfile.universityWebsite"), "url")}
          </div>
        </Card>
        <Card title={t("admin.universities.accreditation")}>
          <div className="grid gap-4 sm:grid-cols-2">
            {input("accreditation_body", t("admin.universities.accreditationBody"))}
            {input("accreditation_reference", t("admin.universities.accreditationRef"))}
          </div>
        </Card>
        <Card title={t("admin.universities.paymentDetails")}>
          <div className="grid gap-4 sm:grid-cols-2">
            {input("bank_name", t("pledge.bankName"))}
            {input("bank_account_name", t("pledge.accountName"))}
            {input("bank_account_number", t("pledge.accountNumber"))}
            {input("iban", t("pledge.iban"))}
            {input("swift_bic", t("pledge.swift"))}
            {input("bank_address", t("pledge.bankAddress"))}
            <div className="sm:col-span-2">{input("payment_portal_url", t("pledge.portal"), "url")}</div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="payment_reference_instructions">{t("admin.universities.referenceInstructions")}</label>
              <textarea id="payment_reference_instructions" name="payment_reference_instructions" rows={3} className="input" defaultValue={u.payment_reference_instructions ?? ""} />
            </div>
          </div>
        </Card>
        <Card title={t("admin.universities.financeContact")}>
          <div className="grid gap-4 sm:grid-cols-3">
            {input("finance_contact_name", t("admin.universities.contactName"))}
            {input("finance_contact_email", t("admin.universities.contactEmail"), "email")}
            {input("finance_contact_phone", t("admin.universities.contactPhone"))}
          </div>
        </Card>
        <SubmitButton>{t("common.save")}</SubmitButton>
      </ActionForm>
    </div>
  );
}

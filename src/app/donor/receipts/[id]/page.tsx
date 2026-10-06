import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getT } from "@/i18n/server";
import { db } from "@/lib/supabase/admin";
import { getFormatter } from "@/lib/server-format";
import { PrintButton } from "@/components/print-button";
import type { Donation, Grant } from "@/types/db";

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole("donor");
  const [{ id }, t, f] = await Promise.all([params, getT(), getFormatter()]);
  const { data: d } = await db().from("donations").select("*").eq("id", id).eq("donor_id", user.id).maybeSingle<Donation>();
  if (!d || !["confirmed", "disbursed", "refunded"].includes(d.status)) notFound();
  const { data: grant } = await db().from("grants").select("*").eq("id", d.grant_id).single<Grant>();
  const [{ data: student }, { data: uni }] = await Promise.all([
    db().from("profiles").select("full_name").eq("id", d.student_id).single(),
    db().from("universities").select("name").eq("id", grant!.university_id).single(),
  ]);
  const rows: [string, string][] = [
    [t("receipt.number"), d.id.slice(0, 8).toUpperCase()],
    [t("common.date"), f.dateTime(d.reviewed_at ?? d.created_at)],
    [t("receipt.donor"), `${user.profile.full_name}${d.anonymous ? ` (${t("common.anonymous")})` : ""}`],
    [t("receipt.student"), student?.full_name ?? ""],
    [t("receipt.university"), uni?.name ?? ""],
    [t("receipt.term"), grant?.term_label ?? ""],
    [t("receipt.method"), t(`methods.${d.method}`)],
    [t("receipt.amountOriginal"), f.money(Number(d.original_amount), d.original_currency)],
    [t("receipt.rate"), `1 ${d.original_currency} = ${Number(d.exchange_rate).toPrecision(6)} ${grant?.currency}`],
    [t("receipt.amountGrant"), f.money(Number(d.confirmed_amount ?? d.grant_amount), grant?.currency ?? d.original_currency)],
    [t("receipt.status"), t(`status.donation.${d.status}`)],
  ];
  return (
    <div className="mx-auto max-w-xl">
      <div className="card print:border-0 print:shadow-none">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <div className="font-display text-xl font-bold text-brand-700">{t("common.appName")}</div>
            <h1 className="text-lg font-semibold">{t("receipt.title")}</h1>
          </div>
          <PrintButton label={t("receipt.print")} />
        </div>
        <dl className="divide-y divide-stone-100">
          {rows.map(([k, v]) => (
            <div key={k} className="grid grid-cols-2 gap-2 py-2 text-sm">
              <dt className="text-stone-500">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-6 text-xs text-stone-500">{t("receipt.note")}</p>
      </div>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { getT } from "@/i18n/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/supabase/admin";
import { getFormatter } from "@/lib/server-format";
import { getGrantWithProgress } from "@/lib/grants";
import { getPricedCurrencies } from "@/lib/reference";
import { getSettings } from "@/lib/settings";
import { getPaymentProvider, isTestMode } from "@/lib/payments";
import { Alert, Card, PageHeader } from "@/components/ui";
import { GrantProgress } from "@/components/grant-progress";
import { DonateForms } from "./donate-forms";

export default async function DonatePage({ params, searchParams }: { params: Promise<{ grantId: string }>; searchParams: Promise<{ amount?: string; currency?: string }> }) {
  const user = await requireUser();
  const [{ grantId }, sp, t, f, settings, currencies] = await Promise.all([params, searchParams, getT(), getFormatter(), getSettings(), getPricedCurrencies()]);
  const gp = await getGrantWithProgress(grantId);
  if (!gp) notFound();
  const { grant, progress } = gp;
  const [{ data: student }, { data: university }, { data: saved }] = await Promise.all([
    db().from("profiles").select("full_name").eq("id", grant.student_id).single(),
    db().from("universities").select("name").eq("id", grant.university_id).single(),
    db().from("saved_payment_methods").select("id, brand, last4").eq("user_id", user.id).eq("provider", getPaymentProvider().name).order("created_at", { ascending: false }),
  ]);

  const blocked =
    user.profile.role !== "donor" ? t("donate.donorsOnly") : grant.status !== "open" || progress.remaining <= 0 ? t("donate.grantClosed") : null;

  const provider = getPaymentProvider();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={t("donate.title", { name: student?.full_name ?? "" })}
        subtitle={t("donate.grantFor", { term: grant.term_label ?? String(grant.term_number), university: university?.name ?? "" })}
        actions={<Link href={`/students/${grant.student_id}`} className="btn-ghost">← {t("common.back")}</Link>}
      />
      <Card>
        <GrantProgress progress={progress} t={t} f={f} />
      </Card>
      {blocked ? (
        <Alert tone="warn">{blocked}</Alert>
      ) : (
        <DonateForms
          grant={{ id: grant.id, currency: grant.currency, remaining: progress.remaining }}
          rates={f.rates}
          tolerancePct={settings.overfundTolerancePct}
          holdDays={settings.pledgeHoldDays}
          defaultCurrency={sp.currency ?? user.profile.preferred_currency}
          defaultAmount={sp.amount}
          currencies={currencies.filter((c) => provider.supportsCurrency(c.code)).map((c) => c.code)}
          savedMethods={(saved ?? []).map((s) => ({ id: s.id as string, last4: (s.last4 as string) ?? "" }))}
          testMode={isTestMode()}
          studentId={grant.student_id}
        />
      )}
    </div>
  );
}

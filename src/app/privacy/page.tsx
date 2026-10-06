import { getT } from "@/i18n/server";
import { PageHeader } from "@/components/ui";

// Placeholder policy outline; replace with text reviewed by counsel before launch.
export default async function PrivacyPage() {
  const t = await getT();
  return (
    <article className="card mx-auto max-w-3xl space-y-4 text-sm leading-relaxed text-stone-700">
      <PageHeader title={t("legal.privacyTitle")} />
      <p>FundMyDegree collects the information needed to verify students, process donations and pay universities: your name, email, country, preferences, and—for students—identity, enrollment and tuition documents. Donors may upload payment proofs.</p>
      <p>Identity documents and payment proofs are visible only to you and our verification team. University receipts are shared with the student and their donors. Anonymous donors are never named to students.</p>
      <p>We rely on your consent and on our contract with you. You can download all your data or delete your account at any time from Settings. Financial records are retained in anonymised form where the law requires.</p>
      <p>Contact: privacy@fundmydegree.org</p>
    </article>
  );
}

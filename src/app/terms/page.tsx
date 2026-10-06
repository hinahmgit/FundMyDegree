import { getT } from "@/i18n/server";
import { PageHeader } from "@/components/ui";

// Placeholder terms outline; replace with text reviewed by counsel before launch.
export default async function TermsPage() {
  const t = await getT();
  return (
    <article className="card mx-auto max-w-3xl space-y-4 text-sm leading-relaxed text-stone-700">
      <PageHeader title={t("legal.termsTitle")} />
      <p>Donations are made to fund tuition at accredited universities. Funds are never paid to students. Platform donations are held until a term is fully funded and then paid to the university.</p>
      <p>Direct payments are made by donors to the university and count toward a grant only once an administrator confirms them. Pledges expire if proof is not provided in time.</p>
      <p>Students must provide truthful information and documents. Accounts that misuse the platform may be suspended. If a student withdraws, platform-held funds may be refunded or reassigned to another student.</p>
    </article>
  );
}

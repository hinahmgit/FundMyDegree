import Link from "next/link";
import { getT } from "@/i18n/server";
import { getFormatter } from "@/lib/server-format";
import { getStudentCards } from "@/lib/listing";
import { StudentCard } from "@/components/student-card";

export default async function Home() {
  const t = await getT();
  let featured: Awaited<ReturnType<typeof getStudentCards>> = [];
  let f: Awaited<ReturnType<typeof getFormatter>> | null = null;
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    [featured, f] = await Promise.all([getStudentCards({ sort: "closest" }).then((c) => c.filter((s) => s.grant).slice(0, 3)), getFormatter()]);
  }
  const trust = [
    { title: t("home.trust1Title"), body: t("home.trust1Body"), icon: "M9 12l2 2 4-4m5.6-4A12 12 0 0 1 12 2.9 12 12 0 0 1 3.4 6 12 12 0 0 0 12 21a12 12 0 0 0 8.6-15z" },
    { title: t("home.trust2Title"), body: t("home.trust2Body"), icon: "M3 21h18M5 21V10m14 11V10M12 3 2 9h20zM9 21v-7m6 7v-7" },
    { title: t("home.trust3Title"), body: t("home.trust3Body"), icon: "M3 3v18h18M7 15l4-4 3 3 5-6" },
  ];
  return (
    <div className="space-y-16">
      <section className="grid items-center gap-10 pt-4 lg:grid-cols-2">
        <div>
          <h1 className="font-display text-4xl leading-tight font-bold sm:text-5xl">{t("home.heroTitle")}</h1>
          <p className="mt-4 text-lg text-stone-600">{t("home.heroBody")}</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link href="/students" className="btn-primary px-6 py-3 text-base">{t("home.ctaDonor")}</Link>
            <Link href="/signup?role=student" className="btn-secondary px-6 py-3 text-base">{t("home.ctaStudent")}</Link>
          </div>
        </div>
        <div className="relative rounded-3xl bg-gradient-to-br from-brand-100 via-brand-50 to-trust-50 p-8">
          <ol className="space-y-4">
            {[t("home.step1"), t("home.step2"), t("home.step3"), t("home.step4"), t("home.step5")].map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white font-semibold text-brand-700 shadow-sm">{i + 1}</span>
                <span className="pt-1 text-stone-700">{s}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {trust.map((x) => (
          <div key={x.title} className="card">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-trust-600)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={x.icon} /></svg>
            <h2 className="mt-3 font-semibold">{x.title}</h2>
            <p className="mt-1 text-sm text-stone-600">{x.body}</p>
          </div>
        ))}
      </section>

      {f && featured.length > 0 && (
        <section id="featured">
          <div className="mb-4 flex items-end justify-between">
            <h2 className="font-display text-2xl font-semibold">{t("home.featured")}</h2>
            <Link href="/students" className="link text-sm">{t("home.seeAll")}</Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((s) => <StudentCard key={s.id} s={s} t={t} f={f} />)}
          </div>
        </section>
      )}

      <section id="how" className="card">
        <h2 className="font-display text-2xl font-semibold">{t("home.howTitle")}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-5">
          {[t("home.step1"), t("home.step2"), t("home.step3"), t("home.step4"), t("home.step5")].map((s, i) => (
            <div key={i} className="rounded-xl bg-stone-50 p-4 text-sm">
              <div className="mb-1 font-display text-2xl text-brand-600">{i + 1}</div>
              {s}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

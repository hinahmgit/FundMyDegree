import Link from "next/link";
import { getT } from "@/i18n/server";
import { LogoMark } from "@/components/logo";

export async function Footer() {
  const t = await getT();
  const cols = [
    { title: t("footer.platform"), links: [["/students", t("nav.students")], ["/#how", t("nav.howItWorks")], ["/signup?role=student", t("footer.forStudents")], ["/signup", t("footer.forDonors")]] },
    { title: t("footer.company"), links: [["/#faq", t("footer.faq")], ["mailto:hello@fundmydegree.org", t("footer.contact")]] },
    { title: t("footer.legal"), links: [["/privacy", t("footer.privacy")], ["/terms", t("footer.terms")]] },
  ];
  return (
    <footer className="border-t border-stone-200 bg-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
        <div>
          <Link href="/" className="flex items-center gap-2.5 font-display text-lg font-bold text-stone-900">
            <LogoMark size={30} />
            <span>Fund<span className="text-brand-600">My</span>Degree</span>
          </Link>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-stone-500">{t("footer.tagline")}</p>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <p className="text-sm font-semibold text-stone-900">{c.title}</p>
            <ul className="mt-4 space-y-2.5 text-sm">
              {c.links.map(([href, label]) => (
                <li key={href}><Link href={href} className="text-stone-500 transition hover:text-brand-700">{label}</Link></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-stone-100">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-stone-400">{t("footer.rights", { year: new Date().getFullYear() })}</p>
      </div>
    </footer>
  );
}

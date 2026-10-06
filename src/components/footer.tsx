import Link from "next/link";
import { getT } from "@/i18n/server";

export async function Footer() {
  const t = await getT();
  return (
    <footer className="mt-16 border-t border-stone-200 bg-white/60">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-stone-500 sm:flex-row sm:items-center sm:justify-between">
        <p>{t("footer.tagline")}</p>
        <div className="flex gap-4">
          <Link href="/privacy" className="hover:text-stone-800">{t("footer.privacy")}</Link>
          <Link href="/terms" className="hover:text-stone-800">{t("footer.terms")}</Link>
          <span>{t("footer.rights", { year: new Date().getFullYear() })}</span>
        </div>
      </div>
    </footer>
  );
}

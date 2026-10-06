import Link from "next/link";
import { Avatar, Badge } from "@/components/ui";
import { avatarUrl } from "@/lib/files";
import { countryName } from "@/lib/format";
import type { Translator } from "@/i18n/translate";
import type { Formatter } from "@/lib/server-format";
import type { StudentCard as Card } from "@/lib/listing";

export function StudentCard({ s, t, f }: { s: Card; t: Translator; f: Formatter }) {
  const g = s.grant?.progress;
  const pct = (n: number) => (g && g.target > 0 ? Math.min(100, (n / g.target) * 100) : 0);
  const est = g ? f.estimate(g.remaining, g.currency) : null;
  return (
    <article className="group flex h-full flex-col rounded-3xl border border-stone-200 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl">
      <div className="flex items-center gap-3">
        <Avatar src={avatarUrl(s.avatarPath)} name={s.name} size={52} />
        <div className="min-w-0">
          <h3 className="truncate font-semibold">
            <Link href={`/students/${s.id}`} className="group-hover:text-brand-700">{s.name}</Link>
          </h3>
          <p className="truncate text-sm text-stone-500">{s.university.name}</p>
          <p className="text-xs text-stone-400">{countryName(s.university.country_code, f.locale)}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {s.degree && <Badge tone="brand">{t(`degree.${s.degree}`)}</Badge>}
        {s.field && <Badge>{s.field}</Badge>}
        <Badge>{t("common.termXofY", { x: s.currentTerm, y: s.totalTerms })}</Badge>
      </div>
      <p className="mt-4 line-clamp-3 flex-1 text-sm leading-relaxed text-stone-600">“{s.storyExcerpt}”</p>
      <div className="mt-5">
        {g ? (
          <>
            <div className="flex h-2.5 overflow-hidden rounded-full bg-stone-200" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct(g.confirmed))}>
              <div className="h-full bg-trust-500" style={{ width: `${pct(g.confirmed)}%` }} />
              <div className="h-full bg-brand-300" style={{ width: `${Math.min(100 - pct(g.confirmed), pct(g.pending))}%` }} />
            </div>
            <div className="mt-2 flex items-baseline justify-between gap-2 text-sm">
              <span className="font-semibold text-brand-700">
                {g.remaining > 0 ? t("home.remaining", { amount: f.money(g.remaining, g.currency) }) : t("progress.fullyFunded")}
              </span>
              <span className="text-xs text-stone-500">{s.grant?.term_label}</span>
            </div>
            {est && g.remaining > 0 && <p className="text-xs text-stone-400">{t("common.estimate", { amount: est })}</p>}
          </>
        ) : (
          <p className="text-sm text-stone-500">{t("listing.noOpenGrant")}</p>
        )}
      </div>
      <Link href={`/students/${s.id}`} className="btn-primary mt-5 w-full">{t("listing.sponsor")}</Link>
    </article>
  );
}

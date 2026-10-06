import Link from "next/link";
import { Avatar, Badge } from "@/components/ui";
import { GrantProgress } from "@/components/grant-progress";
import { avatarUrl } from "@/lib/files";
import { countryName } from "@/lib/format";
import type { Translator } from "@/i18n/translate";
import type { Formatter } from "@/lib/server-format";
import type { StudentCard as Card } from "@/lib/listing";

export function StudentCard({ s, t, f }: { s: Card; t: Translator; f: Formatter }) {
  return (
    <article className="flex flex-col rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-start gap-3">
        <Avatar src={avatarUrl(s.avatarPath)} name={s.name} size={56} />
        <div className="min-w-0">
          <h3 className="truncate font-semibold">
            <Link href={`/students/${s.id}`} className="hover:text-brand-700">{s.name}</Link>
          </h3>
          <p className="truncate text-sm text-stone-600">{s.university.name}</p>
          <p className="text-xs text-stone-500">{countryName(s.university.country_code, f.locale)}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {s.degree && <Badge tone="brand">{t(`degree.${s.degree}`)}</Badge>}
        {s.field && <Badge>{s.field}</Badge>}
        <Badge>{t("common.termXofY", { x: s.currentTerm, y: s.totalTerms })}</Badge>
      </div>
      <p className="mt-3 line-clamp-3 flex-1 text-sm text-stone-600">{s.storyExcerpt}</p>
      <div className="mt-4">
        {s.grant ? (
          <>
            <p className="mb-2 text-xs font-medium text-stone-500">{s.grant.term_label}</p>
            <GrantProgress progress={s.grant.progress} t={t} f={f} />
          </>
        ) : (
          <p className="text-sm text-stone-500">{t("listing.noOpenGrant")}</p>
        )}
      </div>
      <Link href={`/students/${s.id}`} className="btn-primary mt-4 w-full">{t("listing.sponsor")}</Link>
    </article>
  );
}

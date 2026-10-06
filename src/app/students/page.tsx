import Link from "next/link";
import { getT } from "@/i18n/server";
import { getFormatter } from "@/lib/server-format";
import { getStudentCards, type ListingFilters } from "@/lib/listing";
import { getApprovedUniversities, getCountries } from "@/lib/reference";
import { StudentCard } from "@/components/student-card";
import { EmptyState, PageHeader, Pagination } from "@/components/ui";

const PAGE_SIZE = 12;
type SP = Record<string, string | undefined>;

export default async function StudentsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const num = (v?: string) => (v && !Number.isNaN(Number(v)) ? Number(v) : undefined);
  const filters: ListingFilters = {
    country: sp.country || undefined,
    university: sp.university || undefined,
    field: sp.field || undefined,
    degree: sp.degree || undefined,
    term: sp.term || undefined,
    minRemainingUsd: num(sp.min),
    maxRemainingUsd: num(sp.max),
    sort: (sp.sort as ListingFilters["sort"]) || "newest",
    q: sp.q || undefined,
  };
  const page = Math.max(1, Number(sp.page) || 1);
  const [t, f, cards, countries, universities] = await Promise.all([getT(), getFormatter(), getStudentCards(filters), getCountries(), getApprovedUniversities()]);
  const shown = cards.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const usedCountries = new Set(universities.map((u) => u.country_code));
  const hrefFor = (p: number) => `/students?${new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).filter(([, v]) => v)) as Record<string, string>, page: String(p) })}`;

  return (
    <div>
      <PageHeader title={t("listing.title")} subtitle={t("listing.subtitle", { currency: f.currency })} />
      <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
        <form className="card h-fit space-y-3 text-sm" method="get">
          <input name="q" className="input" placeholder={t("common.search")} defaultValue={sp.q} />
          <div>
            <label className="label" htmlFor="country">{t("listing.country")}</label>
            <select id="country" name="country" className="input" defaultValue={sp.country ?? ""}>
              <option value="">{t("common.any")}</option>
              {countries.filter((c) => usedCountries.has(c.code)).map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="university">{t("listing.university")}</label>
            <select id="university" name="university" className="input" defaultValue={sp.university ?? ""}>
              <option value="">{t("common.any")}</option>
              {universities.filter((u) => !sp.country || u.country_code === sp.country).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="field">{t("listing.field")}</label>
            <input id="field" name="field" className="input" defaultValue={sp.field} />
          </div>
          <div>
            <label className="label" htmlFor="degree">{t("listing.degreeLevel")}</label>
            <select id="degree" name="degree" className="input" defaultValue={sp.degree ?? ""}>
              <option value="">{t("common.any")}</option>
              <option value="undergraduate">{t("degree.undergraduate")}</option>
              <option value="masters">{t("degree.masters")}</option>
              <option value="phd">{t("degree.phd")}</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="term">{t("listing.term")}</label>
            <input id="term" name="term" type="number" min={1} max={20} className="input" defaultValue={sp.term} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label" htmlFor="min">{t("listing.minRemaining")}</label>
              <input id="min" name="min" type="number" min={0} className="input" defaultValue={sp.min} />
            </div>
            <div>
              <label className="label" htmlFor="max">{t("listing.maxRemaining")}</label>
              <input id="max" name="max" type="number" min={0} className="input" defaultValue={sp.max} />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="sort">{t("listing.sort")}</label>
            <select id="sort" name="sort" className="input" defaultValue={sp.sort ?? "newest"}>
              <option value="newest">{t("listing.sortNewest")}</option>
              <option value="closest">{t("listing.sortClosest")}</option>
              <option value="remaining_asc">{t("listing.sortRemainingAsc")}</option>
              <option value="remaining_desc">{t("listing.sortRemainingDesc")}</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button className="btn-primary flex-1" type="submit">{t("common.apply")}</button>
            <Link href="/students" className="btn-secondary">{t("common.clear")}</Link>
          </div>
        </form>

        <div>
          <p className="mb-3 text-sm text-stone-500">{t("listing.results", { count: cards.length })}</p>
          {shown.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {shown.map((s) => <StudentCard key={s.id} s={s} t={t} f={f} />)}
            </div>
          ) : (
            <EmptyState>{t("listing.empty")}</EmptyState>
          )}
          <Pagination page={page} hasNext={cards.length > page * PAGE_SIZE} hrefFor={hrefFor} labels={{ prev: t("common.previous"), next: t("common.next"), page: t("common.page", { page }) }} />
        </div>
      </div>
    </div>
  );
}

import "server-only";
import { db } from "@/lib/supabase/admin";
import { getProgress, summarize, type ProgressSummary } from "@/lib/grants";
import { getRates, convert } from "@/lib/fx";
import type { DegreeLevel, Grant, Profile, StudentProfile, University } from "@/types/db";

export interface ListingFilters {
  country?: string;
  university?: string;
  field?: string;
  degree?: string;
  term?: string;
  minRemainingUsd?: number;
  maxRemainingUsd?: number;
  sort?: "newest" | "remaining_asc" | "remaining_desc" | "closest";
  q?: string;
}

export interface StudentCard {
  id: string;
  name: string;
  avatarPath: string | null;
  countryCode: string | null;
  university: Pick<University, "id" | "name" | "country_code" | "fee_currency">;
  program: string | null;
  field: string | null;
  degree: DegreeLevel | null;
  termKind: StudentProfile["term_kind"];
  currentTerm: number;
  totalTerms: number;
  storyExcerpt: string;
  grant: (Pick<Grant, "id" | "term_label" | "status" | "currency" | "target_amount"> & { progress: ProgressSummary }) | null;
  remainingUsd: number;
  verifiedAt: string | null;
}

/** Verified, non-suspended students with their current open grant. */
export async function getStudentCards(filters: ListingFilters = {}): Promise<StudentCard[]> {
  let query = db()
    .from("student_profiles")
    .select("*")
    .eq("verification_status", "verified")
    .eq("status", "active")
    .limit(1000);
  if (filters.university) query = query.eq("university_id", filters.university);
  if (filters.degree) query = query.eq("degree_level", filters.degree);
  if (filters.term) query = query.eq("current_term", Number(filters.term));
  if (filters.field) query = query.ilike("field_of_study", `%${filters.field.replace(/[%_]/g, "")}%`);
  const { data: students } = await query;
  const rows = (students ?? []) as StudentProfile[];
  if (!rows.length) return [];

  const ids = rows.map((s) => s.user_id);
  const uniIds = [...new Set(rows.map((s) => s.university_id).filter(Boolean))] as string[];
  const [{ data: profiles }, { data: universities }, { data: grants }, rates] = await Promise.all([
    db().from("profiles").select("id, full_name, country_code, avatar_path, suspended_at, deleted_at").in("id", ids),
    db().from("universities").select("id, name, country_code, fee_currency").in("id", uniIds),
    db().from("grants").select("id, student_id, term_label, term_number, status, currency, target_amount").in("student_id", ids).eq("status", "open"),
    getRates(),
  ]);
  const progress = await getProgress((grants ?? []).map((g) => g.id));
  const pMap = new Map(((profiles ?? []) as Profile[]).map((p) => [p.id, p]));
  const uMap = new Map((universities ?? []).map((u) => [u.id, u]));
  const gMap = new Map<string, Grant>();
  for (const g of (grants ?? []) as Grant[]) {
    const prev = gMap.get(g.student_id);
    if (!prev || g.term_number > prev.term_number) gMap.set(g.student_id, g);
  }

  let cards: StudentCard[] = [];
  for (const s of rows) {
    const p = pMap.get(s.user_id);
    const u = s.university_id ? uMap.get(s.university_id) : undefined;
    if (!p || !u || p.suspended_at || p.deleted_at) continue;
    const g = gMap.get(s.user_id);
    const summary = g ? summarize(progress.get(g.id), g) : null;
    cards.push({
      id: s.user_id,
      name: p.full_name,
      avatarPath: s.photo_path ?? p.avatar_path,
      countryCode: p.country_code,
      university: u,
      program: s.program_name,
      field: s.field_of_study,
      degree: s.degree_level,
      termKind: s.term_kind,
      currentTerm: s.current_term,
      totalTerms: s.total_terms,
      storyExcerpt: (s.story ?? "").slice(0, 180),
      grant: g && summary ? { id: g.id, term_label: g.term_label, status: g.status, currency: g.currency, target_amount: g.target_amount, progress: summary } : null,
      remainingUsd: summary ? (convert(summary.remaining, summary.currency, "USD", rates) ?? 0) : 0,
      verifiedAt: s.verified_at,
    });
  }

  if (filters.country) cards = cards.filter((c) => c.university.country_code === filters.country || c.countryCode === filters.country);
  if (filters.q) {
    const q = filters.q.toLowerCase();
    cards = cards.filter((c) => [c.name, c.university.name, c.program, c.field].some((v) => v?.toLowerCase().includes(q)));
  }
  if (filters.minRemainingUsd !== undefined) cards = cards.filter((c) => c.remainingUsd >= filters.minRemainingUsd!);
  if (filters.maxRemainingUsd !== undefined) cards = cards.filter((c) => c.remainingUsd <= filters.maxRemainingUsd!);

  const fundedShare = (c: StudentCard) => (c.grant ? (c.grant.progress.confirmed + c.grant.progress.pending) / c.grant.progress.target : -1);
  switch (filters.sort) {
    case "remaining_asc":
      cards.sort((a, b) => (a.grant ? a.remainingUsd : Infinity) - (b.grant ? b.remainingUsd : Infinity));
      break;
    case "remaining_desc":
      cards.sort((a, b) => b.remainingUsd - a.remainingUsd);
      break;
    case "closest":
      cards.sort((a, b) => fundedShare(b) - fundedShare(a));
      break;
    default:
      cards.sort((a, b) => (b.verifiedAt ?? "").localeCompare(a.verifiedAt ?? ""));
  }
  // Students with an open grant first.
  return cards.sort((a, b) => Number(!!b.grant && b.remainingUsd > 0) - Number(!!a.grant && a.remainingUsd > 0));
}

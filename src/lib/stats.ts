import "server-only";
import { db } from "@/lib/supabase/admin";
import type { Donation } from "@/types/db";

type Row = Pick<Donation, "id" | "donor_id" | "student_id" | "grant_id" | "method" | "status" | "original_amount" | "original_currency" | "grant_amount" | "confirmed_amount" | "usd_rate" | "created_at" | "reviewed_at" | "proof_submitted_at">;

const usd = (d: Row) => Number(d.confirmed_amount ?? d.grant_amount) * Number(d.usd_rate);
const r2 = (n: number) => Math.round(n * 100) / 100;

function topN(map: Map<string, number>, n = 10) {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, value]) => ({ name, value: r2(value) }));
}
function add(map: Map<string, number>, key: string, v: number) {
  map.set(key, (map.get(key) ?? 0) + v);
}

/**
 * Admin overview figures in USD. Each donation is converted with the USD rate
 * frozen when it was made, so historical totals don't drift with FX.
 */
export async function getAdminStats() {
  const [{ data: donations }, { data: grants }, { data: students }, { data: profiles }, { data: universities }] = await Promise.all([
    db().from("donations").select("id, donor_id, student_id, grant_id, method, status, original_amount, original_currency, grant_amount, confirmed_amount, usd_rate, created_at, reviewed_at, proof_submitted_at"),
    db().from("grants").select("id, student_id, status, funded_at, paid_at, term_number"),
    db().from("student_profiles").select("user_id, verification_status, status, field_of_study, university_id"),
    db().from("profiles").select("id, role, country_code"),
    db().from("universities").select("id, name, country_code"),
  ]);
  const rows = (donations ?? []) as Row[];
  const confirmed = rows.filter((d) => d.status === "confirmed" || d.status === "disbursed");
  const grantMap = new Map((grants ?? []).map((g) => [g.id, g]));
  const studentMap = new Map((students ?? []).map((s) => [s.user_id, s]));
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
  const uniMap = new Map((universities ?? []).map((u) => [u.id, u]));

  const totalPlatform = confirmed.filter((d) => d.method === "platform").reduce((s, d) => s + usd(d), 0);
  const totalDirect = confirmed.filter((d) => d.method === "direct").reduce((s, d) => s + usd(d), 0);
  const paidToUniversities = confirmed.filter((d) => grantMap.get(d.grant_id)?.status === "paid").reduce((s, d) => s + usd(d), 0);
  const held = rows.filter((d) => d.method === "platform" && d.status === "confirmed").reduce((s, d) => s + usd(d), 0);
  const pendingProofs = rows.filter((d) => d.method === "direct" && d.status === "pending" && d.proof_submitted_at).length;

  const fundedStudents = new Set((grants ?? []).filter((g) => g.status === "funded" || g.status === "paid").map((g) => g.student_id));
  const activeStudents = (students ?? []).filter((s) => s.verification_status === "verified" && s.status === "active").length;
  const graduated = (students ?? []).filter((s) => s.status === "graduated").length;
  const givingDonors = new Set(confirmed.map((d) => d.donor_id).filter(Boolean));
  const registeredDonors = (profiles ?? []).filter((p) => p.role === "donor").length;

  const studentCountry = (sid: string) => {
    const s = studentMap.get(sid);
    return (s?.university_id && uniMap.get(s.university_id)?.country_code) || profileMap.get(sid)?.country_code || "—";
  };
  const countries = new Set<string>();
  for (const d of confirmed) {
    countries.add(studentCountry(d.student_id));
    const dc = d.donor_id ? profileMap.get(d.donor_id)?.country_code : null;
    if (dc) countries.add(dc);
  }
  countries.delete("—");

  const byCurrency = new Map<string, { original: number; usd: number; count: number }>();
  for (const d of confirmed) {
    const e = byCurrency.get(d.original_currency) ?? { original: 0, usd: 0, count: 0 };
    e.original += Number(d.original_amount);
    e.usd += usd(d);
    e.count += 1;
    byCurrency.set(d.original_currency, e);
  }

  // Charts
  const monthly = new Map<string, { platform: number; direct: number }>();
  for (const d of confirmed) {
    const month = (d.reviewed_at ?? d.created_at).slice(0, 7);
    const e = monthly.get(month) ?? { platform: 0, direct: 0 };
    e[d.method] += usd(d);
    monthly.set(month, e);
  }
  const overTime = [...monthly.entries()].sort().map(([month, v]) => ({ month, platform: r2(v.platform), direct: r2(v.direct), total: r2(v.platform + v.direct) }));

  const perPeriod = new Map<string, Set<string>>();
  for (const g of grants ?? []) {
    if (!g.funded_at) continue;
    const dt = new Date(g.funded_at);
    const key = `${dt.getUTCFullYear()} H${dt.getUTCMonth() < 6 ? 1 : 2}`;
    if (!perPeriod.has(key)) perPeriod.set(key, new Set());
    perPeriod.get(key)!.add(g.student_id);
  }
  const studentsPerTerm = [...perPeriod.entries()].sort().map(([period, s]) => ({ name: period, value: s.size }));

  const byCountry = new Map<string, number>();
  const byUniversity = new Map<string, number>();
  const byField = new Map<string, number>();
  for (const d of confirmed) {
    const s = studentMap.get(d.student_id);
    add(byCountry, studentCountry(d.student_id), usd(d));
    add(byUniversity, (s?.university_id && uniMap.get(s.university_id)?.name) || "—", usd(d));
    add(byField, s?.field_of_study?.trim() || "—", usd(d));
  }

  const donorCountries = new Map<string, Set<string>>();
  const studentCountries = new Map<string, Set<string>>();
  for (const d of confirmed) {
    const dc = d.donor_id ? profileMap.get(d.donor_id)?.country_code : null;
    if (dc && d.donor_id) (donorCountries.get(dc) ?? donorCountries.set(dc, new Set()).get(dc)!).add(d.donor_id);
    const sc = studentCountry(d.student_id);
    (studentCountries.get(sc) ?? studentCountries.set(sc, new Set()).get(sc)!).add(d.student_id);
  }
  const allCountries = new Set([...donorCountries.keys(), ...studentCountries.keys()]);
  const donorVsStudent = [...allCountries]
    .map((c) => ({ name: c, donors: donorCountries.get(c)?.size ?? 0, students: studentCountries.get(c)?.size ?? 0 }))
    .sort((a, b) => b.donors + b.students - (a.donors + a.students))
    .slice(0, 12);

  return {
    totals: {
      donated: r2(totalPlatform + totalDirect),
      platform: r2(totalPlatform),
      direct: r2(totalDirect),
      paidToUniversities: r2(paidToUniversities),
      held: r2(held),
      pendingProofs,
      studentsFunded: fundedStudents.size,
      activeStudents,
      graduated,
      donors: givingDonors.size,
      registeredDonors,
      countries: countries.size,
    },
    byCurrency: [...byCurrency.entries()].map(([currency, v]) => ({ currency, original: r2(v.original), usd: r2(v.usd), count: v.count })).sort((a, b) => b.usd - a.usd),
    charts: {
      overTime,
      studentsPerTerm,
      byCountry: topN(byCountry),
      byUniversity: topN(byUniversity),
      byField: topN(byField),
      donorVsStudent,
      split: [
        { name: "platform", value: r2(totalPlatform) },
        { name: "direct", value: r2(totalDirect) },
      ],
    },
  };
}
export type AdminStats = Awaited<ReturnType<typeof getAdminStats>>;

import "server-only";
import { db } from "@/lib/supabase/admin";
import type { Donation, Grant, Profile, StudentProfile, StudentUpdate, TermResult, University } from "@/types/db";

export interface DonorData {
  donations: Donation[];
  grants: Map<string, Grant>;
  students: Map<string, { profile: Profile; student: StudentProfile }>;
  universities: Map<string, University>;
  latestResult: Map<string, TermResult>;
  latestUpdate: Map<string, StudentUpdate>;
  openGrantByStudent: Map<string, Grant>;
}

export async function getDonorData(donorId: string): Promise<DonorData> {
  const { data: donations } = await db().from("donations").select("*").eq("donor_id", donorId).order("created_at", { ascending: false });
  const rows = (donations ?? []) as Donation[];
  const studentIds = [...new Set(rows.map((d) => d.student_id))];
  if (!studentIds.length) {
    return { donations: [], grants: new Map(), students: new Map(), universities: new Map(), latestResult: new Map(), latestUpdate: new Map(), openGrantByStudent: new Map() };
  }
  const [{ data: grants }, { data: profiles }, { data: sps }, { data: results }, { data: updates }] = await Promise.all([
    db().from("grants").select("*").in("student_id", studentIds),
    db().from("profiles").select("*").in("id", studentIds),
    db().from("student_profiles").select("*").in("user_id", studentIds),
    db().from("term_results").select("*").in("student_id", studentIds).eq("status", "approved").order("term_number", { ascending: false }),
    db().from("student_updates").select("*").in("student_id", studentIds).order("created_at", { ascending: false }).limit(200),
  ]);
  const uniIds = [...new Set(((sps ?? []) as StudentProfile[]).map((s) => s.university_id).filter(Boolean))] as string[];
  const { data: unis } = await db().from("universities").select("*").in("id", uniIds);

  const spMap = new Map(((sps ?? []) as StudentProfile[]).map((s) => [s.user_id, s]));
  const students = new Map<string, { profile: Profile; student: StudentProfile }>();
  for (const p of (profiles ?? []) as Profile[]) {
    const s = spMap.get(p.id);
    if (s) students.set(p.id, { profile: p, student: s });
  }
  const latestResult = new Map<string, TermResult>();
  for (const r of (results ?? []) as TermResult[]) if (!latestResult.has(r.student_id)) latestResult.set(r.student_id, r);
  const latestUpdate = new Map<string, StudentUpdate>();
  for (const u of (updates ?? []) as StudentUpdate[]) if (!latestUpdate.has(u.student_id)) latestUpdate.set(u.student_id, u);
  const openGrantByStudent = new Map<string, Grant>();
  for (const g of (grants ?? []) as Grant[]) {
    if (g.status !== "open") continue;
    const prev = openGrantByStudent.get(g.student_id);
    if (!prev || g.term_number > prev.term_number) openGrantByStudent.set(g.student_id, g);
  }
  return {
    donations: rows,
    grants: new Map(((grants ?? []) as Grant[]).map((g) => [g.id, g])),
    students,
    universities: new Map(((unis ?? []) as University[]).map((u) => [u.id, u])),
    latestResult,
    latestUpdate,
    openGrantByStudent,
  };
}

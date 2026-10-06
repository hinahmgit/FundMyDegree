import "server-only";
import { db } from "@/lib/supabase/admin";
import type { Disbursement, DocumentType, Grant, Profile, StudentProfile, StudentUpdate, TermFee, TermResult, University } from "@/types/db";
import { getProgress, summarize, type ProgressSummary } from "@/lib/grants";

export const STUDENT_DOCS: DocumentType[] = ["government_id", "enrollment_proof", "tuition_invoice"];

/** What's still missing before a student can submit for verification. */
export async function missingForVerification(studentId: string): Promise<string[]> {
  const [{ data: sp }, { data: docs }, { data: fees }] = await Promise.all([
    db().from("student_profiles").select("*").eq("user_id", studentId).maybeSingle<StudentProfile>(),
    db().from("documents").select("type").eq("student_id", studentId),
    db().from("term_fees").select("term_number").eq("student_id", studentId),
  ]);
  const missing: string[] = [];
  if (!sp?.university_id) missing.push("studentProfile.university");
  if (!sp?.program_name) missing.push("studentProfile.program");
  if (!sp?.field_of_study) missing.push("studentProfile.field");
  if (!sp?.degree_level) missing.push("studentProfile.degreeLevel");
  if (!sp?.expected_graduation) missing.push("studentProfile.expectedGraduation");
  if (!sp?.story || sp.story.length < 100) missing.push("studentProfile.story");
  if (!sp || !(fees ?? []).some((f) => f.term_number === sp.current_term)) missing.push("studentProfile.fees");
  const types = new Set((docs ?? []).map((d) => d.type));
  for (const t of STUDENT_DOCS) if (!types.has(t)) missing.push(`documents.${t}`);
  return missing;
}


export interface SupporterRow {
  donationId: string;
  donorId: string | null;
  name: string;
  countryCode: string | null;
  anonymous: boolean;
  amount: number;
  currency: string;
  status: string;
  method: string;
  grantId: string;
  createdAt: string;
}

export interface StudentOverview {
  profile: Profile;
  student: StudentProfile;
  university: University | null;
  grants: (Grant & { progress: ProgressSummary })[];
  currentGrant: (Grant & { progress: ProgressSummary }) | null;
  fees: TermFee[];
  results: TermResult[];
  updates: StudentUpdate[];
  supporters: SupporterRow[];
  disbursements: Disbursement[];
}

/**
 * Everything about one student. Supporters are masked server-side: anonymous
 * donors never leave this function with a name or id.
 */
export async function getStudentOverview(studentId: string, opts: { revealDonorIds?: boolean } = {}): Promise<StudentOverview | null> {
  const [{ data: profile }, { data: student }] = await Promise.all([
    db().from("profiles").select("*").eq("id", studentId).maybeSingle<Profile>(),
    db().from("student_profiles").select("*").eq("user_id", studentId).maybeSingle<StudentProfile>(),
  ]);
  if (!profile || !student) return null;

  const [{ data: university }, { data: grants }, { data: fees }, { data: results }, { data: updates }, { data: donations }] = await Promise.all([
    student.university_id
      ? db().from("universities").select("*").eq("id", student.university_id).maybeSingle<University>()
      : Promise.resolve({ data: null }),
    db().from("grants").select("*").eq("student_id", studentId).order("term_number", { ascending: false }),
    db().from("term_fees").select("*").eq("student_id", studentId).order("term_number"),
    db().from("term_results").select("*").eq("student_id", studentId).order("term_number", { ascending: false }),
    db().from("student_updates").select("*").eq("student_id", studentId).order("created_at", { ascending: false }).limit(20),
    db()
      .from("donations")
      .select("id, donor_id, anonymous, grant_amount, confirmed_amount, status, method, grant_id, created_at, pledge_expires_at, proof_submitted_at")
      .eq("student_id", studentId)
      .in("status", ["pending", "confirmed", "disbursed"])
      .order("created_at", { ascending: false }),
  ]);

  const grantRows = (grants ?? []) as Grant[];
  const progress = await getProgress(grantRows.map((g) => g.id));
  const withProgress = grantRows.map((g) => ({ ...g, progress: summarize(progress.get(g.id), g) }));
  const grantCurrency = new Map(grantRows.map((g) => [g.id, g.currency]));

  const live = (donations ?? []).filter(
    (d) => d.status !== "pending" || d.method === "platform" || d.proof_submitted_at || new Date(d.pledge_expires_at) > new Date(),
  );
  const donorIds = [...new Set(live.filter((d) => !d.anonymous && d.donor_id).map((d) => d.donor_id as string))];
  const { data: donorProfiles } = donorIds.length
    ? await db().from("profiles").select("id, full_name, country_code").in("id", donorIds)
    : { data: [] as { id: string; full_name: string; country_code: string | null }[] };
  const donorMap = new Map((donorProfiles ?? []).map((p) => [p.id, p]));

  const supporters: SupporterRow[] = live.map((d) => {
    const p = d.anonymous ? null : donorMap.get(d.donor_id);
    return {
      donationId: d.id,
      donorId: d.anonymous && !opts.revealDonorIds ? null : d.donor_id,
      name: p?.full_name ?? "",
      countryCode: p?.country_code ?? null,
      anonymous: d.anonymous || !p,
      amount: Number(d.confirmed_amount ?? d.grant_amount),
      currency: grantCurrency.get(d.grant_id) ?? "",
      status: d.status,
      method: d.method,
      grantId: d.grant_id,
      createdAt: d.created_at,
    };
  });

  const grantIds = grantRows.map((g) => g.id);
  const { data: disbursements } = grantIds.length
    ? await db().from("disbursements").select("*").in("grant_id", grantIds).order("created_at", { ascending: false })
    : { data: [] };

  const current = withProgress.find((g) => ["open", "funded"].includes(g.status)) ?? withProgress.find((g) => g.status === "paid") ?? null;

  return {
    profile,
    student,
    university: university ?? null,
    grants: withProgress,
    currentGrant: current,
    fees: (fees ?? []) as TermFee[],
    results: (results ?? []) as TermResult[],
    updates: (updates ?? []) as StudentUpdate[],
    supporters,
    disbursements: (disbursements ?? []) as Disbursement[],
  };
}

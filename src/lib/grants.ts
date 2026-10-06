import "server-only";
import { db } from "@/lib/supabase/admin";
import { notify, notifyMany, adminIds } from "@/lib/notifications";
import { logAudit } from "@/lib/audit";
import type { Grant, GrantProgress, StudentProfile, TermFee } from "@/types/db";

export interface ProgressSummary {
  target: number;
  confirmed: number;
  pending: number;
  remaining: number;
  currency: string;
}

export function summarize(p: GrantProgress | undefined, grant: Pick<Grant, "target_amount" | "currency">): ProgressSummary {
  const target = Number(grant.target_amount);
  const confirmed = Number(p?.confirmed_amount ?? 0);
  const pending = Number(p?.pending_amount ?? 0);
  return {
    target,
    confirmed,
    pending,
    remaining: Math.max(0, Math.round((target - confirmed - pending) * 100) / 100),
    currency: grant.currency,
  };
}

export async function getProgress(grantIds: string[]): Promise<Map<string, GrantProgress>> {
  if (!grantIds.length) return new Map();
  const { data } = await db().from("grant_progress").select("*").in("grant_id", grantIds);
  return new Map((data ?? []).map((p: GrantProgress) => [p.grant_id, p]));
}

export async function getGrantWithProgress(grantId: string) {
  const { data: grant } = await db().from("grants").select("*").eq("id", grantId).maybeSingle<Grant>();
  if (!grant) return null;
  const progress = await getProgress([grant.id]);
  return { grant, progress: summarize(progress.get(grant.id), grant) };
}

export function termLabel(t: (k: "terms.semester" | "terms.term" | "terms.trimester" | "terms.quarter" | "terms.year", v: { n: number }) => string, kind: StudentProfile["term_kind"], n: number) {
  return t(`terms.${kind}`, { n });
}

/** Recalculate funded state after money is confirmed or removed; notify on becoming funded. */
export async function refreshGrant(grantId: string) {
  const { data: before } = await db().from("grants").select("status").eq("id", grantId).single();
  const { data: status, error } = await db().rpc("refresh_grant_status", { p_grant_id: grantId });
  if (error) throw new Error(error.message);
  if (before?.status === "open" && status === "funded") {
    const { data: grant } = await db().from("grants").select("*").eq("id", grantId).single<Grant>();
    if (!grant) return status;
    const { data: donors } = await db()
      .from("donations")
      .select("donor_id")
      .eq("grant_id", grantId)
      .in("status", ["confirmed", "disbursed"]);
    const params = { term: grant.term_label ?? String(grant.term_number) };
    await notify(grant.student_id, "grant_funded", params, "/student");
    await notifyMany((donors ?? []).map((d) => d.donor_id), "grant_funded", params, "/donor");
    await notifyMany(await adminIds(), "grant_funded", params, "/admin/disbursements");
  }
  return status as Grant["status"];
}

/**
 * Open a student's grant for a term from their fee breakdown. Used when a
 * student is first verified and when an admin approves term results.
 */
export async function openGrantForTerm(opts: {
  student: StudentProfile;
  termNumber: number;
  actorId: string;
  label: string;
  targetOverride?: number;
  invoiceDocumentId?: string | null;
  invoiceNumber?: string | null;
}): Promise<Grant | null> {
  const { student, termNumber } = opts;
  if (!student.university_id) return null;
  const { data: uni } = await db().from("universities").select("fee_currency").eq("id", student.university_id).single();
  const { data: fee } = await db()
    .from("term_fees")
    .select("*")
    .eq("student_id", student.user_id)
    .eq("term_number", termNumber)
    .maybeSingle<TermFee>();
  const target = opts.targetOverride ?? (fee ? Number(fee.amount) : null);
  if (!target || !uni) return null;

  const { data: grant, error } = await db()
    .from("grants")
    .upsert(
      {
        student_id: student.user_id,
        university_id: student.university_id,
        term_number: termNumber,
        term_label: fee?.label || opts.label,
        target_amount: target,
        currency: uni.fee_currency,
        payment_deadline: fee?.due_date ?? null,
        invoice_document_id: opts.invoiceDocumentId ?? null,
        invoice_number: opts.invoiceNumber ?? null,
        status: "open",
        opened_at: new Date().toISOString(),
        created_by: opts.actorId,
      },
      { onConflict: "student_id,term_number" },
    )
    .select("*")
    .single<Grant>();
  if (error || !grant) throw new Error(error?.message ?? "Could not open grant");
  await logAudit(opts.actorId, "grant.opened", "grant", grant.id, {
    student_id: student.user_id,
    term_number: termNumber,
    target_amount: target,
    currency: uni.fee_currency,
  });
  return grant;
}

/** Donor ids with confirmed support for a student, used for "first notice" on renewals. */
export async function previousDonorIds(studentId: string): Promise<string[]> {
  const { data } = await db()
    .from("donations")
    .select("donor_id")
    .eq("student_id", studentId)
    .in("status", ["confirmed", "disbursed"]);
  return [...new Set((data ?? []).map((d) => d.donor_id as string).filter(Boolean))];
}

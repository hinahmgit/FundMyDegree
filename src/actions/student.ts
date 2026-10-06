"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/supabase/admin";
import { isFile, uploadAvatar, uploadPrivateDocument, UploadError } from "@/lib/files";
import { notifyMany } from "@/lib/notifications";
import { previousDonorIds } from "@/lib/grants";
import { missingForVerification, STUDENT_DOCS } from "@/lib/students";
import { getT } from "@/i18n/server";
import type { MessageKey } from "@/i18n/translate";
import { fail, done, type ActionState } from "@/lib/action-state";
import type { DocumentType, Grant, StudentProfile } from "@/types/db";

const uploadErrorKey = (e: unknown) =>
  e instanceof UploadError ? (e.code === "too_large" ? "documents.tooLarge" : e.code === "bad_type" ? "documents.badType" : "documents.uploadFailed") : "documents.uploadFailed";

const profileSchema = z.object({
  university_id: z.string().uuid().optional().or(z.literal("")),
  student_number: z.string().trim().max(60).optional(),
  program_name: z.string().trim().max(160).optional(),
  field_of_study: z.string().trim().max(120).optional(),
  degree_level: z.enum(["undergraduate", "masters", "phd"]).optional().or(z.literal("")),
  term_kind: z.enum(["semester", "term", "trimester", "quarter", "year"]),
  current_term: z.coerce.number().int().min(1).max(20),
  total_terms: z.coerce.number().int().min(1).max(20),
  expected_graduation: z.string().optional(),
  story: z.string().trim().max(2000).optional(),
  total_degree_cost: z.coerce.number().min(0).max(1e10).optional(),
});

export async function saveStudentProfile(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireRole("student");
  const parsed = profileSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success || parsed.data.current_term > parsed.data.total_terms) return fail("common.unknownError");
  const v = parsed.data;

  const { data: existing } = await db().from("student_profiles").select("*").eq("user_id", user.id).maybeSingle<StudentProfile>();
  const locked = existing?.verification_status === "verified" || existing?.verification_status === "pending";

  let photoPath = existing?.photo_path ?? null;
  const photo = form.get("photo");
  if (isFile(photo)) {
    try {
      photoPath = await uploadAvatar(user.id, photo);
      await db().from("profiles").update({ avatar_path: photoPath }).eq("id", user.id);
    } catch (e) {
      return fail(uploadErrorKey(e));
    }
  }

  // After submission, only the story and photo stay editable.
  const editable = locked
    ? { story: v.story ?? null, photo_path: photoPath }
    : {
        university_id: v.university_id || null,
        student_number: v.student_number || null,
        program_name: v.program_name || null,
        field_of_study: v.field_of_study || null,
        degree_level: v.degree_level || null,
        term_kind: v.term_kind,
        current_term: v.current_term,
        total_terms: v.total_terms,
        expected_graduation: v.expected_graduation || null,
        story: v.story ?? null,
        total_degree_cost: v.total_degree_cost ?? null,
        photo_path: photoPath,
      };

  const { error } = await db().from("student_profiles").upsert({ user_id: user.id, ...editable }, { onConflict: "user_id" });
  if (error) return fail("common.unknownError");

  if (!locked) {
    const terms = form.getAll("fee_term").map(Number);
    const labels = form.getAll("fee_label").map(String);
    const amounts = form.getAll("fee_amount").map(Number);
    const dues = form.getAll("fee_due").map(String);
    const rows = terms
      .map((term, i) => ({ student_id: user.id, term_number: term, label: labels[i] || null, amount: amounts[i], due_date: dues[i] || null }))
      .filter((r) => Number.isInteger(r.term_number) && r.term_number >= 1 && r.amount > 0);
    await db().from("term_fees").delete().eq("student_id", user.id);
    if (rows.length) {
      const unique = [...new Map(rows.map((r) => [r.term_number, r])).values()];
      const { error: feeError } = await db().from("term_fees").insert(unique);
      if (feeError) return fail("common.unknownError");
    }
  }
  revalidatePath("/student", "layout");
  return done("common.saved");
}

const universityRequestSchema = z.object({
  name: z.string().trim().min(3).max(200),
  country_code: z.string().length(2),
  city: z.string().trim().max(120).optional(),
  website: z.string().trim().url().max(300).optional().or(z.literal("")),
  fee_currency: z.string().length(3),
});

export async function requestUniversity(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireRole("student");
  const parsed = universityRequestSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return fail("common.unknownError");
  const { error } = await db().from("universities").insert({ ...parsed.data, website: parsed.data.website || null, status: "pending", requested_by: user.id });
  if (error) return fail("common.unknownError");
  revalidatePath("/student/profile");
  return done("studentProfile.universityRequested");
}

export async function uploadStudentDocument(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireRole("student");
  const type = String(form.get("type")) as DocumentType;
  if (!STUDENT_DOCS.includes(type)) return fail("common.unknownError");
  const file = form.get("file");
  if (!isFile(file)) return fail("documents.uploadFailed");
  const { data: sp } = await db().from("student_profiles").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!sp) await db().from("student_profiles").insert({ user_id: user.id });
  try {
    await uploadPrivateDocument({ file, ownerId: user.id, studentId: user.id, type });
  } catch (e) {
    return fail(uploadErrorKey(e));
  }
  revalidatePath("/student/profile");
  return done("common.saved");
}

export async function submitForVerification(_state?: ActionState, _form?: FormData): Promise<ActionState> {
  const user = await requireRole("student");
  const missing = await missingForVerification(user.id);
  if (missing.length) {
    const t = await getT();
    return fail("studentDash.missingForSubmit", { items: missing.map((k) => t(k as MessageKey)).join(", ") });
  }
  const { error } = await db()
    .from("student_profiles")
    .update({ verification_status: "pending", submitted_at: new Date().toISOString(), verification_note: null })
    .eq("user_id", user.id)
    .in("verification_status", ["draft", "rejected"]);
  if (error) return fail("common.unknownError");
  revalidatePath("/student", "layout");
  return done("studentDash.submitted");
}

const resultsSchema = z.object({
  grant_id: z.string().uuid(),
  gpa: z.coerce.number().min(0).max(100).optional().or(z.literal("")),
  gpa_scale: z.coerce.number().min(0).max(100).optional().or(z.literal("")),
  summary: z.string().trim().max(5000).optional(),
});

export async function submitResults(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireRole("student");
  const parsed = resultsSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return fail("common.unknownError");
  const v = parsed.data;
  const { data: grant } = await db().from("grants").select("*").eq("id", v.grant_id).eq("student_id", user.id).maybeSingle<Grant>();
  if (!grant || !["funded", "paid"].includes(grant.status)) return fail("results.notEligible");
  const { count } = await db().from("term_results").select("id", { count: "exact", head: true }).eq("grant_id", grant.id);
  if (count) return fail("results.alreadySubmitted");

  const file = form.get("transcript");
  if (!isFile(file)) return fail("documents.uploadFailed");
  let docId: string;
  try {
    docId = (await uploadPrivateDocument({ file, ownerId: user.id, studentId: user.id, type: "transcript" })).id;
  } catch (e) {
    return fail(uploadErrorKey(e));
  }

  const { data: result, error } = await db()
    .from("term_results")
    .insert({
      student_id: user.id,
      grant_id: grant.id,
      term_number: grant.term_number,
      gpa: v.gpa === "" || v.gpa === undefined ? null : v.gpa,
      gpa_scale: v.gpa_scale === "" || v.gpa_scale === undefined ? null : v.gpa_scale,
      transcript_document_id: docId,
      summary: v.summary || null,
    })
    .select("id")
    .single();
  if (error || !result) return fail("common.unknownError");
  if (v.summary) await db().from("student_updates").insert({ student_id: user.id, term_result_id: result.id, body: v.summary });

  const donors = await previousDonorIds(user.id);
  const term = grant.term_label ?? String(grant.term_number);
  await notifyMany(donors, "results_posted", { student: user.profile.full_name, term }, "/donor");
  revalidatePath("/student", "layout");
  return done("results.submitted");
}

export async function postUpdate(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireRole("student");
  const body = String(form.get("body") ?? "").trim();
  if (!body || body.length > 5000) return fail("common.unknownError");
  await db().from("student_updates").insert({ student_id: user.id, body });
  const donors = await previousDonorIds(user.id);
  await notifyMany(donors, "student_update", { student: user.profile.full_name }, "/donor");
  revalidatePath("/student");
  return done("studentDash.updatePosted");
}


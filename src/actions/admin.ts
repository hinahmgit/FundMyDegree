"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { notify, notifyMany } from "@/lib/notifications";
import { openGrantForTerm, previousDonorIds, refreshGrant } from "@/lib/grants";
import { isFile, uploadPrivateDocument, UploadError } from "@/lib/files";
import { getExchangeRateProvider, getRates, crossRate } from "@/lib/fx";
import { getPaymentProvider } from "@/lib/payments";
import { getSettings, SETTING_KEYS } from "@/lib/settings";
import { formatMoney, round2 } from "@/lib/format";
import { getTFor } from "@/i18n/server";
import { fail, done, type ActionState } from "@/lib/action-state";
import type { Donation, Grant, StudentProfile, TermResult, University } from "@/types/db";

const reason = (form: FormData) => String(form.get("reason") ?? "").trim();
const studentName = async (id: string) => (await db().from("profiles").select("full_name").eq("id", id).single()).data?.full_name ?? "";

// ───────────── Students ─────────────

export async function verifyStudent(_: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const studentId = String(form.get("student_id"));
  const target = Number(form.get("target_amount"));
  const invoiceNumber = String(form.get("invoice_number") ?? "").trim() || null;
  const { data: sp } = await db().from("student_profiles").select("*").eq("user_id", studentId).single<StudentProfile>();
  if (!sp || sp.verification_status !== "pending") return fail("common.unknownError");
  const { data: uni } = await db().from("universities").select("status").eq("id", sp.university_id!).single();
  if (uni?.status !== "approved") return fail("status.university.pending");
  if (!(target > 0)) return fail("admin.results.noFee");

  const { data: invoice } = await db()
    .from("documents")
    .select("id")
    .eq("student_id", studentId)
    .eq("type", "tuition_invoice")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  await db()
    .from("student_profiles")
    .update({ verification_status: "verified", verified_at: new Date().toISOString(), verified_by: admin.id, verification_note: null })
    .eq("user_id", studentId);
  const t = getTFor("en");
  await openGrantForTerm({
    student: sp,
    termNumber: sp.current_term,
    actorId: admin.id,
    label: t(`terms.${sp.term_kind}`, { n: sp.current_term }),
    targetOverride: target,
    invoiceDocumentId: invoice?.id ?? null,
    invoiceNumber,
  });
  await logAudit(admin.id, "student.verified", "student", studentId, { first_grant_target: target, invoice_number: invoiceNumber });
  await notify(studentId, "verification_approved", {}, "/student");
  revalidatePath("/admin", "layout");
  return done("admin.verify.verified");
}

export async function rejectStudent(_: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const studentId = String(form.get("student_id"));
  const why = reason(form);
  if (!why) return fail("admin.reasonRequired");
  await db().from("student_profiles").update({ verification_status: "rejected", verification_note: why }).eq("user_id", studentId);
  await logAudit(admin.id, "student.rejected", "student", studentId, { reason: why });
  await notify(studentId, "verification_rejected", { reason: why }, "/student/profile");
  revalidatePath("/admin", "layout");
  return done("admin.verify.rejected");
}

// ───────────── Universities ─────────────

const universitySchema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  name: z.string().trim().min(2).max(200),
  country_code: z.string().length(2),
  city: z.string().trim().max(120).optional(),
  website: z.string().trim().max(300).optional(),
  fee_currency: z.string().length(3),
  accreditation_body: z.string().trim().max(200).optional(),
  accreditation_reference: z.string().trim().max(300).optional(),
  bank_name: z.string().trim().max(200).optional(),
  bank_account_name: z.string().trim().max(200).optional(),
  bank_account_number: z.string().trim().max(60).optional(),
  iban: z.string().trim().max(40).optional(),
  swift_bic: z.string().trim().max(15).optional(),
  bank_address: z.string().trim().max(300).optional(),
  payment_portal_url: z.string().trim().max(300).optional(),
  payment_reference_instructions: z.string().trim().max(1000).optional(),
  finance_contact_name: z.string().trim().max(120).optional(),
  finance_contact_email: z.string().trim().max(200).optional(),
  finance_contact_phone: z.string().trim().max(60).optional(),
});

export async function saveUniversity(_: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = universitySchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return fail("common.unknownError");
  const { id, ...fields } = parsed.data;
  const clean = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v === "" ? null : v]));
  if (id) {
    const { data: before } = await db().from("universities").select("*").eq("id", id).single<University>();
    const { error } = await db().from("universities").update(clean).eq("id", id);
    if (error) return fail("common.unknownError");
    const changed = Object.keys(clean).filter((k) => (before as unknown as Record<string, unknown>)?.[k] !== clean[k]);
    await logAudit(admin.id, "university.updated", "university", id, { changed });
  } else {
    const { data, error } = await db().from("universities").insert({ ...clean, status: "approved", reviewed_by: admin.id, reviewed_at: new Date().toISOString() }).select("id").single();
    if (error || !data) return fail("common.unknownError");
    await logAudit(admin.id, "university.created", "university", data.id, { name: clean.name });
  }
  revalidatePath("/admin/universities", "layout");
  return done("admin.universities.saved");
}

export async function reviewUniversity(_: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = String(form.get("id"));
  const decision = String(form.get("decision"));
  const why = reason(form);
  const { data: uni } = await db().from("universities").select("*").eq("id", id).single<University>();
  if (!uni) return fail("common.unknownError");
  if (decision === "approve") {
    if (form.get("accreditation_confirmed") !== "on") return fail("admin.universities.approveConfirm");
    await db().from("universities").update({ status: "approved", rejection_reason: null, reviewed_by: admin.id, reviewed_at: new Date().toISOString() }).eq("id", id);
    await logAudit(admin.id, "university.approved", "university", id, { name: uni.name });
    await notify(uni.requested_by, "university_approved", { university: uni.name }, "/student/profile");
  } else {
    if (!why) return fail("admin.reasonRequired");
    await db().from("universities").update({ status: "rejected", rejection_reason: why, reviewed_by: admin.id, reviewed_at: new Date().toISOString() }).eq("id", id);
    await logAudit(admin.id, "university.rejected", "university", id, { name: uni.name, reason: why });
    await notify(uni.requested_by, "university_rejected", { university: uni.name, reason: why }, "/student/profile");
  }
  revalidatePath("/admin/universities", "layout");
  return done("common.saved");
}

// ───────────── Direct payment proofs ─────────────

export async function confirmProof(_: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = String(form.get("donation_id"));
  const confirmed = round2(Number(form.get("confirmed_amount")));
  const note = String(form.get("note") ?? "").trim() || null;
  if (!(confirmed > 0)) return fail("common.unknownError");
  const { data: d } = await db().from("donations").select("*").eq("id", id).single<Donation>();
  if (!d || d.method !== "direct" || d.status !== "pending" || !d.proof_submitted_at) return fail("common.unknownError");
  const { data: grant } = await db().from("grants").select("*").eq("id", d.grant_id).single<Grant>();

  const { error } = await db()
    .from("donations")
    .update({ status: "confirmed", confirmed_amount: confirmed, reviewed_by: admin.id, reviewed_at: new Date().toISOString(), admin_note: note })
    .eq("id", id)
    .eq("status", "pending");
  if (error) return fail("common.unknownError");
  await logAudit(admin.id, "donation.proof_confirmed", "donation", id, {
    pledged: d.grant_amount,
    confirmed_amount: confirmed,
    currency: grant?.currency,
    proof_amount: d.proof_amount,
    proof_currency: d.proof_currency,
    note,
  });
  await notify(d.donor_id, "proof_confirmed", { amount: formatMoney(confirmed, grant?.currency ?? "USD"), student: await studentName(d.student_id) }, "/donor");
  await refreshGrant(d.grant_id);
  revalidatePath("/admin", "layout");
  return done("common.saved");
}

export async function rejectProof(_: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = String(form.get("donation_id"));
  const why = reason(form);
  if (!why) return fail("admin.reasonRequired");
  const { data: d } = await db().from("donations").select("*").eq("id", id).single<Donation>();
  if (!d || d.method !== "direct" || d.status !== "pending") return fail("common.unknownError");
  const { data: grant } = await db().from("grants").select("currency").eq("id", d.grant_id).single();
  await db().from("donations").update({ status: "rejected", rejection_reason: why, reviewed_by: admin.id, reviewed_at: new Date().toISOString() }).eq("id", id);
  await logAudit(admin.id, "donation.proof_rejected", "donation", id, { reason: why, amount: d.grant_amount });
  await notify(d.donor_id, "proof_rejected", { amount: formatMoney(Number(d.grant_amount), grant?.currency ?? "USD"), student: await studentName(d.student_id), reason: why }, `/donor/pledges/${d.id}`);
  revalidatePath("/admin", "layout");
  return done("common.saved");
}

// ───────────── Disbursement ─────────────

export async function recordDisbursement(_: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const grantId = String(form.get("grant_id"));
  const { data: grant } = await db().from("grants").select("*").eq("id", grantId).single<Grant>();
  if (!grant || grant.status !== "funded") return fail("common.unknownError");
  const file = form.get("receipt");
  if (!isFile(file)) return fail("documents.uploadFailed");
  let receiptId: string;
  try {
    receiptId = (await uploadPrivateDocument({ file, ownerId: admin.id, studentId: grant.student_id, type: "university_receipt" })).id;
  } catch (e) {
    return fail(e instanceof UploadError && e.code === "too_large" ? "documents.tooLarge" : "documents.uploadFailed");
  }

  const { data: held } = await db().from("donations").select("id, confirmed_amount, grant_amount").eq("grant_id", grantId).eq("method", "platform").eq("status", "confirmed");
  const platformAmount = round2((held ?? []).reduce((s, d) => s + Number(d.confirmed_amount ?? d.grant_amount), 0));
  const { data: disb, error } = await db()
    .from("disbursements")
    .insert({
      grant_id: grantId,
      platform_amount: platformAmount,
      currency: grant.currency,
      transfer_reference: String(form.get("transfer_reference") ?? "").trim() || null,
      paid_on: String(form.get("paid_on") || new Date().toISOString().slice(0, 10)),
      note: String(form.get("note") ?? "").trim() || null,
      receipt_document_id: receiptId,
      created_by: admin.id,
    })
    .select("id")
    .single();
  if (error || !disb) return fail("common.unknownError");
  if (held?.length) {
    await db().from("donations").update({ status: "disbursed", disbursement_id: disb.id }).in("id", held.map((d) => d.id));
  }
  await db().from("grants").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", grantId);
  await logAudit(admin.id, "grant.paid_to_university", "grant", grantId, {
    disbursement_id: disb.id,
    platform_amount: platformAmount,
    currency: grant.currency,
    transfer_reference: form.get("transfer_reference"),
  });

  const { data: uni } = await db().from("universities").select("name").eq("id", grant.university_id).single();
  const params = { term: grant.term_label ?? String(grant.term_number), university: uni?.name ?? "" };
  const { data: donors } = await db().from("donations").select("donor_id").eq("grant_id", grantId).in("status", ["confirmed", "disbursed"]);
  await notify(grant.student_id, "paid_to_university", params, "/student");
  await notifyMany((donors ?? []).map((d) => d.donor_id), "paid_to_university", params, "/donor");
  revalidatePath("/admin", "layout");
  return done("admin.disbursements.done");
}

// ───────────── Results review ─────────────

export async function reviewResults(_: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = String(form.get("result_id"));
  const decision = String(form.get("decision"));
  const why = reason(form);
  const { data: result } = await db().from("term_results").select("*").eq("id", id).single<TermResult>();
  if (!result || result.status !== "pending") return fail("common.unknownError");
  const { data: sp } = await db().from("student_profiles").select("*").eq("user_id", result.student_id).single<StudentProfile>();
  const { data: grant } = await db().from("grants").select("*").eq("id", result.grant_id).single<Grant>();
  if (!sp || !grant) return fail("common.unknownError");
  const termLabel = grant.term_label ?? String(grant.term_number);

  if (decision !== "approve") {
    if (!why) return fail("admin.reasonRequired");
    await db().from("term_results").update({ status: "rejected", review_reason: why, reviewed_by: admin.id, reviewed_at: new Date().toISOString() }).eq("id", id);
    await logAudit(admin.id, "results.rejected", "term_result", id, { student_id: sp.user_id, reason: why });
    await notify(sp.user_id, "results_rejected", { term: termLabel, reason: why }, "/student");
    revalidatePath("/admin", "layout");
    return done("common.saved");
  }

  const nextTerm = result.term_number + 1;
  let nextGrantId: string | null = null;
  if (nextTerm > sp.total_terms) {
    await db().from("student_profiles").update({ status: "graduated" }).eq("user_id", sp.user_id);
  } else {
    const override = Number(form.get("next_target")) || undefined;
    const t = getTFor("en");
    const next = await openGrantForTerm({ student: sp, termNumber: nextTerm, actorId: admin.id, label: t(`terms.${sp.term_kind}`, { n: nextTerm }), targetOverride: override });
    if (!next) return fail("admin.results.noFee");
    nextGrantId = next.id;
    await db().from("student_profiles").update({ current_term: nextTerm }).eq("user_id", sp.user_id);
  }
  await db()
    .from("term_results")
    .update({ status: "approved", review_reason: why || null, reviewed_by: admin.id, reviewed_at: new Date().toISOString(), next_grant_id: nextGrantId })
    .eq("id", id);
  await logAudit(admin.id, "results.approved", "term_result", id, { student_id: sp.user_id, next_grant_id: nextGrantId, graduated: !nextGrantId });
  await notify(sp.user_id, "results_approved", { term: termLabel }, "/student");

  if (nextGrantId) {
    // Previous donors hear first, with a one-click renewal on their dashboard.
    const { data: nextGrant } = await db().from("grants").select("term_label").eq("id", nextGrantId).single();
    await notifyMany(await previousDonorIds(sp.user_id), "next_grant_opened", { student: await studentName(sp.user_id), term: nextGrant?.term_label ?? "" }, "/donor");
  }
  revalidatePath("/admin", "layout");
  return done("common.saved");
}

// ───────────── Users ─────────────

export async function setSuspension(_: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const userId = String(form.get("user_id"));
  const suspend = form.get("suspend") === "1";
  const why = reason(form);
  if (userId === admin.id) return fail("common.unknownError");
  if (suspend && !why) return fail("admin.reasonRequired");
  await db().from("profiles").update({ suspended_at: suspend ? new Date().toISOString() : null, suspended_reason: suspend ? why : null }).eq("id", userId);
  await logAudit(admin.id, suspend ? "user.suspended" : "user.reinstated", "user", userId, { reason: why || null });
  if (suspend) await notify(userId, "account_suspended", { reason: why });
  revalidatePath("/admin/users");
  return done("common.saved");
}

/** Student dropped out: close their open grants so platform funds can be refunded or reassigned. */
export async function withdrawStudent(_: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const studentId = String(form.get("user_id"));
  const why = reason(form);
  if (!why) return fail("admin.reasonRequired");
  await db().from("student_profiles").update({ status: "withdrawn" }).eq("user_id", studentId);
  await db().from("grants").update({ status: "cancelled", decision_reason: why }).eq("student_id", studentId).in("status", ["open", "funded", "pending_approval"]);
  await db().from("donations").update({ status: "expired", admin_note: "Student withdrew" }).eq("student_id", studentId).eq("method", "direct").eq("status", "pending").is("proof_submitted_at", null);
  await logAudit(admin.id, "student.withdrawn", "student", studentId, { reason: why });
  revalidatePath("/admin", "layout");
  return done("common.saved");
}

// ───────────── Platform donation refunds & reassignment ─────────────

export async function refundDonation(_: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = String(form.get("donation_id"));
  const why = reason(form);
  if (!why) return fail("admin.reasonRequired");
  const { data: d } = await db().from("donations").select("*").eq("id", id).single<Donation>();
  if (!d || d.method !== "platform" || d.status !== "confirmed" || !d.provider_payment_id) return fail("admin.transactions.onlyPlatform");
  const provider = getPaymentProvider();
  const res = await provider.refund(d.provider_payment_id, Number(d.original_amount), d.original_currency);
  if (!res.ok) return fail("common.unknownError");
  await db().from("payment_attempts").insert({
    donation_id: d.id,
    provider: provider.name,
    provider_payment_id: res.providerRefundId,
    amount: d.original_amount,
    currency: d.original_currency,
    status: "refunded",
  });
  await db().from("donations").update({ status: "refunded", refunded_at: new Date().toISOString(), admin_note: why }).eq("id", id);
  await logAudit(admin.id, "donation.refunded", "donation", id, { amount: d.original_amount, currency: d.original_currency, reason: why, refund_id: res.providerRefundId });
  await notify(d.donor_id, "donation_refunded", { amount: formatMoney(Number(d.original_amount), d.original_currency), reason: why }, "/donor");
  await refreshGrant(d.grant_id);
  revalidatePath("/admin", "layout");
  return done("admin.transactions.refunded");
}

export async function reassignDonation(_: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = String(form.get("donation_id"));
  const targetId = String(form.get("target_grant_id"));
  const why = reason(form);
  if (!why) return fail("admin.reasonRequired");
  const { data: d } = await db().from("donations").select("*").eq("id", id).single<Donation>();
  if (!d || d.method !== "platform" || d.status !== "confirmed") return fail("admin.transactions.onlyPlatform");
  const { data: target } = await db().from("grants").select("*").eq("id", targetId).single<Grant>();
  if (!target || target.status !== "open" || target.id === d.grant_id) return fail("donate.grantClosed");

  const rates = await getRates();
  const rate = crossRate(d.original_currency, target.currency, rates);
  const usdRate = crossRate(target.currency, "USD", rates);
  if (!rate || !usdRate) return fail("donate.rateUnavailable", { currency: d.original_currency });
  const amount = round2(Number(d.original_amount) * rate);
  const settings = await getSettings();
  const { data: progress } = await db().from("grant_progress").select("*").eq("grant_id", target.id).single();
  const remaining = Number(target.target_amount) - Number(progress?.confirmed_amount ?? 0) - Number(progress?.pending_amount ?? 0);
  if (amount > remaining * (1 + settings.overfundTolerancePct / 100)) {
    return fail("donate.exceedsRemaining", { amount: formatMoney(Math.max(0, remaining), target.currency) });
  }

  const fromGrant = d.grant_id;
  await db()
    .from("donations")
    .update({
      grant_id: target.id,
      student_id: target.student_id,
      exchange_rate: rate,
      grant_amount: amount,
      confirmed_amount: amount,
      usd_rate: usdRate,
      reassigned_from_grant_id: fromGrant,
      admin_note: why,
    })
    .eq("id", id);
  await logAudit(admin.id, "donation.reassigned", "donation", id, { from_grant: fromGrant, to_grant: target.id, new_amount: amount, currency: target.currency, reason: why });
  await notify(d.donor_id, "donation_reassigned", { amount: formatMoney(Number(d.original_amount), d.original_currency), student: await studentName(target.student_id), reason: why }, "/donor");
  await refreshGrant(fromGrant);
  await refreshGrant(target.id);
  revalidatePath("/admin", "layout");
  return done("admin.transactions.reassigned");
}

// ───────────── Exchange rates & settings ─────────────

export async function upsertRate(_: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const code = String(form.get("currency_code")).toUpperCase();
  const value = Number(form.get("units_per_usd"));
  if (!/^[A-Z]{3}$/.test(code) || !(value > 0)) return fail("common.unknownError");
  if (code === "USD" && value !== 1) return fail("common.unknownError");
  const { data: before } = await db().from("exchange_rates").select("units_per_usd").eq("currency_code", code).maybeSingle();
  const { error } = await db().from("exchange_rates").upsert({ currency_code: code, units_per_usd: value, source: "manual", updated_at: new Date().toISOString(), updated_by: admin.id });
  if (error) return fail("common.unknownError");
  await logAudit(admin.id, "fx.rate_updated", "exchange_rate", code, { from: before?.units_per_usd ?? null, to: value });
  revalidatePath("/admin/exchange-rates");
  return done("common.saved");
}

export async function fetchLatestRates(_: ActionState, _form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const provider = getExchangeRateProvider();
  const latest = await provider.fetchLatest().catch(() => null);
  if (!latest) return fail("admin.rates.manualOnly");
  const { data: currencies } = await db().from("currencies").select("code");
  const now = new Date().toISOString();
  const rows = (currencies ?? [])
    .filter((c) => latest[c.code] > 0)
    .map((c) => ({ currency_code: c.code, units_per_usd: latest[c.code], source: provider.name, updated_at: now, updated_by: admin.id }));
  const { error } = await db().from("exchange_rates").upsert(rows);
  if (error) return fail("common.unknownError");
  await logAudit(admin.id, "fx.rates_fetched", "exchange_rate", null, { provider: provider.name, count: rows.length });
  revalidatePath("/admin/exchange-rates");
  return done("admin.rates.fetched", { count: rows.length });
}

export async function updateSettings(_: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const before = await getSettings();
  const numeric = { pledgeHoldDays: [1, 90], pledgeReminderDays: [0, 30], overfundTolerancePct: [0, 20] } as const;
  const updates: { key: string; value: unknown }[] = [];
  for (const [field, [min, max]] of Object.entries(numeric) as [keyof typeof numeric, readonly [number, number]][]) {
    const v = Number(form.get(field));
    if (!Number.isFinite(v) || v < min || v > max) return fail("common.unknownError");
    updates.push({ key: SETTING_KEYS[field], value: v });
  }
  const consentVersion = String(form.get("consentVersion") ?? "").trim();
  if (consentVersion) updates.push({ key: SETTING_KEYS.consentVersion, value: consentVersion });
  for (const u of updates) {
    await db().from("app_settings").update({ value: u.value, updated_at: new Date().toISOString(), updated_by: admin.id }).eq("key", u.key);
  }
  await logAudit(admin.id, "settings.updated", "settings", null, { before, after: Object.fromEntries(updates.map((u) => [u.key, u.value])) });
  revalidatePath("/admin/settings");
  return done("common.saved");
}

// ───────────── Moderation ─────────────

export async function resolveReport(_: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = String(form.get("report_id"));
  const status = form.get("status") === "dismissed" ? "dismissed" : "resolved";
  const note = String(form.get("note") ?? "").trim() || null;
  await db().from("message_reports").update({ status, resolution_note: note, resolved_by: admin.id, resolved_at: new Date().toISOString() }).eq("id", id);
  await logAudit(admin.id, `report.${status}`, "message_report", id, { note });
  revalidatePath("/admin/reports");
  return done("common.saved");
}

export async function setMessageHidden(_: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = String(form.get("message_id"));
  const hidden = form.get("hidden") === "1";
  await db().from("messages").update({ hidden, flagged: hidden ? true : false }).eq("id", id);
  await logAudit(admin.id, hidden ? "message.hidden" : "message.cleared", "message", id);
  revalidatePath("/admin/reports");
  return done("common.saved");
}

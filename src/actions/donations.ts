"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole, type CurrentUser } from "@/lib/auth";
import { db } from "@/lib/supabase/admin";
import { getRates, crossRate } from "@/lib/fx";
import { getPaymentProvider, type ChargeFailureCode, type PaymentMethodInput } from "@/lib/payments";
import { isFile, uploadPrivateDocument, UploadError } from "@/lib/files";
import { notify, notifyMany, adminIds } from "@/lib/notifications";
import { refreshGrant } from "@/lib/grants";
import { formatMoney, round2 } from "@/lib/format";
import { getT } from "@/i18n/server";
import { fail, done, type ActionState } from "@/lib/action-state";
import type { Donation, DonationMethod, Grant } from "@/types/db";

async function loadOpenGrant(grantId: string, user: CurrentUser): Promise<Grant | ActionState> {
  const { data: grant } = await db().from("grants").select("*").eq("id", grantId).maybeSingle<Grant>();
  if (!grant || grant.status !== "open") return fail("donate.grantClosed");
  if (grant.student_id === user.id) return fail("donate.ownGrant");
  const { data: sp } = await db().from("student_profiles").select("verification_status, status").eq("user_id", grant.student_id).single();
  if (sp?.verification_status !== "verified" || sp.status !== "active") return fail("donate.grantClosed");
  return grant;
}

/** Reserve part of a grant atomically (see reserve_donation in SQL). */
async function reserve(opts: {
  grant: Grant;
  donorId: string;
  method: DonationMethod;
  originalAmount: number;
  originalCurrency: string;
  anonymous: boolean;
  provider?: string;
}): Promise<Donation | ActionState> {
  const rates = await getRates();
  const rate = crossRate(opts.originalCurrency, opts.grant.currency, rates);
  const usdRate = crossRate(opts.grant.currency, "USD", rates);
  if (rate === null || usdRate === null) return fail("donate.rateUnavailable", { currency: opts.originalCurrency });
  const grantAmount = round2(opts.originalAmount * rate);
  if (grantAmount <= 0) return fail("common.unknownError");

  const { data, error } = await db().rpc("reserve_donation", {
    p_grant_id: opts.grant.id,
    p_donor_id: opts.donorId,
    p_method: opts.method,
    p_original_amount: round2(opts.originalAmount),
    p_original_currency: opts.originalCurrency,
    p_exchange_rate: rate,
    p_grant_amount: grantAmount,
    p_usd_rate: usdRate,
    p_anonymous: opts.anonymous,
    p_provider: opts.provider ?? null,
  });
  if (error) {
    const match = /exceeds_remaining:([\d.]+)/.exec(error.message);
    if (match) {
      const remainingInOriginal = Number(match[1]) / rate;
      return fail("donate.exceedsRemaining", { amount: formatMoney(Math.floor(remainingInOriginal * 100) / 100, opts.originalCurrency) });
    }
    if (error.message.includes("grant_not_open")) return fail("donate.grantClosed");
    return fail("common.unknownError");
  }
  return data as Donation;
}

const isState = (x: unknown): x is ActionState => typeof x === "object" && x !== null && ("error" in x || "ok" in x);

/** Charge the donor through the payment provider, then confirm or reject the reservation. */
async function chargeReservation(user: CurrentUser, donation: Donation, grant: Grant, paymentMethod: PaymentMethodInput, saveCard: boolean): Promise<ActionState> {
  const provider = getPaymentProvider();
  const t = await getT();
  const { data: student } = await db().from("profiles").select("full_name").eq("id", grant.student_id).single();
  const result = await provider.charge({
    amount: Number(donation.original_amount),
    currency: donation.original_currency,
    paymentMethod,
    description: `FundMyDegree grant ${grant.id}`,
    idempotencyKey: donation.id,
    savePaymentMethod: saveCard,
    metadata: { donation_id: donation.id, grant_id: grant.id },
  });
  await db().from("payment_attempts").insert({
    donation_id: donation.id,
    provider: provider.name,
    provider_payment_id: result.ok ? result.providerPaymentId : null,
    amount: donation.original_amount,
    currency: donation.original_currency,
    status: result.ok ? "succeeded" : "failed",
    failure_code: result.ok ? null : result.code,
    raw: result.raw ?? null,
  });
  const amountLabel = formatMoney(Number(donation.original_amount), donation.original_currency);
  const params = { amount: amountLabel, student: student?.full_name ?? "" };

  if (!result.ok) {
    await db().from("donations").update({ status: "rejected", failure_reason: result.code }).eq("id", donation.id);
    const reason = t(`payment.failure.${result.code as ChargeFailureCode}`);
    await notify(user.id, "payment_failed", { ...params, reason }, `/students/${grant.student_id}`);
    revalidatePath(`/students/${grant.student_id}`);
    return fail("payment.failed", { reason });
  }

  await db()
    .from("donations")
    .update({ status: "confirmed", confirmed_amount: donation.grant_amount, provider_payment_id: result.providerPaymentId, reviewed_at: new Date().toISOString() })
    .eq("id", donation.id);
  if (result.savedToken) {
    await db().from("saved_payment_methods").upsert(
      { user_id: user.id, provider: provider.name, token: result.savedToken, brand: result.brand ?? null, last4: result.last4 ?? null },
      { onConflict: "user_id,provider,token" },
    );
  }
  await notify(user.id, "payment_succeeded", params, "/donor");
  await refreshGrant(grant.id);
  revalidatePath(`/students/${grant.student_id}`);
  revalidatePath("/donor");
  return done("payment.successBody", { amount: amountLabel, name: student?.full_name ?? "" }, { donationId: donation.id });
}

const platformSchema = z.object({
  grant_id: z.string().uuid(),
  amount: z.coerce.number().positive().max(1e9),
  currency: z.string().length(3),
  anonymous: z.string().optional(),
  save_card: z.string().optional(),
  saved_method_id: z.string().uuid().optional().or(z.literal("")),
  card_number: z.string().optional(),
  expiry: z.string().optional(),
  cvc: z.string().optional(),
  holder: z.string().optional(),
});

export async function donateThroughPlatform(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireRole("donor");
  const parsed = platformSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return fail("common.unknownError");
  const v = parsed.data;

  const provider = getPaymentProvider();
  if (!provider.supportsCurrency(v.currency)) {
    const t = await getT();
    return fail("payment.failed", { reason: t("payment.failure.unsupported_currency") });
  }

  let paymentMethod: PaymentMethodInput;
  if (v.saved_method_id) {
    const { data: saved } = await db().from("saved_payment_methods").select("token").eq("id", v.saved_method_id).eq("user_id", user.id).maybeSingle();
    if (!saved) return fail("common.unknownError");
    paymentMethod = { type: "saved", token: saved.token };
  } else {
    const [mm, yy] = (v.expiry ?? "").split("/").map((s) => Number(s.trim()));
    paymentMethod = {
      type: "card",
      cardNumber: v.card_number ?? "",
      expMonth: mm || 0,
      expYear: yy ? (yy < 100 ? 2000 + yy : yy) : 0,
      cvc: v.cvc ?? "",
      holderName: v.holder ?? "",
    };
  }

  const grant = await loadOpenGrant(v.grant_id, user);
  if (isState(grant)) return grant;
  const donation = await reserve({
    grant,
    donorId: user.id,
    method: "platform",
    originalAmount: v.amount,
    originalCurrency: v.currency,
    anonymous: v.anonymous === "on",
    provider: provider.name,
  });
  if (isState(donation)) return donation;
  return chargeReservation(user, donation, grant, paymentMethod, v.save_card === "on");
}

const pledgeSchema = z.object({
  grant_id: z.string().uuid(),
  amount: z.coerce.number().positive().max(1e10),
  anonymous: z.string().optional(),
});

export async function pledgeDirectPayment(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireRole("donor");
  const parsed = pledgeSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return fail("common.unknownError");
  const grant = await loadOpenGrant(parsed.data.grant_id, user);
  if (isState(grant)) return grant;
  // Direct pledges are made in the university's currency: that's what the donor transfers.
  const donation = await reserve({
    grant,
    donorId: user.id,
    method: "direct",
    originalAmount: parsed.data.amount,
    originalCurrency: grant.currency,
    anonymous: parsed.data.anonymous === "on",
  });
  if (isState(donation)) return donation;
  revalidatePath(`/students/${grant.student_id}`);
  redirect(`/donor/pledges/${donation.id}?new=1`);
}

const proofSchema = z.object({
  donation_id: z.string().uuid(),
  reference: z.string().trim().min(2).max(120),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.coerce.number().positive().max(1e10),
  currency: z.string().length(3),
});

export async function submitPaymentProof(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireRole("donor");
  const parsed = proofSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return fail("common.unknownError");
  const v = parsed.data;
  const { data: d } = await db().from("donations").select("*").eq("id", v.donation_id).eq("donor_id", user.id).maybeSingle<Donation>();
  if (!d || d.method !== "direct" || d.status !== "pending" || d.proof_submitted_at) return fail("common.unknownError");
  if (d.pledge_expires_at && new Date(d.pledge_expires_at) <= new Date()) return fail("pledge.expired");

  const file = form.get("file");
  if (!isFile(file)) return fail("documents.uploadFailed");
  let docId: string;
  try {
    docId = (await uploadPrivateDocument({ file, ownerId: user.id, type: "payment_proof" })).id;
  } catch (e) {
    return fail(e instanceof UploadError && e.code === "too_large" ? "documents.tooLarge" : e instanceof UploadError && e.code === "bad_type" ? "documents.badType" : "documents.uploadFailed");
  }
  const { error } = await db()
    .from("donations")
    .update({
      proof_document_id: docId,
      proof_reference: v.reference,
      proof_date: v.date,
      proof_amount: v.amount,
      proof_currency: v.currency,
      proof_submitted_at: new Date().toISOString(),
    })
    .eq("id", d.id)
    .eq("status", "pending")
    .is("proof_submitted_at", null);
  if (error) return fail("common.unknownError");
  await notifyMany(await adminIds(), "proof_submitted", { amount: formatMoney(v.amount, v.currency) }, "/admin/proofs");
  revalidatePath("/donor", "layout");
  return done("pledge.proofSubmitted");
}

export async function cancelPledge(form: FormData) {
  const user = await requireRole("donor");
  const id = String(form.get("donation_id"));
  await db()
    .from("donations")
    .update({ status: "expired", admin_note: "Cancelled by donor" })
    .eq("id", id)
    .eq("donor_id", user.id)
    .eq("method", "direct")
    .eq("status", "pending")
    .is("proof_submitted_at", null);
  revalidatePath("/donor", "layout");
  redirect("/donor");
}

/**
 * One-click renewal for a previous supporter: same amount, currency and
 * method on the student's newest open grant, capped to what it still needs.
 */
export async function renewSupport(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireRole("donor");
  const previousId = String(form.get("donation_id"));
  const grantId = String(form.get("grant_id"));
  const { data: prev } = await db().from("donations").select("*").eq("id", previousId).eq("donor_id", user.id).maybeSingle<Donation>();
  if (!prev || !["confirmed", "disbursed"].includes(prev.status)) return fail("common.unknownError");
  const grant = await loadOpenGrant(grantId, user);
  if (isState(grant)) return grant;
  if (grant.student_id !== prev.student_id) return fail("common.unknownError");

  const { data: progress } = await db().from("grant_progress").select("*").eq("grant_id", grant.id).single();
  const remaining = Number(grant.target_amount) - Number(progress?.confirmed_amount ?? 0) - Number(progress?.pending_amount ?? 0);
  const rates = await getRates();
  const rate = crossRate(prev.original_currency, grant.currency, rates);
  if (rate === null) return fail("donate.rateUnavailable", { currency: prev.original_currency });
  const amount = Math.min(Number(prev.original_amount), Math.floor((remaining / rate) * 100) / 100);
  if (amount <= 0) return fail("donate.grantClosed");

  if (prev.method === "direct") {
    const donation = await reserve({ grant, donorId: user.id, method: "direct", originalAmount: round2(amount * rate), originalCurrency: grant.currency, anonymous: prev.anonymous });
    if (isState(donation)) return donation;
    redirect(`/donor/pledges/${donation.id}?new=1`);
  }

  const provider = getPaymentProvider();
  const { data: saved } = await db()
    .from("saved_payment_methods")
    .select("token")
    .eq("user_id", user.id)
    .eq("provider", provider.name)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!saved) redirect(`/donate/${grant.id}?amount=${amount}&currency=${prev.original_currency}`);
  const donation = await reserve({ grant, donorId: user.id, method: "platform", originalAmount: amount, originalCurrency: prev.original_currency, anonymous: prev.anonymous, provider: provider.name });
  if (isState(donation)) return donation;
  const result = await chargeReservation(user, donation, grant, { type: "saved", token: saved.token }, false);
  if (!result.ok) return result;
  redirect("/donor?renewed=1");
}

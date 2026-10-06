"use server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { getSettings } from "@/lib/settings";
import { dashboardPath } from "@/lib/auth";
import { fail, done, type ActionState } from "@/lib/action-state";

function safeNext(next: FormDataEntryValue | null): string | null {
  const s = typeof next === "string" ? next : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : null;
}

export async function signIn(_: ActionState, form: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: String(form.get("email") ?? "").trim(),
    password: String(form.get("password") ?? ""),
  });
  if (error || !data.user) return fail("auth.invalidCredentials");
  const next = safeNext(form.get("next"));
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
    redirect(`/mfa${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  }
  const { data: profile } = await db().from("profiles").select("role").eq("id", data.user.id).single();
  redirect(next ?? dashboardPath(profile?.role ?? "donor"));
}

const signUpSchema = z.object({
  role: z.enum(["student", "donor"]),
  full_name: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  password: z.string().min(10).max(200),
  country_code: z.string().length(2),
  preferred_currency: z.string().length(3),
  timezone: z.string().max(64).optional(),
  terms: z.literal("on"),
  privacy: z.literal("on"),
  data_processing: z.literal("on"),
  marketing: z.string().optional(),
});

export async function signUp(_: ActionState, form: FormData): Promise<ActionState> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => i.path[0]);
    if (fields.some((f) => f === "terms" || f === "privacy" || f === "data_processing")) return fail("auth.consentRequired");
    if (fields.includes("password")) return fail("auth.weakPassword");
    return fail("common.unknownError");
  }
  const v = parsed.data;
  const settings = await getSettings();
  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? env.siteUrl();
  const { data, error } = await supabase.auth.signUp({
    email: v.email,
    password: v.password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      data: {
        role: v.role,
        full_name: v.full_name,
        country_code: v.country_code,
        preferred_currency: v.preferred_currency,
        timezone: v.timezone || "UTC",
        locale: "en",
        consent_version: settings.consentVersion,
        consents: { terms: true, privacy: true, data_processing: true, marketing: v.marketing === "on" },
      },
    },
  });
  if (error) return fail(error.message.toLowerCase().includes("registered") ? "auth.emailTaken" : "common.unknownError");
  if (data.session) redirect(v.role === "student" ? "/student/profile" : "/students");
  return done("auth.checkEmailBody", { email: v.email });
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function requestPasswordReset(_: ActionState, form: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? env.siteUrl();
  await supabase.auth.resetPasswordForEmail(String(form.get("email") ?? "").trim(), {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });
  return done("auth.resetSent");
}

export async function updatePassword(_: ActionState, form: FormData): Promise<ActionState> {
  const password = String(form.get("password") ?? "");
  if (password.length < 10) return fail("auth.weakPassword");
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return fail("common.unknownError");
  return done("auth.passwordUpdated");
}

export async function verifyMfa(_: ActionState, form: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const factor = factors?.totp.find((f) => f.status === "verified");
  if (!factor) redirect("/dashboard");
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: String(form.get("code") ?? "").trim() });
  if (error) return fail("auth.mfaInvalid");
  redirect(safeNext(form.get("next")) ?? "/dashboard");
}

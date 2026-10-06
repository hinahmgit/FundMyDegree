"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { deleteUserAccount, hasFundsInFlight } from "@/lib/privacy";
import { isFile, uploadAvatar, UploadError } from "@/lib/files";
import { safeTimeZone } from "@/lib/format";
import { fail, done, type ActionState } from "@/lib/action-state";

const prefsSchema = z.object({
  full_name: z.string().trim().min(2).max(120),
  country_code: z.string().length(2),
  preferred_currency: z.string().length(3),
  timezone: z.string().max(64),
  locale: z.string().max(10),
  marketing: z.string().optional(),
});

export async function updatePreferences(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = prefsSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return fail("common.unknownError");
  const v = parsed.data;
  const update: Record<string, unknown> = {
    full_name: v.full_name,
    country_code: v.country_code,
    preferred_currency: v.preferred_currency,
    timezone: safeTimeZone(v.timezone),
    locale: v.locale,
  };
  const avatar = form.get("avatar");
  if (isFile(avatar)) {
    try {
      update.avatar_path = await uploadAvatar(user.id, avatar);
    } catch (e) {
      return fail(e instanceof UploadError && e.code === "too_large" ? "documents.tooLarge" : "documents.badType");
    }
  }
  await db().from("profiles").update(update).eq("id", user.id);

  // Record a change to optional marketing consent.
  const { data: last } = await db().from("consents").select("granted, version").eq("user_id", user.id).eq("kind", "marketing").order("created_at", { ascending: false }).limit(1).maybeSingle();
  const wants = v.marketing === "on";
  if (!last || last.granted !== wants) {
    await db().from("consents").insert({ user_id: user.id, kind: "marketing", version: last?.version ?? "1", granted: wants });
  }
  (await cookies()).set("locale", v.locale, { path: "/", maxAge: 31536000, sameSite: "lax" });
  revalidatePath("/", "layout");
  return done("common.saved");
}

export async function deleteAccount(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (form.get("confirm") !== "DELETE") return fail("settings.deleteConfirmLabel");
  if (user.profile.role === "admin") return fail("errors.forbidden");
  if (await hasFundsInFlight(user.id)) return fail("settings.deleteBlocked");
  await deleteUserAccount(user.id);
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

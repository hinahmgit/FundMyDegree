import "server-only";
import { db } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { getEmailProvider, renderEmail } from "@/lib/email";
import { getTFor } from "@/i18n/server";
import type { MessageKey } from "@/i18n/translate";

/** Every notification type. Each has `notifications.<type>.title/body` messages. */
export const NOTIFICATION_TYPES = [
  "verification_approved",
  "verification_rejected",
  "university_approved",
  "university_rejected",
  "pledge_reminder",
  "pledge_expired",
  "proof_submitted",
  "proof_confirmed",
  "proof_rejected",
  "payment_succeeded",
  "payment_failed",
  "grant_funded",
  "paid_to_university",
  "results_posted",
  "results_approved",
  "results_rejected",
  "next_grant_opened",
  "student_update",
  "donation_refunded",
  "donation_reassigned",
  "new_message",
  "account_suspended",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** Types that also send an email (the rest are in-app only). */
const EMAILED: ReadonlySet<NotificationType> = new Set([
  "verification_approved",
  "verification_rejected",
  "university_approved",
  "university_rejected",
  "pledge_reminder",
  "pledge_expired",
  "proof_confirmed",
  "proof_rejected",
  "payment_failed",
  "grant_funded",
  "paid_to_university",
  "results_posted",
  "results_approved",
  "results_rejected",
  "next_grant_opened",
  "donation_refunded",
  "donation_reassigned",
  "account_suspended",
]);

export type NotifyParams = Record<string, string | number>;

/**
 * Create an in-app notification and, for important events, send an email in
 * the recipient's language. Failures to email never break the calling action.
 */
export async function notify(userId: string | null | undefined, type: NotificationType, params: NotifyParams = {}, link?: string) {
  if (!userId) return;
  const { data: row } = await db()
    .from("notifications")
    .insert({ user_id: userId, type, params, link: link ?? null })
    .select("id")
    .single();
  if (!EMAILED.has(type)) return;

  try {
    const { data: profile } = await db().from("profiles").select("email, locale, full_name, deleted_at").eq("id", userId).single();
    if (!profile?.email || profile.deleted_at) return;
    const t = getTFor(profile.locale);
    const vars = { name: profile.full_name || "", ...params };
    const { html, text } = renderEmail({
      heading: t(`notifications.${type}.title` as MessageKey, vars),
      body: t(`notifications.${type}.body` as MessageKey, vars),
      ctaLabel: t("emails.cta"),
      ctaUrl: link ? new URL(link, env.siteUrl()).toString() : undefined,
      footer: t("emails.footer"),
    });
    await getEmailProvider().send({ to: profile.email, subject: t(`notifications.${type}.title` as MessageKey, vars), html, text });
    if (row) await db().from("notifications").update({ emailed_at: new Date().toISOString() }).eq("id", row.id);
  } catch (err) {
    console.error(`[notify] email failed for ${type} → ${userId}`, err);
  }
}

export async function notifyMany(userIds: (string | null | undefined)[], type: NotificationType, params: NotifyParams = {}, link?: string) {
  const unique = [...new Set(userIds.filter((id): id is string => !!id))];
  await Promise.all(unique.map((id) => notify(id, type, params, link)));
}

export async function adminIds(): Promise<string[]> {
  const { data } = await db().from("profiles").select("id").eq("role", "admin").is("suspended_at", null);
  return (data ?? []).map((r) => r.id as string);
}

import "server-only";
import { db } from "@/lib/supabase/admin";
import { PRIVATE_BUCKET, AVATAR_BUCKET } from "@/lib/files";

/** Everything stored about a user (GDPR right of access / portability). */
export async function exportUserData(userId: string) {
  const q = (table: string, column: string) => db().from(table).select("*").eq(column, userId).then((r) => r.data ?? []);
  const [profile, consents, student, fees, documents, grants, donations, results, updates, notifications, savedMethods, blocks, reports] = await Promise.all([
    db().from("profiles").select("*").eq("id", userId).maybeSingle().then((r) => r.data),
    q("consents", "user_id"),
    db().from("student_profiles").select("*").eq("user_id", userId).maybeSingle().then((r) => r.data),
    q("term_fees", "student_id"),
    db().from("documents").select("id, type, file_name, mime_type, size_bytes, created_at").eq("owner_id", userId).then((r) => r.data ?? []),
    q("grants", "student_id"),
    q("donations", "donor_id"),
    q("term_results", "student_id"),
    q("student_updates", "student_id"),
    q("notifications", "user_id"),
    db().from("saved_payment_methods").select("provider, brand, last4, created_at").eq("user_id", userId).then((r) => r.data ?? []),
    q("user_blocks", "blocker_id"),
    q("message_reports", "reporter_id"),
  ]);
  const { data: conversations } = await db().from("conversations").select("*").or(`donor_id.eq.${userId},student_id.eq.${userId}`);
  const { data: messages } = await db().from("messages").select("conversation_id, kind, body, created_at").eq("sender_id", userId);
  return {
    exported_at: new Date().toISOString(),
    profile,
    consents,
    student_profile: student,
    term_fees: fees,
    documents,
    grants,
    donations_made: donations,
    term_results: results,
    updates,
    conversations: conversations ?? [],
    messages_sent: messages ?? [],
    notifications,
    saved_payment_methods: savedMethods,
    blocks,
    reports_filed: reports,
  };
}

/** True if deleting now would orphan money held or pending for the student. */
export async function hasFundsInFlight(userId: string): Promise<boolean> {
  const { data: grants } = await db().from("grants").select("id").eq("student_id", userId).in("status", ["open", "funded"]);
  const ids = (grants ?? []).map((g) => g.id);
  if (!ids.length) return false;
  const { count } = await db().from("donations").select("id", { count: "exact", head: true }).in("grant_id", ids).in("status", ["pending", "confirmed"]);
  return (count ?? 0) > 0;
}

/**
 * Right to erasure. Personal data is deleted or anonymised. Financial records
 * (donations, payment proofs, university receipts) are retained without
 * identifying details, as required for accounting.
 */
export async function deleteUserAccount(userId: string) {
  const now = new Date().toISOString();

  // Release any live direct pledges.
  await db().from("donations").update({ status: "expired", admin_note: "Donor deleted account" }).eq("donor_id", userId).eq("status", "pending").eq("method", "direct");
  await db().from("donations").update({ anonymous: true }).eq("donor_id", userId);

  // Remove identity documents and transcripts; keep financial records.
  const { data: docs } = await db().from("documents").select("id, storage_path, type").eq("owner_id", userId);
  const personal = (docs ?? []).filter((d) => ["government_id", "enrollment_proof", "transcript", "other"].includes(d.type));
  if (personal.length) {
    await db().storage.from(PRIVATE_BUCKET).remove(personal.map((d) => d.storage_path));
    await db().from("documents").delete().in("id", personal.map((d) => d.id));
  }
  await db().from("documents").update({ owner_id: null }).eq("owner_id", userId);

  const { data: avatars } = await db().storage.from(AVATAR_BUCKET).list(userId);
  if (avatars?.length) await db().storage.from(AVATAR_BUCKET).remove(avatars.map((a) => `${userId}/${a.name}`));

  await db().from("conversations").delete().or(`donor_id.eq.${userId},student_id.eq.${userId}`);
  await db().from("notifications").delete().eq("user_id", userId);
  await db().from("saved_payment_methods").delete().eq("user_id", userId);
  await db().from("user_blocks").delete().or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);
  await db().from("student_updates").delete().eq("student_id", userId);

  await db()
    .from("student_profiles")
    .update({ story: null, student_number: null, photo_path: null, status: "withdrawn" })
    .eq("user_id", userId);
  await db().from("grants").update({ status: "cancelled", decision_reason: "Account deleted" }).eq("student_id", userId).in("status", ["open", "pending_approval"]);
  await db()
    .from("profiles")
    .update({ full_name: "Deleted user", email: null, avatar_path: null, deleted_at: now })
    .eq("id", userId);

  // Soft-delete in Supabase Auth: sign-in is disabled and the email is scrubbed,
  // while the id remains so retained financial records stay consistent.
  await db().auth.admin.deleteUser(userId, true);
}

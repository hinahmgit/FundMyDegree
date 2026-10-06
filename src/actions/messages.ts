"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/supabase/admin";
import { moderateMessage } from "@/lib/moderation";
import { getConversationFor, hasConfirmedDonation, isBlocked, otherParty } from "@/lib/messaging";
import { notify } from "@/lib/notifications";
import { fail, done, type ActionState } from "@/lib/action-state";
import type { Conversation, StudentUpdate, TermResult } from "@/types/db";

/** Donor opens (or reuses) a conversation with a student they've funded. */
export async function openConversation(form: FormData) {
  const user = await requireUser();
  const studentId = String(form.get("student_id"));
  if (user.profile.role !== "donor") redirect("/messages");
  if (!(await hasConfirmedDonation(user.id, studentId))) redirect("/messages?error=notAllowed");
  const { data: existing } = await db().from("conversations").select("id").eq("donor_id", user.id).eq("student_id", studentId).maybeSingle();
  if (existing) redirect(`/messages/${existing.id}`);
  const { data: created } = await db().from("conversations").insert({ donor_id: user.id, student_id: studentId }).select("id").single();
  redirect(`/messages/${created!.id}`);
}

async function guard(userId: string, conversationId: string): Promise<Conversation | ActionState> {
  const c = await getConversationFor(userId, conversationId);
  if (!c) return fail("errors.forbidden");
  if (!(await hasConfirmedDonation(c.donor_id, c.student_id))) return fail("messages.notAllowed");
  const blocks = await isBlocked(userId, otherParty(c, userId));
  if (blocks.byMe) return fail("messages.blocked");
  if (blocks.byThem) return fail("messages.blockedByOther");
  return c;
}

async function insertMessage(c: Conversation, senderId: string, senderName: string, body: string, kind: "text" | "result" | "update", refId: string | null, flagReasons: string[] = []) {
  await db().from("messages").insert({ conversation_id: c.id, sender_id: senderId, body, kind, ref_id: refId, flagged: flagReasons.length > 0, flag_reasons: flagReasons });
  await db().from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", c.id);
  await notify(otherParty(c, senderId), "new_message", { from: senderName }, `/messages/${c.id}`);
  revalidatePath(`/messages/${c.id}`);
}

export async function sendMessage(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const body = String(form.get("body") ?? "").trim();
  if (!body || body.length > 4000) return fail("common.unknownError");
  const c = await guard(user.id, String(form.get("conversation_id")));
  if ("error" in c) return c as ActionState;
  const verdict = moderateMessage(body);
  if (verdict.block) return fail("messages.blockedContent");
  // Donors who give anonymously stay anonymous in the student's view too.
  await insertMessage(c as Conversation, user.id, user.profile.full_name, body, "text", null, verdict.reasons);
  return done();
}

/** Student shares their latest results or update into a conversation. */
export async function shareProgress(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (user.profile.role !== "student") return fail("errors.forbidden");
  const c = await guard(user.id, String(form.get("conversation_id")));
  if ("error" in c) return c as ActionState;
  const kind = form.get("kind") === "result" ? "result" : "update";
  if (kind === "result") {
    const { data: r } = await db().from("term_results").select("*").eq("student_id", user.id).order("term_number", { ascending: false }).limit(1).maybeSingle<TermResult>();
    if (!r) return fail("common.noResults");
    const gpa = r.gpa !== null ? `GPA ${r.gpa}${r.gpa_scale ? ` / ${r.gpa_scale}` : ""}` : "";
    await insertMessage(c as Conversation, user.id, user.profile.full_name, [`Term ${r.term_number}`, gpa, r.summary].filter(Boolean).join(" — "), "result", r.id);
  } else {
    const { data: u } = await db().from("student_updates").select("*").eq("student_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle<StudentUpdate>();
    if (!u) return fail("common.noResults");
    await insertMessage(c as Conversation, user.id, user.profile.full_name, u.body.slice(0, 4000), "update", u.id);
  }
  return done();
}

export async function reportMessage(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const reason = String(form.get("reason") ?? "").trim();
  if (!reason) return fail("admin.reasonRequired");
  const c = await getConversationFor(user.id, String(form.get("conversation_id")));
  if (!c) return fail("errors.forbidden");
  const messageId = String(form.get("message_id") ?? "") || null;
  if (messageId) {
    const { data: m } = await db().from("messages").select("conversation_id").eq("id", messageId).maybeSingle();
    if (m?.conversation_id !== c.id) return fail("errors.forbidden");
  }
  await db().from("message_reports").insert({ message_id: messageId, conversation_id: c.id, reporter_id: user.id, reported_user_id: otherParty(c, user.id), reason: reason.slice(0, 1000) });
  return done("messages.reported");
}

export async function toggleBlock(form: FormData) {
  const user = await requireUser();
  const c = await getConversationFor(user.id, String(form.get("conversation_id")));
  if (!c) redirect("/messages");
  const other = otherParty(c, user.id);
  const { byMe } = await isBlocked(user.id, other);
  if (byMe) await db().from("user_blocks").delete().eq("blocker_id", user.id).eq("blocked_id", other);
  else await db().from("user_blocks").insert({ blocker_id: user.id, blocked_id: other });
  revalidatePath(`/messages/${c.id}`);
}

export async function markNotificationsRead() {
  const user = await requireUser();
  await db().from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
  revalidatePath("/", "layout");
}

import "server-only";
import { db } from "@/lib/supabase/admin";
import type { Conversation } from "@/types/db";

/** Messaging opens once the donor has a confirmed donation for the student. */
export async function hasConfirmedDonation(donorId: string, studentId: string): Promise<boolean> {
  const { count } = await db()
    .from("donations")
    .select("id", { count: "exact", head: true })
    .eq("donor_id", donorId)
    .eq("student_id", studentId)
    .in("status", ["confirmed", "disbursed"]);
  return (count ?? 0) > 0;
}

export async function isBlocked(a: string, b: string): Promise<{ byMe: boolean; byThem: boolean }> {
  const { data } = await db().from("user_blocks").select("blocker_id, blocked_id").or(`and(blocker_id.eq.${a},blocked_id.eq.${b}),and(blocker_id.eq.${b},blocked_id.eq.${a})`);
  return { byMe: !!data?.some((r) => r.blocker_id === a), byThem: !!data?.some((r) => r.blocker_id === b) };
}

export async function getConversationFor(userId: string, id: string): Promise<Conversation | null> {
  const { data } = await db().from("conversations").select("*").eq("id", id).maybeSingle<Conversation>();
  if (!data || (data.donor_id !== userId && data.student_id !== userId)) return null;
  return data;
}

export function otherParty(c: Conversation, userId: string) {
  return c.donor_id === userId ? c.student_id : c.donor_id;
}

/** Name shown to the other side: donors who only ever gave anonymously stay "Anonymous". */
export async function displayNames(c: Conversation): Promise<{ donor: string | null; student: string }> {
  const [{ data: people }, { count }] = await Promise.all([
    db().from("profiles").select("id, full_name").in("id", [c.donor_id, c.student_id]),
    db().from("donations").select("id", { count: "exact", head: true }).eq("donor_id", c.donor_id).eq("student_id", c.student_id).eq("anonymous", false).in("status", ["confirmed", "disbursed"]),
  ]);
  const name = (id: string) => people?.find((p) => p.id === id)?.full_name ?? "";
  return { donor: (count ?? 0) > 0 ? name(c.donor_id) : null, student: name(c.student_id) };
}

import "server-only";
import { db } from "@/lib/supabase/admin";
import { notify } from "@/lib/notifications";
import { getSettings } from "@/lib/settings";
import { formatDateTime, formatMoney } from "@/lib/format";
import type { Donation } from "@/types/db";

async function describe(d: Pick<Donation, "grant_id" | "student_id" | "grant_amount">, donorId: string | null) {
  const [{ data: grant }, { data: student }, { data: donor }] = await Promise.all([
    db().from("grants").select("currency").eq("id", d.grant_id).single(),
    db().from("profiles").select("full_name").eq("id", d.student_id).single(),
    donorId ? db().from("profiles").select("timezone, locale").eq("id", donorId).single() : Promise.resolve({ data: null }),
  ]);
  return {
    amount: formatMoney(Number(d.grant_amount), grant?.currency ?? "USD", donor?.locale ?? "en"),
    student: student?.full_name ?? "",
    timezone: donor?.timezone ?? "UTC",
    locale: donor?.locale ?? "en",
  };
}

/** Expire overdue pledges and send reminders before expiry. Idempotent. */
export async function runScheduledJobs() {
  const settings = await getSettings();

  const { data: expired, error } = await db().rpc("expire_pledges");
  if (error) throw new Error(error.message);
  for (const row of (expired ?? []) as { donation_id: string; donor_id: string | null; grant_id: string }[]) {
    const { data: d } = await db().from("donations").select("grant_id, student_id, grant_amount").eq("id", row.donation_id).single();
    if (!d) continue;
    const info = await describe(d, row.donor_id);
    await notify(row.donor_id, "pledge_expired", { amount: info.amount, student: info.student }, "/donor");
  }

  const soon = new Date(Date.now() + settings.pledgeReminderDays * 86_400_000).toISOString();
  const { data: due } = await db()
    .from("donations")
    .select("id, donor_id, grant_id, student_id, grant_amount, pledge_expires_at")
    .eq("method", "direct")
    .eq("status", "pending")
    .is("proof_submitted_at", null)
    .is("reminder_sent_at", null)
    .lte("pledge_expires_at", soon)
    .gt("pledge_expires_at", new Date().toISOString());
  for (const d of due ?? []) {
    const info = await describe(d, d.donor_id);
    await notify(
      d.donor_id,
      "pledge_reminder",
      { amount: info.amount, student: info.student, date: formatDateTime(d.pledge_expires_at, info.timezone, info.locale) },
      `/donor/pledges/${d.id}`,
    );
    await db().from("donations").update({ reminder_sent_at: new Date().toISOString() }).eq("id", d.id);
  }

  return { expired: (expired ?? []).length, reminded: (due ?? []).length };
}

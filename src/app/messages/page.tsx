import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getT } from "@/i18n/server";
import { getFormatter } from "@/lib/server-format";
import { db } from "@/lib/supabase/admin";
import { displayNames, hasConfirmedDonation } from "@/lib/messaging";
import { Alert, Card, EmptyState, PageHeader } from "@/components/ui";
import { openConversation } from "@/actions/messages";
import type { Conversation } from "@/types/db";

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ with?: string; error?: string }> }) {
  const user = await requireUser();
  const [t, f, sp] = await Promise.all([getT(), getFormatter(), searchParams]);
  const { data } = await db()
    .from("conversations")
    .select("*")
    .or(`donor_id.eq.${user.id},student_id.eq.${user.id}`)
    .order("last_message_at", { ascending: false, nullsFirst: false });
  const convos = (data ?? []) as Conversation[];
  const names = await Promise.all(convos.map((c) => displayNames(c)));
  const canStart = sp.with && user.profile.role === "donor" && !convos.some((c) => c.student_id === sp.with) && (await hasConfirmedDonation(user.id, sp.with));
  const { data: target } = canStart ? await db().from("profiles").select("full_name").eq("id", sp.with!).single() : { data: null };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t("messages.title")} />
      {sp.error === "notAllowed" && <div className="mb-4"><Alert tone="warn">{t("messages.notAllowed")}</Alert></div>}
      {canStart && (
        <Card className="mb-4">
          <form action={openConversation} className="flex items-center justify-between gap-3">
            <input type="hidden" name="student_id" value={sp.with} />
            <span className="font-medium">{target?.full_name}</span>
            <button className="btn-primary">{t("messages.startConversation")}</button>
          </form>
        </Card>
      )}
      {convos.length ? (
        <Card className="p-0 sm:p-0">
          <ul className="divide-y divide-stone-100">
            {convos.map((c, i) => {
              const other = c.donor_id === user.id ? names[i].student : (names[i].donor ?? t("common.anonymous"));
              return (
                <li key={c.id}>
                  <Link href={`/messages/${c.id}`} className="flex items-center justify-between px-5 py-4 hover:bg-stone-50">
                    <span className="font-medium">{other}</span>
                    <span className="text-xs text-stone-500">{c.last_message_at ? f.dateTime(c.last_message_at) : ""}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : (
        <EmptyState>{t("messages.empty")} {user.profile.role === "donor" && t("messages.emptyDonor")}</EmptyState>
      )}
    </div>
  );
}

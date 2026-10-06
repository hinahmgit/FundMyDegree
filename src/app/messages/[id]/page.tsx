import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getT } from "@/i18n/server";
import { getFormatter } from "@/lib/server-format";
import { db } from "@/lib/supabase/admin";
import { displayNames, getConversationFor, hasConfirmedDonation, isBlocked, otherParty } from "@/lib/messaging";
import { Alert, Badge, Card, cn } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/forms";
import { reportMessage, sendMessage, shareProgress, toggleBlock } from "@/actions/messages";
import type { Message } from "@/types/db";
import { AutoRefresh } from "./auto-refresh";

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const [{ id }, t, f] = await Promise.all([params, getT(), getFormatter()]);
  const c = await getConversationFor(user.id, id);
  if (!c) notFound();
  const other = otherParty(c, user.id);
  const [{ data }, names, blocks, allowed] = await Promise.all([
    db().from("messages").select("*").eq("conversation_id", id).order("created_at").limit(500),
    displayNames(c),
    isBlocked(user.id, other),
    hasConfirmedDonation(c.donor_id, c.student_id),
  ]);
  const messages = (data ?? []) as Message[];
  await db().from("messages").update({ read_at: new Date().toISOString() }).eq("conversation_id", id).neq("sender_id", user.id).is("read_at", null);
  const otherName = c.donor_id === user.id ? names.student : (names.donor ?? t("common.anonymous"));
  const canSend = allowed && !blocks.byMe && !blocks.byThem;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <AutoRefresh seconds={15} />
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href="/messages" className="btn-ghost">←</Link>
          <h1 className="text-xl font-semibold">{otherName}</h1>
        </div>
        <form action={toggleBlock}>
          <input type="hidden" name="conversation_id" value={id} />
          <button className="btn-ghost text-sm text-red-600">{blocks.byMe ? t("messages.unblock") : t("messages.block")}</button>
        </form>
      </div>

      <Card className="space-y-3">
        {messages.length === 0 && <p className="text-center text-sm text-stone-400">{t("common.noResults")}</p>}
        {messages.map((m) => {
          const mine = m.sender_id === user.id;
          return (
            <div key={m.id} className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
              <div className={cn("max-w-[85%] rounded-2xl px-4 py-2 text-sm whitespace-pre-line", mine ? "bg-brand-600 text-white" : "bg-stone-100 text-stone-800")}>
                {m.kind !== "text" && <Badge tone={mine ? "neutral" : "trust"}>{m.kind === "result" ? t("messages.shareResult", { term: "" }) : t("messages.shareUpdate")}</Badge>}
                <div className={m.kind !== "text" ? "mt-1" : ""}>{m.hidden ? <em>{t("messages.hidden")}</em> : m.body}</div>
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-[11px] text-stone-400">
                {f.dateTime(m.created_at)}
                {m.flagged && mine && <span className="text-amber-600">· {t("messages.flagged")}</span>}
                {!mine && (
                  <details className="inline">
                    <summary className="cursor-pointer hover:text-red-600">{t("messages.report")}</summary>
                    <ActionForm action={reportMessage} className="mt-1 flex gap-1 space-y-0">
                      <input type="hidden" name="conversation_id" value={id} />
                      <input type="hidden" name="message_id" value={m.id} />
                      <input name="reason" required className="input py-1 text-xs" placeholder={t("messages.reportReason")} />
                      <SubmitButton className="btn-secondary py-1 text-xs">{t("messages.report")}</SubmitButton>
                    </ActionForm>
                  </details>
                )}
              </div>
            </div>
          );
        })}
      </Card>

      {!allowed && <Alert tone="warn">{t("messages.notAllowed")}</Alert>}
      {blocks.byMe && <Alert tone="warn">{t("messages.blocked")}</Alert>}
      {blocks.byThem && !blocks.byMe && <Alert tone="warn">{t("messages.blockedByOther")}</Alert>}
      {canSend && (
        <>
          <ActionForm action={sendMessage} resetOnSuccess className="space-y-2">
            <input type="hidden" name="conversation_id" value={id} />
            <textarea name="body" required maxLength={4000} rows={3} className="input" placeholder={t("messages.placeholder")} />
            <div className="flex justify-end"><SubmitButton>{t("messages.send")}</SubmitButton></div>
          </ActionForm>
          {user.profile.role === "student" && (
            <div className="flex flex-wrap gap-2">
              {(["result", "update"] as const).map((k) => (
                <ActionForm key={k} action={shareProgress} className="space-y-0">
                  <input type="hidden" name="conversation_id" value={id} />
                  <input type="hidden" name="kind" value={k} />
                  <SubmitButton className="btn-secondary text-xs">{k === "result" ? t("messages.shareResult", { term: "" }) : t("messages.shareUpdate")}</SubmitButton>
                </ActionForm>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

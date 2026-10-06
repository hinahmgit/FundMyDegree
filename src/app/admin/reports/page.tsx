import Link from "next/link";
import { getT } from "@/i18n/server";
import { getFormatter } from "@/lib/server-format";
import { db } from "@/lib/supabase/admin";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/forms";
import { resolveReport, setMessageHidden } from "@/actions/admin";
import type { Conversation, Message, MessageReport } from "@/types/db";

export default async function ReportsPage() {
  const [t, f] = await Promise.all([getT(), getFormatter()]);
  const [{ data: reports }, { data: flagged }, { data: convos }] = await Promise.all([
    db().from("message_reports").select("*").eq("status", "open").order("created_at"),
    db().from("messages").select("*").eq("flagged", true).eq("hidden", false).order("created_at", { ascending: false }).limit(100),
    db().from("conversations").select("*").order("last_message_at", { ascending: false, nullsFirst: false }).limit(100),
  ]);
  const reportRows = (reports ?? []) as MessageReport[];
  const flaggedRows = (flagged ?? []) as Message[];
  const convoRows = (convos ?? []) as Conversation[];
  const msgIds = reportRows.map((r) => r.message_id).filter(Boolean) as string[];
  const { data: reportedMsgs } = msgIds.length ? await db().from("messages").select("*").in("id", msgIds) : { data: [] };
  const msgMap = new Map(((reportedMsgs ?? []) as Message[]).map((m) => [m.id, m]));
  const peopleIds = [...new Set([...reportRows.flatMap((r) => [r.reporter_id, r.reported_user_id]), ...flaggedRows.map((m) => m.sender_id), ...convoRows.flatMap((c) => [c.donor_id, c.student_id])].filter(Boolean))] as string[];
  const { data: people } = peopleIds.length ? await db().from("profiles").select("id, full_name").in("id", peopleIds) : { data: [] };
  const name = (id: string | null) => people?.find((p) => p.id === id)?.full_name ?? "—";

  return (
    <div className="space-y-6">
      <PageHeader title={t("admin.reports.title")} />
      <Card title={t("admin.reports.openReports")}>
        {reportRows.length ? (
          <ul className="space-y-4">
            {reportRows.map((r) => {
              const m = r.message_id ? msgMap.get(r.message_id) : undefined;
              return (
                <li key={r.id} className="rounded-xl border border-stone-200 p-4 text-sm">
                  <p><strong>{name(r.reporter_id)}</strong> → {name(r.reported_user_id)} · <span className="text-stone-500">{f.dateTime(r.created_at)}</span></p>
                  <p className="mt-1">{t("common.reason")}: {r.reason}</p>
                  {m && <blockquote className="mt-2 rounded-lg bg-stone-50 p-2 whitespace-pre-line">{m.body}</blockquote>}
                  <div className="mt-3 flex flex-wrap items-start gap-2">
                    <Link href={`/admin/reports/${r.conversation_id}`} className="btn-secondary">{t("admin.reports.viewConversation")}</Link>
                    {m && !m.hidden && (
                      <ActionForm action={setMessageHidden} className="space-y-0">
                        <input type="hidden" name="message_id" value={m.id} />
                        <input type="hidden" name="hidden" value="1" />
                        <SubmitButton className="btn-secondary">{t("admin.reports.hideMessage")}</SubmitButton>
                      </ActionForm>
                    )}
                    <ActionForm action={resolveReport} className="flex gap-2 space-y-0">
                      <input type="hidden" name="report_id" value={r.id} />
                      <input name="note" className="input" placeholder={t("common.notes")} />
                      <button name="status" value="resolved" className="btn-trust">{t("admin.reports.resolve")}</button>
                      <button name="status" value="dismissed" className="btn-ghost">{t("admin.reports.dismiss")}</button>
                    </ActionForm>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState>{t("admin.queues.empty")}</EmptyState>
        )}
      </Card>

      <Card title={t("admin.reports.flagged")}>
        {flaggedRows.length ? (
          <ul className="space-y-3 text-sm">
            {flaggedRows.map((m) => (
              <li key={m.id} className="flex flex-col gap-2 rounded-xl border border-stone-200 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-stone-500">{name(m.sender_id)} · {f.dateTime(m.created_at)} {m.flag_reasons.map((r) => <Badge key={r} tone="warn">{r}</Badge>)}</p>
                  <p className="whitespace-pre-line">{m.body}</p>
                </div>
                <div className="flex gap-2">
                  <Link href={`/admin/reports/${m.conversation_id}`} className="btn-ghost">{t("common.view")}</Link>
                  <ActionForm action={setMessageHidden} className="space-y-0">
                    <input type="hidden" name="message_id" value={m.id} />
                    <input type="hidden" name="hidden" value="1" />
                    <SubmitButton className="btn-secondary">{t("admin.reports.hideMessage")}</SubmitButton>
                  </ActionForm>
                  <ActionForm action={setMessageHidden} className="space-y-0">
                    <input type="hidden" name="message_id" value={m.id} />
                    <input type="hidden" name="hidden" value="0" />
                    <SubmitButton className="btn-ghost">{t("admin.reports.dismiss")}</SubmitButton>
                  </ActionForm>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState>{t("admin.queues.empty")}</EmptyState>
        )}
      </Card>

      <Card title={t("admin.reports.conversations")}>
        <ul className="divide-y divide-stone-100 text-sm">
          {convoRows.map((c) => (
            <li key={c.id} className="flex justify-between py-2">
              <Link className="link" href={`/admin/reports/${c.id}`}>{name(c.donor_id)} ↔ {name(c.student_id)}</Link>
              <span className="text-stone-500">{c.last_message_at ? f.dateTime(c.last_message_at) : ""}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

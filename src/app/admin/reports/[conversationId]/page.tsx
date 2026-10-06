import { notFound } from "next/navigation";
import { getT } from "@/i18n/server";
import { getFormatter } from "@/lib/server-format";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { Badge, Card, PageHeader, cn } from "@/components/ui";
import type { Conversation, Message } from "@/types/db";

export default async function AdminConversation({ params }: { params: Promise<{ conversationId: string }> }) {
  const admin = await requireAdmin();
  const { conversationId } = await params;
  const [t, f] = await Promise.all([getT(), getFormatter()]);
  const { data: c } = await db().from("conversations").select("*").eq("id", conversationId).maybeSingle<Conversation>();
  if (!c) notFound();
  const [{ data: msgs }, { data: people }] = await Promise.all([
    db().from("messages").select("*").eq("conversation_id", c.id).order("created_at"),
    db().from("profiles").select("id, full_name").in("id", [c.donor_id, c.student_id]),
  ]);
  await logAudit(admin.id, "conversation.viewed", "conversation", c.id);
  const name = (id: string | null) => people?.find((p) => p.id === id)?.full_name ?? "—";
  return (
    <div className="max-w-2xl">
      <PageHeader title={`${name(c.donor_id)} ↔ ${name(c.student_id)}`} />
      <Card className="space-y-3">
        {((msgs ?? []) as Message[]).map((m) => (
          <div key={m.id} className={cn("rounded-xl p-3 text-sm", m.sender_id === c.donor_id ? "bg-brand-50" : "bg-stone-100", m.hidden && "opacity-50")}>
            <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-stone-500">
              <strong>{name(m.sender_id)}</strong> {f.dateTime(m.created_at)}
              {m.flagged && <Badge tone="warn">{t("messages.flagged")}</Badge>}
              {m.hidden && <Badge tone="danger">{t("messages.hidden")}</Badge>}
            </div>
            <p className="whitespace-pre-line">{m.body}</p>
          </div>
        ))}
      </Card>
    </div>
  );
}

import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getT } from "@/i18n/server";
import { getFormatter } from "@/lib/server-format";
import { db } from "@/lib/supabase/admin";
import { Card, EmptyState, PageHeader, cn } from "@/components/ui";
import { markNotificationsRead } from "@/actions/messages";
import type { MessageKey } from "@/i18n/translate";
import type { NotificationRow } from "@/types/db";

export default async function NotificationsPage() {
  const user = await requireUser();
  const [t, f] = await Promise.all([getT(), getFormatter()]);
  const { data } = await db().from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
  const rows = (data ?? []) as NotificationRow[];
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={t("notifications.title")}
        actions={rows.some((r) => !r.read_at) && <form action={markNotificationsRead}><button className="btn-secondary">{t("notifications.markAllRead")}</button></form>}
      />
      {rows.length ? (
        <Card className="p-0 sm:p-0">
          <ul className="divide-y divide-stone-100">
            {rows.map((n) => {
              const vars = { name: user.profile.full_name, ...n.params };
              const body = (
                <div className={cn("px-5 py-4", !n.read_at && "bg-brand-50/60")}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium">{t(`notifications.${n.type}.title` as MessageKey, vars)}</p>
                    <span className="shrink-0 text-xs text-stone-500">{f.dateTime(n.created_at)}</span>
                  </div>
                  <p className="text-sm text-stone-600">{t(`notifications.${n.type}.body` as MessageKey, vars)}</p>
                </div>
              );
              return <li key={n.id}>{n.link ? <Link href={n.link} className="block hover:bg-stone-50">{body}</Link> : body}</li>;
            })}
          </ul>
        </Card>
      ) : (
        <EmptyState>{t("notifications.empty")}</EmptyState>
      )}
    </div>
  );
}

import "server-only";
import { db } from "@/lib/supabase/admin";

/** Record an admin action on money or approvals. Audit rows are immutable. */
export async function logAudit(
  actorId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  details: Record<string, unknown> = {},
) {
  const { error } = await db().from("audit_logs").insert({ actor_id: actorId, action, entity_type: entityType, entity_id: entityId, details });
  if (error) throw new Error(`Audit log write failed: ${error.message}`);
}

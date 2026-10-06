import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { searchUsers } from "@/lib/admin-queries";
import { csvResponse, toCsv } from "@/lib/csv";
import { logAudit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  const filters = Object.fromEntries(req.nextUrl.searchParams);
  const { rows } = await searchUsers(filters, 10000);
  await logAudit(admin.id, "export.users", "user", null, { filters, count: rows.length });
  return csvResponse(
    toCsv(rows as unknown as Record<string, unknown>[], [
      { key: "id", header: "id" },
      { key: "full_name", header: "name" },
      { key: "email", header: "email" },
      { key: "role", header: "role" },
      { key: "country_code", header: "country" },
      { key: "preferred_currency", header: "currency" },
      { key: "suspended_at", header: "suspended_at" },
      { key: "created_at", header: "created_at" },
    ]),
    "users.csv",
  );
}

import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { searchTransactions } from "@/lib/admin-queries";
import { csvResponse, toCsv } from "@/lib/csv";
import { logAudit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  const filters = Object.fromEntries(req.nextUrl.searchParams);
  const { rows } = await searchTransactions(filters, 10000);
  await logAudit(admin.id, "export.transactions", "donation", null, { filters, count: rows.length });
  return csvResponse(
    toCsv(rows as unknown as Record<string, unknown>[], [
      { key: "id", header: "id" },
      { key: "created_at", header: "created_at" },
      { key: "method", header: "method" },
      { key: "status", header: "status" },
      { key: "donor_name", header: "donor" },
      { key: "donor_email", header: "donor_email" },
      { key: "donor_country", header: "donor_country" },
      { key: "anonymous", header: "anonymous" },
      { key: "student_name", header: "student" },
      { key: "original_amount", header: "original_amount" },
      { key: "original_currency", header: "original_currency" },
      { key: "exchange_rate", header: "exchange_rate" },
      { key: "grant_amount", header: "grant_amount" },
      { key: "confirmed_amount", header: "confirmed_amount" },
      { key: "grant_currency", header: "grant_currency" },
      { key: "usd_rate", header: "usd_rate" },
      { key: "amount_usd", header: "amount_usd" },
      { key: "proof_reference", header: "proof_reference" },
      { key: "provider_payment_id", header: "provider_payment_id" },
    ]),
    "transactions.csv",
  );
}

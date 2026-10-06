import "server-only";
import { db } from "@/lib/supabase/admin";
import type { Donation, Profile } from "@/types/db";

export interface UserFilters {
  q?: string;
  role?: string;
  country?: string;
  status?: string;
}

export async function searchUsers(f: UserFilters, limit = 100, offset = 0) {
  let query = db().from("profiles").select("*", { count: "exact" }).is("deleted_at", null).order("created_at", { ascending: false });
  if (f.q) {
    const q = f.q.replace(/[%_,()]/g, "");
    query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%`);
  }
  if (f.role) query = query.eq("role", f.role);
  if (f.country) query = query.eq("country_code", f.country);
  if (f.status === "suspended") query = query.not("suspended_at", "is", null);
  if (f.status === "active") query = query.is("suspended_at", null);
  const { data, count } = await query.range(offset, offset + limit - 1);
  return { rows: (data ?? []) as Profile[], count: count ?? 0 };
}

export interface TransactionFilters {
  q?: string;
  method?: string;
  status?: string;
  currency?: string;
  country?: string;
  from?: string;
  to?: string;
}

export interface TransactionRow extends Donation {
  donor_name: string;
  donor_email: string;
  donor_country: string | null;
  student_name: string;
  grant_currency: string;
  amount_usd: number;
}

export async function searchTransactions(f: TransactionFilters, limit = 100, offset = 0) {
  let query = db().from("donations").select("*", { count: "exact" }).order("created_at", { ascending: false });
  if (f.method) query = query.eq("method", f.method);
  if (f.status) query = query.eq("status", f.status);
  if (f.currency) query = query.eq("original_currency", f.currency);
  if (f.from) query = query.gte("created_at", f.from);
  if (f.to) query = query.lte("created_at", `${f.to}T23:59:59Z`);

  // Name/email/country filters resolve to profile ids first.
  if (f.q || f.country) {
    let pq = db().from("profiles").select("id");
    if (f.q) {
      const q = f.q.replace(/[%_,()]/g, "");
      pq = pq.or(`full_name.ilike.%${q}%,email.ilike.%${q}%`);
    }
    if (f.country) pq = pq.eq("country_code", f.country);
    const { data: ids } = await pq.limit(1000);
    const list = (ids ?? []).map((p) => p.id);
    const refQ = f.q?.replace(/[%_,()]/g, "");
    const parts = [list.length ? `donor_id.in.(${list.join(",")})` : null, list.length && !f.country ? `student_id.in.(${list.join(",")})` : null, refQ && !f.country ? `proof_reference.ilike.%${refQ}%` : null].filter(Boolean);
    if (!parts.length) return { rows: [] as TransactionRow[], count: 0 };
    query = query.or(parts.join(","));
  }
  const { data, count } = await query.range(offset, offset + limit - 1);
  const rows = (data ?? []) as Donation[];
  const pids = [...new Set(rows.flatMap((d) => [d.donor_id, d.student_id]).filter(Boolean))] as string[];
  const gids = [...new Set(rows.map((d) => d.grant_id))];
  const [{ data: people }, { data: grants }] = await Promise.all([
    pids.length ? db().from("profiles").select("id, full_name, email, country_code").in("id", pids) : Promise.resolve({ data: [] }),
    gids.length ? db().from("grants").select("id, currency").in("id", gids) : Promise.resolve({ data: [] }),
  ]);
  const pMap = new Map((people ?? []).map((p) => [p.id, p]));
  const gMap = new Map((grants ?? []).map((g) => [g.id, g.currency as string]));
  return {
    count: count ?? 0,
    rows: rows.map((d) => ({
      ...d,
      donor_name: pMap.get(d.donor_id ?? "")?.full_name ?? "",
      donor_email: pMap.get(d.donor_id ?? "")?.email ?? "",
      donor_country: pMap.get(d.donor_id ?? "")?.country_code ?? null,
      student_name: pMap.get(d.student_id)?.full_name ?? "",
      grant_currency: gMap.get(d.grant_id) ?? "",
      amount_usd: Math.round(Number(d.confirmed_amount ?? d.grant_amount) * Number(d.usd_rate) * 100) / 100,
    })) as TransactionRow[],
  };
}

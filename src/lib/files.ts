import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/supabase/admin";
import type { CurrentUser } from "@/lib/auth";
import type { DocumentRow, DocumentType } from "@/types/db";

export const PRIVATE_BUCKET = "private-docs";
export const AVATAR_BUCKET = "avatars";
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic"]);

export class UploadError extends Error {
  constructor(public code: "missing" | "too_large" | "bad_type" | "storage") {
    super(code);
  }
}

export function isFile(value: FormDataEntryValue | null): value is File {
  return typeof value === "object" && value !== null && "arrayBuffer" in value && (value as File).size > 0;
}

/** Store a private file and register it in `documents`. */
export async function uploadPrivateDocument(opts: {
  file: File;
  ownerId: string;
  studentId?: string | null;
  type: DocumentType;
}): Promise<DocumentRow> {
  const { file } = opts;
  if (!file || file.size === 0) throw new UploadError("missing");
  if (file.size > MAX_BYTES) throw new UploadError("too_large");
  if (!ALLOWED.has(file.type)) throw new UploadError("bad_type");

  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-80) || "file";
  const path = `${opts.ownerId}/${opts.type}/${randomUUID()}-${safeName}`;
  const { error } = await db()
    .storage.from(PRIVATE_BUCKET)
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
  if (error) throw new UploadError("storage");

  const { data, error: insertError } = await db()
    .from("documents")
    .insert({
      owner_id: opts.ownerId,
      student_id: opts.studentId ?? null,
      type: opts.type,
      storage_path: path,
      file_name: file.name.slice(0, 200),
      mime_type: file.type,
      size_bytes: file.size,
    })
    .select("*")
    .single<DocumentRow>();
  if (insertError || !data) throw new UploadError("storage");
  return data;
}

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  if (file.size > 5 * 1024 * 1024) throw new UploadError("too_large");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new UploadError("bad_type");
  const path = `${userId}/${randomUUID()}`;
  const { error } = await db()
    .storage.from(AVATAR_BUCKET)
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type });
  if (error) throw new UploadError("storage");
  return path;
}

export function avatarUrl(path: string | null | undefined): string | null {
  if (!path || !process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${AVATAR_BUCKET}/${path}`;
}

/**
 * Who may open a private document:
 *  - admins and the uploader (student documents, donor payment proofs);
 *  - for a university receipt: the student and every donor with a confirmed
 *    or disbursed donation on that grant;
 *  - for a grant's tuition invoice: donors with a live direct-payment pledge
 *    or confirmed donation on that grant (they need it to pay the university).
 */
export async function canAccessDocument(user: CurrentUser, doc: DocumentRow): Promise<boolean> {
  if (user.profile.role === "admin" || doc.owner_id === user.id) return true;

  if (doc.type === "university_receipt") {
    const { data: disb } = await db().from("disbursements").select("grant_id").eq("receipt_document_id", doc.id);
    const grantIds = (disb ?? []).map((d) => d.grant_id as string);
    if (!grantIds.length) return false;
    const { data: grants } = await db().from("grants").select("student_id").in("id", grantIds);
    if ((grants ?? []).some((g) => g.student_id === user.id)) return true;
    const { count } = await db()
      .from("donations")
      .select("id", { count: "exact", head: true })
      .in("grant_id", grantIds)
      .eq("donor_id", user.id)
      .in("status", ["confirmed", "disbursed"]);
    return (count ?? 0) > 0;
  }

  if (doc.type === "tuition_invoice") {
    const { data: grants } = await db().from("grants").select("id").eq("invoice_document_id", doc.id);
    const grantIds = (grants ?? []).map((g) => g.id as string);
    if (!grantIds.length) return false;
    const { count } = await db()
      .from("donations")
      .select("id", { count: "exact", head: true })
      .in("grant_id", grantIds)
      .eq("donor_id", user.id)
      .in("status", ["pending", "confirmed", "disbursed"]);
    return (count ?? 0) > 0;
  }
  return false;
}

export function documentHref(id: string | null | undefined): string | null {
  return id ? `/api/files/${id}` : null;
}

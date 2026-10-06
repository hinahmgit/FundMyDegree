import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/supabase/admin";
import { canAccessDocument, PRIVATE_BUCKET } from "@/lib/files";
import type { DocumentRow } from "@/types/db";

/** Serves private documents through a 60-second signed URL after an access check. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.profile.suspended_at) return new NextResponse("Unauthorized", { status: 401 });
  const { data: doc } = await db().from("documents").select("*").eq("id", id).maybeSingle<DocumentRow>();
  if (!doc || !(await canAccessDocument(user, doc))) return new NextResponse("Not found", { status: 404 });
  const { data, error } = await db().storage.from(PRIVATE_BUCKET).createSignedUrl(doc.storage_path, 60);
  if (error || !data) return new NextResponse("Not found", { status: 404 });
  return NextResponse.redirect(data.signedUrl, { headers: { "Cache-Control": "private, no-store" } });
}

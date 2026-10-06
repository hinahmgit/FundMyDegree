import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/supabase/admin";
import { safeTimeZone } from "@/lib/format";
import type { Profile, UserRole } from "@/types/db";

export interface CurrentUser {
  id: string;
  email: string;
  profile: Profile;
}

/** The signed-in user and their profile, or null. Cached for the request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await db().from("profiles").select("*").eq("id", user.id).maybeSingle<Profile>();
  if (!profile) return null;
  return { id: user.id, email: user.email ?? profile.email ?? "", profile };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.profile.deleted_at) redirect("/login");
  if (user.profile.suspended_at) redirect("/suspended");
  return user;
}

export async function requireRole(...roles: UserRole[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!roles.includes(user.profile.role)) redirect("/dashboard");
  return user;
}

export function requireAdmin() {
  return requireRole("admin");
}

export function dashboardPath(role: UserRole): string {
  return role === "admin" ? "/admin" : role === "student" ? "/student" : "/donor";
}

/** Viewer preferences used for formatting: time zone and display currency. */
export const getViewerPrefs = cache(async () => {
  const user = await getCurrentUser();
  const store = await cookies();
  return {
    timeZone: safeTimeZone(user?.profile.timezone && user.profile.timezone !== "UTC" ? user.profile.timezone : store.get("tz")?.value),
    currency: user?.profile.preferred_currency ?? store.get("currency")?.value ?? "USD",
  };
});

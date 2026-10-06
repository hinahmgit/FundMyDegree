import { redirect } from "next/navigation";
import { dashboardPath, requireUser } from "@/lib/auth";

export default async function DashboardRedirect() {
  const user = await requireUser();
  redirect(dashboardPath(user.profile.role));
}

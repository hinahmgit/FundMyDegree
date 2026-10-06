import { getT } from "@/i18n/server";
import { getCurrentUser } from "@/lib/auth";
import { signOut } from "@/actions/auth";

export default async function SuspendedPage() {
  const [t, user] = await Promise.all([getT(), getCurrentUser()]);
  return (
    <div className="card mx-auto max-w-md text-center">
      <h1 className="font-display text-2xl font-semibold">{t("auth.suspendedTitle")}</h1>
      <p className="mt-2 text-stone-600">{t("auth.suspendedBody")}</p>
      {user?.profile.suspended_reason && <p className="mt-2 text-sm text-stone-500">{user.profile.suspended_reason}</p>}
      <form action={signOut} className="mt-4"><button className="btn-secondary">{t("nav.logout")}</button></form>
    </div>
  );
}

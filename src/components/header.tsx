import Link from "next/link";
import { getCurrentUser, dashboardPath } from "@/lib/auth";
import { getT } from "@/i18n/server";
import { db } from "@/lib/supabase/admin";
import { signOut } from "@/actions/auth";
import { LogoMark } from "@/components/logo";

export async function Header() {
  const [user, t] = await Promise.all([getCurrentUser(), getT()]);
  let unread = 0;
  if (user) {
    const { count } = await db().from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("read_at", null);
    unread = count ?? 0;
  }

  const links = [
    { href: "/students", label: t("nav.students") },
    ...(user
      ? [
          { href: dashboardPath(user.profile.role), label: user.profile.role === "admin" ? t("nav.admin") : t("nav.dashboard") },
          ...(user.profile.role !== "admin" ? [{ href: "/messages", label: t("nav.messages") }] : []),
        ]
      : [
          { href: "/#how", label: t("nav.howItWorks") },
          { href: "/#faq", label: t("footer.faq") },
        ]),
  ];

  const bell = user && (
    <Link href="/notifications" className="relative rounded-full p-2 text-stone-600 hover:bg-stone-100" aria-label={t("nav.notifications")}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" /></svg>
      {unread > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-4 rounded-full bg-brand-600 px-1 text-center text-[10px] font-bold text-white">{unread > 99 ? "99+" : unread}</span>}
    </Link>
  );

  const accountLinks = user ? (
    <>
      <Link href="/settings" className="btn-ghost">{t("nav.settings")}</Link>
      <form action={signOut}><button className="btn-ghost" type="submit">{t("nav.logout")}</button></form>
    </>
  ) : (
    <>
      <Link href="/login" className="btn-ghost">{t("nav.login")}</Link>
      <Link href="/signup" className="btn-primary">{t("nav.signup")}</Link>
    </>
  );

  return (
    <header className="sticky top-0 z-30 border-b border-stone-200/70 bg-cream/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-center gap-2.5 font-display text-xl font-bold tracking-tight text-stone-900">
          <LogoMark size={34} />
          <span>Fund<span className="text-brand-600">My</span>Degree</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => <Link key={l.href} href={l.href} className="btn-ghost">{l.label}</Link>)}
        </nav>
        <div className="hidden items-center gap-1 md:flex">{bell}{accountLinks}</div>
        <div className="flex items-center gap-1 md:hidden">
          {bell}
          <details className="group relative">
            <summary className="btn-ghost list-none cursor-pointer" aria-label={t("nav.menu")}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M4 6h16M4 12h16M4 18h16" /></svg>
            </summary>
            <div className="absolute right-0 mt-2 flex w-56 flex-col gap-1 rounded-xl border border-stone-200 bg-white p-2 shadow-lg">
              {links.map((l) => <Link key={l.href} href={l.href} className="btn-ghost justify-start">{l.label}</Link>)}
              <div className="my-1 border-t border-stone-100" />
              {accountLinks}
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}

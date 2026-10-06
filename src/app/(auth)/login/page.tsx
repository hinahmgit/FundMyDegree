import Link from "next/link";
import { getT } from "@/i18n/server";
import { signIn } from "@/actions/auth";
import { ActionForm, SubmitButton } from "@/components/forms";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const t = await getT();
  const { next } = await searchParams;
  return (
    <div className="card">
      <h1 className="font-display text-2xl font-semibold">{t("auth.loginTitle")}</h1>
      <p className="mb-6 text-stone-600">{t("auth.loginSubtitle")}</p>
      <ActionForm action={signIn}>
        <input type="hidden" name="next" value={next ?? ""} />
        <div>
          <label className="label" htmlFor="email">{t("auth.email")}</label>
          <input className="input" id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div>
          <label className="label" htmlFor="password">{t("auth.password")}</label>
          <input className="input" id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        <SubmitButton className="btn-primary w-full">{t("nav.login")}</SubmitButton>
      </ActionForm>
      <div className="mt-4 flex justify-between text-sm">
        <Link href="/forgot-password" className="link">{t("auth.forgotPassword")}</Link>
        <span>{t("auth.noAccount")} <Link href="/signup" className="link">{t("nav.signup")}</Link></span>
      </div>
    </div>
  );
}

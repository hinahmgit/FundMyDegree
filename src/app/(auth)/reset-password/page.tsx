import { getT } from "@/i18n/server";
import { updatePassword } from "@/actions/auth";
import { ActionForm, SubmitButton } from "@/components/forms";

export default async function ResetPasswordPage() {
  const t = await getT();
  return (
    <div className="card">
      <h1 className="mb-4 font-display text-2xl font-semibold">{t("auth.resetTitle")}</h1>
      <ActionForm action={updatePassword}>
        <div>
          <label className="label" htmlFor="password">{t("auth.newPassword")}</label>
          <input className="input" id="password" name="password" type="password" minLength={10} required autoComplete="new-password" />
          <p className="hint">{t("auth.passwordHint")}</p>
        </div>
        <SubmitButton className="btn-primary w-full">{t("auth.updatePassword")}</SubmitButton>
      </ActionForm>
    </div>
  );
}

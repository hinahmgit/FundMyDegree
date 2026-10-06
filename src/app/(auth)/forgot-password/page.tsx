import { getT } from "@/i18n/server";
import { requestPasswordReset } from "@/actions/auth";
import { ActionForm, SubmitButton } from "@/components/forms";

export default async function ForgotPasswordPage() {
  const t = await getT();
  return (
    <div className="card">
      <h1 className="mb-4 font-display text-2xl font-semibold">{t("auth.resetTitle")}</h1>
      <ActionForm action={requestPasswordReset}>
        <div>
          <label className="label" htmlFor="email">{t("auth.email")}</label>
          <input className="input" id="email" name="email" type="email" required />
        </div>
        <SubmitButton className="btn-primary w-full">{t("auth.resetSend")}</SubmitButton>
      </ActionForm>
    </div>
  );
}

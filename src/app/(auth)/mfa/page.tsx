import { getT } from "@/i18n/server";
import { verifyMfa } from "@/actions/auth";
import { ActionForm, SubmitButton } from "@/components/forms";

export default async function MfaPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const t = await getT();
  const { next } = await searchParams;
  return (
    <div className="card">
      <h1 className="font-display text-2xl font-semibold">{t("auth.mfaTitle")}</h1>
      <p className="mb-6 text-stone-600">{t("auth.mfaBody")}</p>
      <ActionForm action={verifyMfa}>
        <input type="hidden" name="next" value={next ?? ""} />
        <div>
          <label className="label" htmlFor="code">{t("auth.mfaCode")}</label>
          <input className="input text-center text-xl tracking-[0.5em]" id="code" name="code" inputMode="numeric" pattern="\d{6}" maxLength={6} autoComplete="one-time-code" required autoFocus />
        </div>
        <SubmitButton className="btn-primary w-full">{t("auth.mfaVerify")}</SubmitButton>
      </ActionForm>
    </div>
  );
}

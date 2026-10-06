"use client";
import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { useT } from "@/i18n/client";
import { Alert } from "@/components/ui";

type Enrollment = { factorId: string; qr: string; secret: string };

/** TOTP two-factor enrolment using Supabase Auth MFA. */
export function TwoFactor() {
  const t = useT();
  const [supabase] = useState(createBrowserSupabase);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    setFactorId(data?.totp.find((f) => f.status === "verified")?.id ?? null);
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enroll = async () => {
    setError(null);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `FundMyDegree ${Date.now()}` });
    if (error || !data) return setError(t("common.unknownError"));
    setEnrollment({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  };

  const verify = async () => {
    if (!enrollment) return;
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrollment.factorId, code: code.trim() });
    if (error) return setError(t("auth.mfaInvalid"));
    setEnrollment(null);
    setMessage(t("settings.enabled2fa"));
    load();
  };

  const disable = async () => {
    if (!factorId) return;
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) return setError(t("common.unknownError"));
    setFactorId(null);
  };

  return (
    <div className="space-y-3 text-sm">
      {error && <Alert tone="danger">{error}</Alert>}
      {message && <Alert tone="success">{message}</Alert>}
      {factorId ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-trust-700">{t("settings.twoFactorOn")}</p>
          <button type="button" className="btn-secondary" onClick={disable}>{t("settings.disable2fa")}</button>
        </div>
      ) : enrollment ? (
        <div className="space-y-3">
          <p>{t("settings.scanQr")}</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={enrollment.qr} alt="" width={180} height={180} className="rounded-lg border border-stone-200 bg-white p-2" />
          <p className="font-mono text-xs break-all text-stone-500">{t("settings.secret", { secret: enrollment.secret })}</p>
          <div className="flex gap-2">
            <input className="input max-w-40 text-center tracking-widest" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} aria-label={t("auth.mfaCode")} />
            <button type="button" className="btn-primary" onClick={verify}>{t("auth.mfaVerify")}</button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <p className="text-stone-600">{t("settings.twoFactorOff")}</p>
          <button type="button" className="btn-primary" onClick={enroll}>{t("settings.enable2fa")}</button>
        </div>
      )}
    </div>
  );
}

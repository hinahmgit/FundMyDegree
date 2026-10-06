"use client";
import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { donateThroughPlatform, pledgeDirectPayment } from "@/actions/donations";
import { useFormat, useT } from "@/i18n/client";
import { ActionMessage, SubmitButton } from "@/components/forms";
import { Alert, cn } from "@/components/ui";
import { crossRate, type RateTable } from "@/lib/fx/convert";
import type { ActionState } from "@/lib/action-state";

interface Props {
  grant: { id: string; currency: string; remaining: number };
  rates: RateTable;
  tolerancePct: number;
  holdDays: number;
  defaultCurrency: string;
  defaultAmount?: string;
  currencies: string[];
  savedMethods: { id: string; last4: string }[];
  testMode: boolean;
  studentId: string;
}

export function DonateForms(props: Props) {
  const t = useT();
  const [method, setMethod] = useState<"platform" | "direct">("platform");
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{t("donate.chooseMethod")}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {(["platform", "direct"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMethod(m)}
            className={cn("rounded-2xl border-2 bg-white p-4 text-left transition", method === m ? "border-brand-500 ring-2 ring-brand-100" : "border-stone-200 hover:border-stone-300")}
            aria-pressed={method === m}
          >
            <div className="font-semibold">{m === "platform" ? t("donate.platformTitle") : t("donate.directTitle")}</div>
            <p className="mt-1 text-sm text-stone-600">{m === "platform" ? t("donate.platformBody") : t("donate.directBody", { days: props.holdDays })}</p>
          </button>
        ))}
      </div>
      {method === "platform" ? <PlatformForm {...props} /> : <DirectForm {...props} />}
    </div>
  );
}

function maxIn(currency: string, p: Props) {
  const rate = crossRate(currency, p.grant.currency, p.rates);
  if (!rate) return null;
  return Math.floor(((p.grant.remaining * (1 + p.tolerancePct / 100)) / rate) * 100) / 100;
}

function PlatformForm(p: Props) {
  const t = useT();
  const fmt = useFormat();
  const [state, action] = useActionState(donateThroughPlatform, {} as ActionState);
  const initialCurrency = p.currencies.includes(p.defaultCurrency) ? p.defaultCurrency : p.currencies.includes(p.grant.currency) ? p.grant.currency : "USD";
  const [currency, setCurrency] = useState(initialCurrency);
  const [amount, setAmount] = useState(p.defaultAmount ?? "");
  const [savedId, setSavedId] = useState(p.savedMethods[0]?.id ?? "");
  const rate = crossRate(currency, p.grant.currency, p.rates);
  const max = maxIn(currency, p);
  const exactRest = rate ? Math.ceil((p.grant.remaining / rate) * 100) / 100 : null;
  const inGrant = rate && Number(amount) > 0 ? Math.round(Number(amount) * rate * 100) / 100 : null;
  const tooMuch = max !== null && Number(amount) > max;

  if (state.ok) {
    return (
      <div className="card border-trust-100 bg-trust-50">
        <h3 className="text-lg font-semibold text-trust-700">{t("payment.successTitle")}</h3>
        <p className="mt-1 text-trust-700">{t("payment.successBody", state.vars)}</p>
        <div className="mt-4 flex gap-2">
          <Link href="/donor" className="btn-trust">{t("nav.dashboard")}</Link>
          <Link href={`/students/${p.studentId}`} className="btn-secondary">{t("common.back")}</Link>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="card space-y-4">
      {p.testMode && <Alert tone="warn"><strong>{t("common.testMode")}.</strong> {t("payment.testCards")}</Alert>}
      <ActionMessage state={state} />
      <input type="hidden" name="grant_id" value={p.grant.id} />
      <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
        <div>
          <label className="label" htmlFor="amount">{t("donate.amountInYourCurrency", { currency })}</label>
          <input id="amount" name="amount" type="number" min="1" step="0.01" required className="input text-lg" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="currency">{t("common.currency")}</label>
          <select id="currency" name="currency" className="input text-lg" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {p.currencies.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div className="space-y-1 text-sm text-stone-600">
        {rate === null ? (
          <p className="text-red-600">{t("donate.rateUnavailable", { currency })}</p>
        ) : (
          <>
            {inGrant !== null && currency !== p.grant.currency && <p>{t("common.estimate", { amount: fmt.money(inGrant, p.grant.currency) })}</p>}
            {currency !== p.grant.currency && <p className="text-xs text-stone-500">{t("donate.rateUsed", { from: currency, rate: rate.toPrecision(6), to: p.grant.currency })}</p>}
            {max !== null && <p className={cn(tooMuch && "text-red-600")}>{t("donate.maxAllowed", { amount: fmt.money(max, currency) })}</p>}
            {exactRest !== null && (
              <button type="button" className="link text-sm" onClick={() => setAmount(String(Math.min(exactRest, max ?? exactRest)))}>{t("donate.fullTerm")}</button>
            )}
          </>
        )}
      </div>

      <fieldset className="space-y-3 rounded-xl bg-stone-50 p-4">
        <legend className="font-semibold">{t("payment.cardTitle")}</legend>
        {p.savedMethods.length > 0 && (
          <select name="saved_method_id" className="input" value={savedId} onChange={(e) => setSavedId(e.target.value)}>
            {p.savedMethods.map((m) => <option key={m.id} value={m.id}>{t("payment.savedCard", { last4: m.last4 })}</option>)}
            <option value="">+ {t("payment.cardNumber")}</option>
          </select>
        )}
        {!savedId && (
          <>
            <div>
              <label className="label" htmlFor="card_number">{t("payment.cardNumber")}</label>
              <input id="card_number" name="card_number" inputMode="numeric" autoComplete="cc-number" className="input" placeholder="4242 4242 4242 4242" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="expiry">{t("payment.expiry")}</label>
                <input id="expiry" name="expiry" autoComplete="cc-exp" className="input" placeholder="12/30" required />
              </div>
              <div>
                <label className="label" htmlFor="cvc">{t("payment.cvc")}</label>
                <input id="cvc" name="cvc" inputMode="numeric" autoComplete="cc-csc" className="input" placeholder="123" required />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="holder">{t("payment.holder")}</label>
              <input id="holder" name="holder" autoComplete="cc-name" className="input" required />
            </div>
            <label className="flex gap-2 text-sm"><input type="checkbox" name="save_card" defaultChecked /> {t("payment.saveCard")}</label>
          </>
        )}
      </fieldset>
      <label className="flex gap-2 text-sm"><input type="checkbox" name="anonymous" /> {t("donate.anonymous")}</label>
      <SubmitButton className="btn-primary w-full py-3 text-base" disabled={rate === null || tooMuch} pendingLabel={t("payment.processing")}>
        {t("payment.pay", { amount: Number(amount) > 0 ? fmt.money(Number(amount), currency) : "" })}
      </SubmitButton>
    </form>
  );
}

function DirectForm(p: Props) {
  const t = useT();
  const fmt = useFormat();
  const [state, action] = useActionState(pledgeDirectPayment, {} as ActionState);
  const [amount, setAmount] = useState("");
  const max = Math.floor(p.grant.remaining * (1 + p.tolerancePct / 100) * 100) / 100;
  const estimate = useMemo(() => {
    const r = crossRate(p.grant.currency, p.defaultCurrency, p.rates);
    return r && Number(amount) > 0 && p.defaultCurrency !== p.grant.currency ? fmt.money(Number(amount) * r, p.defaultCurrency) : null;
  }, [amount, p, fmt]);

  return (
    <form action={action} className="card space-y-4">
      <ActionMessage state={state} />
      <input type="hidden" name="grant_id" value={p.grant.id} />
      <div>
        <label className="label" htmlFor="pledge_amount">{t("donate.amountInGrantCurrency", { currency: p.grant.currency })}</label>
        <input id="pledge_amount" name="amount" type="number" min="1" step="0.01" max={max} required className="input text-lg" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <div className="mt-1 space-y-1 text-sm text-stone-600">
          {estimate && <p>{t("common.estimate", { amount: estimate })}</p>}
          <p>{t("donate.maxAllowed", { amount: fmt.money(max, p.grant.currency) })}</p>
          <button type="button" className="link" onClick={() => setAmount(String(p.grant.remaining))}>{t("donate.fullTerm")}</button>
        </div>
      </div>
      <label className="flex gap-2 text-sm"><input type="checkbox" name="anonymous" /> {t("donate.anonymous")}</label>
      <SubmitButton className="btn-primary w-full py-3 text-base">
        {t("pledge.createButton", { amount: Number(amount) > 0 ? fmt.money(Number(amount), p.grant.currency) : "" })}
      </SubmitButton>
    </form>
  );
}

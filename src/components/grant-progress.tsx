import { ProgressBar } from "@/components/ui";
import type { Translator } from "@/i18n/translate";
import type { Formatter } from "@/lib/server-format";
import type { ProgressSummary } from "@/lib/grants";

/** Progress bar with confirmed vs pending amounts and an estimate in the viewer's currency. */
export function GrantProgress({ progress, t, f, compact }: { progress: ProgressSummary; t: Translator; f: Formatter; compact?: boolean }) {
  const { target, confirmed, pending, remaining, currency } = progress;
  const est = f.estimate(remaining, currency);
  return (
    <div className="space-y-2">
      <ProgressBar
        target={target}
        confirmed={confirmed}
        pending={pending}
        labels={{
          confirmed: `${t("progress.confirmed")} ${f.money(confirmed, currency)}`,
          pending: `${t("progress.pending")} ${f.money(pending, currency)}`,
        }}
      />
      {!compact && (
        <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
          <span className="text-stone-600">
            {t("progress.target")}: <strong className="text-stone-900">{f.money(target, currency)}</strong>
          </span>
          <span className="text-stone-600">
            {remaining > 0 ? (
              <>
                {t("progress.remaining")}: <strong className="text-brand-700">{f.money(remaining, currency)}</strong>
                {est && <span className="ml-1 text-xs text-stone-500">{t("common.estimate", { amount: est })}</span>}
              </>
            ) : (
              <strong className="text-trust-700">{t("progress.fullyFunded")}</strong>
            )}
          </span>
        </div>
      )}
    </div>
  );
}

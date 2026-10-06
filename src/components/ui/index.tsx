import Link from "next/link";
import type { ReactNode } from "react";

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-2xl font-semibold sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-stone-600">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className, title, actions }: { children: ReactNode; className?: string; title?: ReactNode; actions?: ReactNode }) {
  return (
    <section className={cn("card", className)}>
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-lg font-semibold">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

const tones = {
  neutral: "bg-stone-100 text-stone-700",
  brand: "bg-brand-100 text-brand-800",
  trust: "bg-trust-100 text-trust-700",
  warn: "bg-amber-100 text-amber-800",
  danger: "bg-red-100 text-red-700",
  info: "bg-sky-100 text-sky-800",
} as const;
export type Tone = keyof typeof tones;

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", tones[tone])}>{children}</span>;
}

export function Alert({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "success" | "warn" | "danger" }) {
  const styles = {
    info: "border-sky-200 bg-sky-50 text-sky-900",
    success: "border-trust-100 bg-trust-50 text-trust-700",
    warn: "border-amber-200 bg-amber-50 text-amber-900",
    danger: "border-red-200 bg-red-50 text-red-800",
  }[tone];
  return <div role={tone === "danger" ? "alert" : "status"} className={cn("rounded-lg border px-4 py-3 text-sm", styles)}>{children}</div>;
}

export function EmptyState({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50/50 px-4 py-8 text-center text-sm text-stone-500">
      <p>{children}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Field({ label, hint, htmlFor, children, optional }: { label: string; hint?: ReactNode; htmlFor?: string; children: ReactNode; optional?: string }) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>
        {label}
        {optional && <span className="ml-1 font-normal text-stone-400">({optional})</span>}
      </label>
      {children}
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

export function StatCard({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium tracking-wide text-stone-500 uppercase">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-stone-900">{value}</div>
      {sub && <div className="mt-1 text-xs text-stone-500">{sub}</div>}
    </div>
  );
}

export function ProgressBar({
  target,
  confirmed,
  pending,
  labels,
}: {
  target: number;
  confirmed: number;
  pending: number;
  labels?: { confirmed: string; pending: string };
}) {
  const pct = (n: number) => (target > 0 ? Math.min(100, Math.max(0, (n / target) * 100)) : 0);
  const c = pct(confirmed);
  const p = Math.min(100 - c, pct(pending));
  return (
    <div>
      <div
        className="flex h-3 w-full overflow-hidden rounded-full bg-stone-200"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(c)}
      >
        <div className="h-full bg-trust-500" style={{ width: `${c}%` }} />
        <div className="h-full bg-[repeating-linear-gradient(45deg,var(--color-brand-300),var(--color-brand-300)_6px,var(--color-brand-200)_6px,var(--color-brand-200)_12px)]" style={{ width: `${p}%` }} />
      </div>
      {labels && (
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-600">
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-trust-500" />{labels.confirmed}</span>
          {pending > 0 && <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-brand-300" />{labels.pending}</span>}
        </div>
      )}
    </div>
  );
}

export function Avatar({ src, name, size = 48 }: { src: string | null; name: string; size?: number }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <div className="flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700" style={{ width: size, height: size, fontSize: size / 2.6 }} aria-hidden>
      {initials}
    </div>
  );
}

export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="-mx-5 overflow-x-auto sm:mx-0">{children}</div>;
}

export function Pagination({ page, hasNext, hrefFor, labels }: { page: number; hasNext: boolean; hrefFor: (p: number) => string; labels: { prev: string; next: string; page: string } }) {
  return (
    <nav className="mt-4 flex items-center justify-between text-sm">
      {page > 1 ? <Link className="btn-secondary" href={hrefFor(page - 1)}>{labels.prev}</Link> : <span />}
      <span className="text-stone-500">{labels.page}</span>
      {hasNext ? <Link className="btn-secondary" href={hrefFor(page + 1)}>{labels.next}</Link> : <span />}
    </nav>
  );
}

"use client";
import { useEffect, useState } from "react";
import { useT } from "@/i18n/client";

/** Live countdown to a deadline, e.g. a pledge expiry. */
export function Countdown({ to }: { to: string }) {
  const t = useT();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  if (now === null) return null;
  const ms = new Date(to).getTime() - now;
  if (ms <= 0) return <span className="font-medium text-red-600">{t("pledge.expired")}</span>;
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const time = d > 0 ? `${d}d ${h}h` : `${h}h ${m}m`;
  return <span className={d < 3 ? "font-medium text-amber-700" : "text-stone-600"}>{t("pledge.expiresIn", { time })}</span>;
}

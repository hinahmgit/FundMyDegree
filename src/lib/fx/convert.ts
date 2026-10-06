// Pure currency math. Rates are "units of currency per 1 USD".
export type RateTable = Record<string, number>;

/** Units of `to` per one unit of `from`, or null when either rate is unknown. */
export function crossRate(from: string, to: string, rates: RateTable): number | null {
  if (from === to) return 1;
  const f = rates[from];
  const t = rates[to];
  if (!f || !t) return null;
  return t / f;
}

export function convert(amount: number, from: string, to: string, rates: RateTable): number | null {
  const rate = crossRate(from, to, rates);
  return rate === null ? null : Math.round(amount * rate * 100) / 100;
}

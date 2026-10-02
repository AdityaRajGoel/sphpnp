/** Returns and ranges from a daily close series, for the index and commodity pages. */

export type Close = { trade_date: string; close: number | null };
export type PeriodKey = "1W" | "1M" | "3M" | "6M" | "1Y" | "2Y";

export const PERIODS: { key: PeriodKey; label: string; days: number }[] = [
  { key: "1W", label: "1 week", days: 7 },
  { key: "1M", label: "1 month", days: 30 },
  { key: "3M", label: "3 months", days: 91 },
  { key: "6M", label: "6 months", days: 182 },
  { key: "1Y", label: "1 year", days: 365 },
  { key: "2Y", label: "2 years", days: 730 },
];

const DAY_MS = 86_400_000;
const shift = (iso: string, days: number) => new Date(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) - days * DAY_MS).toISOString().slice(0, 10);
const lastOf = <T,>(xs: T[]): T | undefined => xs[xs.length - 1];
const valid = (closes: Close[]) => closes.filter((c): c is { trade_date: string; close: number } => c.close !== null && c.close > 0);

/**
 * Change over each period, from the last close on or before the cutoff to the
 * latest close. A period older than the history reads null rather than quietly
 * showing the change since the first close.
 */
export function trailingReturns(closes: Close[]): { key: PeriodKey; label: string; pct: number | null }[] {
  const series = valid(closes);
  const last = lastOf(series);
  return PERIODS.map((p) => {
    if (!last) return { ...p, pct: null };
    const cutoff = shift(last.trade_date, p.days);
    const base = lastOf(series.filter((c) => c.trade_date <= cutoff));
    return { key: p.key, label: p.label, pct: base ? (last.close / base.close - 1) * 100 : null };
  });
}

export type YearRange = { high: number; highDate: string; low: number; lowDate: string; last: number; fromHigh: number };

/** High and low of closes over the 365 days to the latest close. */
export function yearRange(closes: Close[]): YearRange | null {
  const series = valid(closes);
  const last = lastOf(series);
  if (!last) return null;
  const cutoff = shift(last.trade_date, 365);
  const year = series.filter((c) => c.trade_date >= cutoff);
  const high = year.reduce((a, b) => (b.close > a.close ? b : a));
  const low = year.reduce((a, b) => (b.close < a.close ? b : a));
  return { high: high.close, highDate: high.trade_date, low: low.close, lowDate: low.trade_date, last: last.close, fromHigh: (last.close / high.close - 1) * 100 };
}

const TROY_OUNCE_G = 31.1034768;
export const GOLD_10G_PER_OZ = 10 / TROY_OUNCE_G;
export const SILVER_KG_PER_OZ = 1000 / TROY_OUNCE_G;

/**
 * A dollar-per-ounce series in rupees per unit, at the USD/INR close on or
 * before each date. This is international parity: no import duty, GST or the
 * local premium, which is why it sits below the MCX price.
 */
export function alignRupees(usd: Close[], usdInr: Close[], factor: number): { trade_date: string; close: number }[] {
  const rates = valid(usdInr);
  const out: { trade_date: string; close: number }[] = [];
  let i = -1;
  for (const bar of valid(usd)) {
    while (i + 1 < rates.length && rates[i + 1].trade_date <= bar.trade_date) i++;
    if (i >= 0) out.push({ trade_date: bar.trade_date, close: bar.close * rates[i].close * factor });
  }
  return out;
}

/**
 * X-axis ticks: the first trading day of each month, every k-th month so there
 * are at most `max`. Over two years it ticks year starts instead, so a five-year
 * chart reads "Jan 22, Jan 23" rather than "Oct 21, Nov 22, Dec 23".
 */
export function monthTicks(dates: string[], max = 5): string[] {
  const months = dates.filter((d, i) => i === 0 || d.slice(0, 7) !== dates[i - 1].slice(0, 7));
  const firsts = months.length > 24 ? dates.filter((d, i) => i > 0 && d.slice(0, 4) !== dates[i - 1].slice(0, 4)) : months;
  const step = Math.ceil(firsts.length / max);
  return firsts.filter((_, i) => i % step === 0);
}

/**
 * Compound annual change over `years`, from the last close on or before that
 * many years back. Null when the history does not reach that far back.
 */
export function annualised(closes: Close[], years: number): number | null {
  const series = valid(closes);
  const last = lastOf(series);
  if (!last) return null;
  const base = lastOf(series.filter((c) => c.trade_date <= shift(last.trade_date, Math.round(years * 365.25))));
  return base ? ((last.close / base.close) ** (1 / years) - 1) * 100 : null;
}

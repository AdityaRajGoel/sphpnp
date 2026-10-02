/**
 * Research measures for /commodity-research, from stored daily closes:
 * volatility, worst fall, average return by calendar month, and how two
 * series move together. Pure functions; descriptions of the past, not signals.
 */
import { monthlyReturns } from "@/lib/seasonality";

export type Close = { trade_date: string; close: number | null };
type Point = { trade_date: string; close: number };

const valid = (c: Close[]) => c.filter((p): p is Point => p.close !== null && p.close > 0).sort((a, b) => a.trade_date.localeCompare(b.trade_date));
const yearsBack = (iso: string, years: number) => new Date(Date.parse(`${iso}T00:00:00Z`) - years * 365.25 * 86_400_000).toISOString().slice(0, 10);

/** Annualised standard deviation of daily log returns over the last `years`, in percent. */
export function volatility(closes: Close[], years = 1): number | null {
  const s = valid(closes);
  if (s.length < 20) return null;
  const since = yearsBack(s[s.length - 1].trade_date, years);
  const window = s.filter((p) => p.trade_date >= since);
  const r = window.slice(1).map((p, i) => Math.log(p.close / window[i].close));
  if (r.length < 19) return null;
  const mean = r.reduce((a, b) => a + b, 0) / r.length;
  const sd = Math.sqrt(r.reduce((a, b) => a + (b - mean) ** 2, 0) / (r.length - 1));
  return sd * Math.sqrt(252) * 100;
}

/** The deepest fall from a running peak, in percent (negative), with when it peaked and bottomed. */
export function maxDrawdown(closes: Close[]): { pct: number; peakDate: string; troughDate: string } | null {
  const s = valid(closes);
  if (s.length < 2) return null;
  let peak = s[0], worst = { pct: 0, peakDate: s[0].trade_date, troughDate: s[0].trade_date };
  for (const p of s) {
    if (p.close > peak.close) peak = p;
    const dd = (p.close / peak.close - 1) * 100;
    if (dd < worst.pct) worst = { pct: dd, peakDate: peak.trade_date, troughDate: p.trade_date };
  }
  return worst;
}

export type MonthSeason = { month: number; avg: number | null; up: number; years: number };

/** For each calendar month: the average return across the years in the data, and how many years it rose. */
export function seasonality(closes: Close[]): MonthSeason[] {
  // The month in progress is excluded: it has not finished.
  const months = monthlyReturns(closes).filter((m) => !m.toDate);
  return Array.from({ length: 12 }, (_, month) => {
    const these = months.filter((m) => m.month === month);
    return {
      month,
      avg: these.length ? these.reduce((a, m) => a + m.pct, 0) / these.length : null,
      up: these.filter((m) => m.pct > 0).length,
      years: these.length,
    };
  });
}

/** Pearson correlation of daily returns on the dates both series traded, over the last `years`. */
export function correlation(a: Close[], b: Close[], years = 1): number | null {
  const sa = valid(a), sb = valid(b);
  if (!sa.length || !sb.length) return null;
  const since = yearsBack(sa[sa.length - 1].trade_date, years);
  const bByDate = new Map(sb.map((p) => [p.trade_date, p.close]));
  const common = sa.filter((p) => p.trade_date >= since && bByDate.has(p.trade_date));
  const ra: number[] = [], rb: number[] = [];
  for (let i = 1; i < common.length; i++) {
    ra.push(common[i].close / common[i - 1].close - 1);
    rb.push(bByDate.get(common[i].trade_date)! / bByDate.get(common[i - 1].trade_date)! - 1);
  }
  if (ra.length < 2) return null;
  const ma = ra.reduce((x, y) => x + y, 0) / ra.length, mb = rb.reduce((x, y) => x + y, 0) / rb.length;
  let cov = 0, va = 0, vb = 0;
  for (let i = 0; i < ra.length; i++) { cov += (ra[i] - ma) * (rb[i] - mb); va += (ra[i] - ma) ** 2; vb += (rb[i] - mb) ** 2; }
  return va && vb ? cov / Math.sqrt(va * vb) : null;
}

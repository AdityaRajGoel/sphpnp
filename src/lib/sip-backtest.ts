/**
 * A monthly SIP replayed on a fund's actual NAV history.
 *
 * Each instalment buys at the first published NAV on or after its due date
 * (the day a real SIP would be processed when the due date is a holiday). No
 * exit load, stamp duty or tax is modelled, and the copy says so: this is the
 * scheme's past NAV path, not a projection.
 */

export type NavPoint = { date: string; nav: number };

export type SipInstalment = { date: string; nav: number; units: number; invested: number; value: number };

export type SipResult = {
  instalments: SipInstalment[];
  invested: number;
  units: number;
  value: number;
  valueDate: string;
  gain: number;
  absoluteReturnPct: number;
  /** Annualised money-weighted return. Null when it cannot be solved. */
  xirrPct: number | null;
};

const DAY = 86_400_000;
const ts = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

/** "11-09-2026" (mfapi.in) → "2026-09-11". Already-ISO dates pass through. */
export function toIsoDate(value: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/** Ascending, de-duplicated, positive NAVs only. */
export function cleanNavs(points: readonly { date: string; nav: number | string }[]): NavPoint[] {
  const byDate = new Map<string, number>();
  for (const p of points) {
    const date = toIsoDate(p.date);
    const nav = typeof p.nav === "number" ? p.nav : Number(p.nav);
    if (date && Number.isFinite(nav) && nav > 0) byDate.set(date, nav);
  }
  return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, nav]) => ({ date, nav }));
}

/** Index of the first NAV on or after `date`, or -1. Binary search over ascending dates. */
function firstOnOrAfter(navs: readonly NavPoint[], date: string): number {
  let lo = 0, hi = navs.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (navs[mid].date < date) lo = mid + 1; else hi = mid; }
  return lo < navs.length ? lo : -1;
}

const addMonths = (isoDate: string, months: number): string => {
  const d = new Date(`${isoDate}T00:00:00Z`);
  const day = d.getUTCDate();
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return iso(target.getTime());
};

/** Annualised XIRR by bisection on flows (negative = paid in). Null when no sign change exists. */
export function xirr(flows: readonly { date: string; amount: number }[]): number | null {
  if (flows.length < 2 || !flows.some((f) => f.amount < 0) || !flows.some((f) => f.amount > 0)) return null;
  const t0 = ts(flows[0].date);
  const npv = (rate: number) => flows.reduce((sum, f) => sum + f.amount / Math.pow(1 + rate, (ts(f.date) - t0) / (365 * DAY)), 0);
  let lo = -0.99, hi = 10;
  let fLo = npv(lo), fHi = npv(hi);
  if (fLo * fHi > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid);
    if (Math.abs(fMid) < 1e-7) return mid * 100;
    if (fLo * fMid < 0) { hi = mid; fHi = fMid; } else { lo = mid; fLo = fMid; }
  }
  return ((lo + hi) / 2) * 100;
}

/**
 * Replays `monthly` rupees a month from `start` for `months` instalments (or
 * until the history ends), valued at the latest NAV. Null when no instalment
 * could be bought.
 */
export function runSip(navs: readonly NavPoint[], monthly: number, start: string, months: number): SipResult | null {
  if (navs.length === 0 || monthly <= 0 || months <= 0) return null;
  const last = navs[navs.length - 1];
  const instalments: SipInstalment[] = [];
  let units = 0;
  for (let m = 0; m < months; m++) {
    const due = addMonths(start, m);
    if (due > last.date) break;
    const i = firstOnOrAfter(navs, due);
    if (i < 0) break;
    const { date, nav } = navs[i];
    // Two due dates can land on one NAV only if the history has a gap longer than a month; skip the duplicate.
    if (instalments.length && instalments[instalments.length - 1].date === date) continue;
    units += monthly / nav;
    instalments.push({ date, nav, units, invested: monthly * (instalments.length + 1), value: units * nav });
  }
  if (instalments.length === 0) return null;
  const invested = monthly * instalments.length;
  const value = units * last.nav;
  const flows = [...instalments.map((s) => ({ date: s.date, amount: -monthly })), { date: last.date, amount: value }];
  return {
    instalments,
    invested,
    units,
    value,
    valueDate: last.date,
    gain: value - invested,
    absoluteReturnPct: (value / invested - 1) * 100,
    xirrPct: xirr(flows),
  };
}

/** XIRR of an N-year SIP started in each calendar year the history allows - the spread of luck in start dates. */
export function rollingSipReturns(navs: readonly NavPoint[], years: number): { startYear: number; xirrPct: number }[] {
  if (navs.length === 0) return [];
  const first = Number(navs[0].date.slice(0, 4));
  const lastDate = navs[navs.length - 1].date;
  const out: { startYear: number; xirrPct: number }[] = [];
  for (let y = first; ; y++) {
    const start = `${y}-01-01`;
    if (addMonths(start, years * 12) > lastDate) break;
    if (start < navs[0].date) continue;
    const window = navs.filter((n) => n.date <= addMonths(start, years * 12));
    const r = runSip(window, 1000, start, years * 12);
    if (r?.xirrPct != null) out.push({ startYear: y, xirrPct: r.xirrPct });
  }
  return out;
}

/**
 * Mutual fund research data from AMFI's own files (no key, no third party):
 * today's NAVAll for every scheme's NAV, fund house and category, and the NAV
 * history report for the NAVs a month to five years back, from which
 * mf_schemes derives returns. Pure: no I/O.
 */
import type { AmfiNav } from "./amfi.ts";

export type MfScheme = {
  scheme_code: string;
  scheme_name: string;
  amc: string | null;
  category: string;
  plan: "direct" | "regular";
  isin: string | null;
  nav: number;
  nav_date: string;
};

export const ANCHORS = { "1m": 30, "3m": 91, "6m": 182, "1y": 365, "3y": 1096, "5y": 1826 } as const;
export type Anchor = keyof typeof ANCHORS;

/**
 * An open-ended growth scheme, with its plan; null for anything else. IDCW and
 * dividend options pay out, so their NAV understates the return. AMFI leaves
 * Plan and Option blank for some schemes, so the name decides then.
 */
export function toScheme(r: AmfiNav): MfScheme | null {
  if (!r.category) return null;
  const name = r.scheme_name;
  const option = `${r.option ?? ""} ${name}`;
  if (/idcw|dividend|bonus|payout/i.test(r.option ?? "") || (!r.option && /idcw|dividend|bonus/i.test(name))) return null;
  if (!/growth/i.test(option)) return null;
  const plan = /direct/i.test(`${r.plan ?? ""} ${name}`) ? "direct" : "regular";
  return { scheme_code: r.scheme_code, scheme_name: name, amc: r.amc, category: r.category, plan, isin: r.isin_growth, nav: r.nav, nav_date: r.nav_date };
}

const DAY = 86_400_000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

/** The four days ending `ANCHORS[anchor]` days before `today`: NAVs are not published on holidays. */
export function anchorWindow(today: string, anchor: Anchor): { from: string; to: string } {
  const to = Date.parse(`${today}T00:00:00Z`) - ANCHORS[anchor] * DAY;
  return { from: iso(to - 3 * DAY), to: iso(to) };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** AMFI's history report wants "02-Oct-2025". A fixed table: en-GB writes "Sept", which AMFI rejects. */
export function amfiDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}-${MONTHS[Number(m) - 1]}-${y}`;
}

/** Each scheme's last NAV on or before `to`. */
export function latestOnOrBefore(rows: { scheme_code: string; nav: number; nav_date: string }[], to: string): Map<string, number> {
  const best = new Map<string, { nav: number; date: string }>();
  for (const r of rows) {
    if (r.nav_date > to || !(r.nav > 0)) continue;
    const held = best.get(r.scheme_code);
    if (!held || r.nav_date > held.date) best.set(r.scheme_code, { nav: r.nav, date: r.nav_date });
  }
  return new Map([...best].map(([code, v]) => [code, v.nav]));
}

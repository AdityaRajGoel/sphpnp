/**
 * NSE's daily "FII derivatives statistics" file (nsearchives .../fo/fii_stats_DD-Mon-YYYY.xls):
 * FII buying, selling and end-of-day open interest per instrument, in contracts and
 * crore. The layout has been the same since at least 2018: the instrument in the first
 * column, then buy contracts, buy crore, sell contracts, sell crore, OI contracts, OI
 * crore. From 2023 the file adds per-index sub-rows (NIFTY FUTURES, BANKNIFTY OPTIONS)
 * that roll up into the four top-level rows, so only those four are read.
 */

export const FII_INSTRUMENTS = ["INDEX FUTURES", "INDEX OPTIONS", "STOCK FUTURES", "STOCK OPTIONS"] as const;
export type FiiInstrument = (typeof FII_INSTRUMENTS)[number];

export type FiiDerivativeRow = {
  trade_date: string;
  instrument: string;
  buy_contracts: number;
  buy_cr: number;
  sell_contracts: number;
  sell_cr: number;
  oi_contracts: number;
  oi_cr: number;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-10-01" -> the archive URL for that day's file. */
export function fiiStatsUrl(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `https://nsearchives.nseindia.com/content/fo/fii_stats_${d}-${MONTHS[Number(m) - 1]}-${y}.xls`;
}

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : NaN;
};
const round2 = (n: number) => Math.round(n * 100) / 100;

/** The four top-level instrument rows of one file; empty when the sheet is not that file. */
export function parseFiiStats(rows: unknown[][], isoDate: string): FiiDerivativeRow[] {
  const out: FiiDerivativeRow[] = [];
  for (const r of rows) {
    const instrument = String(r?.[0] ?? "").trim().toUpperCase();
    if (!(FII_INSTRUMENTS as readonly string[]).includes(instrument)) continue;
    const v = [1, 2, 3, 4, 5, 6].map((i) => num(r[i]));
    if (v.some((x) => Number.isNaN(x) || x < 0)) continue;
    out.push({
      trade_date: isoDate, instrument,
      buy_contracts: v[0], buy_cr: round2(v[1]), sell_contracts: v[2], sell_cr: round2(v[3]), oi_contracts: v[4], oi_cr: round2(v[5]),
    });
  }
  return out;
}

/** Monday-to-Friday dates from `from` to `to` inclusive (ISO); exchange holidays simply 404 and are skipped. */
export function weekdaysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += 86_400_000) {
    const day = new Date(t).getUTCDay();
    if (day !== 0 && day !== 6) out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

/**
 * Chart series for a stock page, derived from the stored statements and
 * profile (stock_statements / stock_profiles). IndianAPI's grids are used where
 * the stock has them, Google Finance's otherwise. Amounts stay in crore as
 * stored; a point whose figure the source did not report is null, and a chart
 * with no reported points is not drawn at all.
 */
import type { HolderSeries, RoePoint, StatementGrid, StatementKind } from "@/lib/statements";

type Statements = Partial<Record<StatementKind, StatementGrid>>;

export type PerformancePoint = { period: string; revenue: number | null; profit: number | null; margin: number | null; netMargin: number | null };
export type CashflowPoint = { period: string; operating: number | null; investing: number | null; financing: number | null; free: number | null };
export type CapitalPoint = { period: string; equity: number | null; debt: number | null; debtToEquity: number | null };
export type Slice = { name: string; value: number };
export type RoeBar = { period: string; roe: number };

const QUARTERS = 12;
const YEARS = 10;

const rowOf = (grid: StatementGrid, pattern: RegExp) => grid.rows.find((r) => pattern.test(r.label))?.values;
/** Dated columns only (TTM dropped), the most recent `max`. */
const datedColumns = (grid: StatementGrid, max: number) =>
  grid.periods.map((p, i) => ({ p, i })).filter(({ p }) => p !== "TTM").slice(-max);
const at = (values: (number | null)[] | undefined, i: number) => {
  const v = values?.[i];
  return v === undefined || v === null || !Number.isFinite(v) ? null : v;
};
const ratio = (num: number | null, den: number | null) => (num === null || den === null || den <= 0 ? null : (num / den) * 100);
const sum = (values: (number | null)[]) => {
  const present = values.filter((v): v is number => v !== null);
  return present.length === 0 ? null : present.reduce((a, b) => a + b, 0);
};
const hasAny = <T extends Record<string, unknown>>(points: T[], keys: (keyof T)[]) =>
  points.some((p) => keys.some((k) => p[k] !== null));

function performance(grid: StatementGrid | undefined, max: number, google: boolean): PerformancePoint[] {
  if (!grid) return [];
  const revenue = rowOf(grid, google ? /^Revenue$/ : /^(Sales|Revenue)$/);
  const profit = rowOf(grid, google ? /^Net income$/ : /^Net Profit$/);
  // A bank's "Financing Margin %" is not an operating margin; banks get no margin line.
  const opm = google ? undefined : rowOf(grid, /^OPM %$/);
  const operating = google ? rowOf(grid, /^Operating income$/) : undefined;
  const points = datedColumns(grid, max).map(({ p, i }) => {
    const rev = at(revenue, i);
    const net = at(profit, i);
    return {
      period: p,
      revenue: rev,
      profit: net,
      margin: google ? ratio(at(operating, i), rev) : at(opm, i),
      netMargin: ratio(net, rev),
    };
  });
  return hasAny(points, ["revenue", "profit"]) ? points : [];
}

/** Revenue, net profit and operating margin for the last twelve quarters. */
export function quarterlyPerformance(statements: Statements): PerformancePoint[] {
  return statements.quarter_results
    ? performance(statements.quarter_results, QUARTERS, false)
    : performance(statements.gf_income_quarterly, QUARTERS, true);
}

/** The same for up to ten fiscal years. */
export function annualPerformance(statements: Statements): PerformancePoint[] {
  return statements.yoy_results
    ? performance(statements.yoy_results, YEARS, false)
    : performance(statements.gf_income_annual, YEARS, true);
}

/** Operating, investing, financing and free cash flow by fiscal year. */
export function cashflowSeries(statements: Statements): CashflowPoint[] {
  const indian = statements.cashflow;
  const grid = indian ?? statements.gf_cashflow_annual;
  if (!grid) return [];
  const [op, inv, fin, free] = indian
    ? [/^Cash from Operating Activity$/, /^Cash from Investing Activity$/, /^Cash from Financing Activity$/, /^Free Cash Flow$/]
    : [/^Cash from operations$/, /^Cash from investing$/, /^Cash from financing$/, /^Free cash flow$/];
  const rows = [op, inv, fin, free].map((p) => rowOf(grid, p));
  const points = datedColumns(grid, YEARS).map(({ p, i }) => ({
    period: p,
    operating: at(rows[0], i),
    investing: at(rows[1], i),
    financing: at(rows[2], i),
    free: at(rows[3], i),
  }));
  return hasAny(points, ["operating", "investing", "financing"]) ? points : [];
}

/** Shareholders' equity against borrowings by fiscal year. */
export function capitalStructure(statements: Statements): CapitalPoint[] {
  const indian = statements.balancesheet;
  const grid = indian ?? statements.gf_balance_annual;
  if (!grid) return [];
  const equityRows = indian ? [rowOf(grid, /^Equity Capital$/), rowOf(grid, /^Reserves$/)] : [rowOf(grid, /^Total equity$/)];
  const debtRows = indian
    ? [rowOf(grid, /^Borrowings?$/)]
    : [rowOf(grid, /^Long term debt$/), rowOf(grid, /^Short term borrowings$/), rowOf(grid, /^Current portion long term debt$/)];
  const points = datedColumns(grid, YEARS).map(({ p, i }) => {
    const equityParts = equityRows.map((r) => at(r, i));
    // Equity capital without reserves is not equity; both or neither.
    const equity = indian && equityParts.some((v) => v === null) ? null : sum(equityParts);
    const debt = sum(debtRows.map((r) => at(r, i)));
    return { period: p, equity, debt, debtToEquity: equity !== null && equity > 0 && debt !== null ? debt / equity : null };
  });
  return hasAny(points, ["equity", "debt"]) ? points : [];
}

/** The latest filing's split between holder categories. */
export function shareholdingSlices(shareholding: HolderSeries[]): { date: string | null; slices: Slice[] } {
  const dates = shareholding.flatMap((s) => s.points.map((p) => p.date)).sort();
  const date = dates.length > 0 ? dates[dates.length - 1] : null;
  if (!date) return { date: null, slices: [] };
  const slices = shareholding
    .map((s) => ({ name: s.category, value: s.points.find((p) => p.date === date)?.pct ?? 0 }))
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value);
  return { date, slices };
}

export type HolderTrend = { categories: string[]; rows: Record<string, string | number>[] };

/**
 * The last `quarters` filings as one row per filing date and one key per holder
 * category (% of equity), for a stacked bar per quarter. Categories run largest
 * first by the latest filing, so the stack order stays put from bar to bar.
 */
export function shareholdingTrend(shareholding: HolderSeries[], quarters = 8): HolderTrend {
  const dates = [...new Set(shareholding.flatMap((s) => s.points.map((p) => p.date)))].sort().slice(-quarters);
  if (dates.length === 0) return { categories: [], rows: [] };
  const latest = dates[dates.length - 1];
  const pctAt = (s: HolderSeries, date: string) => s.points.find((p) => p.date === date)?.pct ?? 0;
  const held = shareholding.filter((s) => dates.some((d) => pctAt(s, d) > 0));
  const categories = [...held].sort((a, b) => pctAt(b, latest) - pctAt(a, latest)).map((s) => s.category);
  const rows = dates.map((date) => Object.fromEntries([["date", date], ...held.map((s) => [s.category, pctAt(s, date)])]));
  return { categories, rows };
}

export type DividendYear = { year: string; dps: number };
type Action = { ex_date: string; action_type: string; value: number | null };

/** Indian fiscal year of a YYYY-MM-DD date: April 2025 to March 2026 is FY26 (2026). */
const fiscalYear = (date: string) => {
  const [y, m] = date.split("-").map(Number);
  return m >= 4 ? y + 1 : y;
};

/**
 * Dividend per share by fiscal year and ex-date, oldest first, the last `span`
 * years. A year that paid nothing is a zero bar, not a missing one. The fiscal
 * year of the oldest stored action is left out, because the history can start
 * part-way through it. Amounts are as paid, so a split or bonus inside the
 * charted years comes back as `reset`: bars before it are per pre-split share.
 */
export function dividendsByYear(actions: readonly Action[], span = 10): { years: DividendYear[]; reset: { type: string; date: string } | null } {
  const paid = new Map<number, number>();
  for (const a of actions) {
    if (a.action_type === "dividend" && a.value !== null && a.value > 0) {
      const fy = fiscalYear(a.ex_date);
      paid.set(fy, (paid.get(fy) ?? 0) + a.value);
    }
  }
  if (paid.size === 0) return { years: [], reset: null };
  const last = Math.max(...paid.keys());
  const first = Math.max(Math.min(...actions.map((a) => fiscalYear(a.ex_date))) + 1, Math.min(...paid.keys()), last - span + 1);
  if (first > last) return { years: [], reset: null };
  const years = Array.from({ length: last - first + 1 }, (_, i) => first + i).map((fy) => ({
    year: `FY${String(fy).slice(2)}`,
    dps: Math.round((paid.get(fy) ?? 0) * 100) / 100,
  }));
  const reset = actions
    .filter((a) => (a.action_type === "split" || a.action_type === "bonus") && a.ex_date >= `${first - 1}-04-01`)
    .sort((a, b) => b.ex_date.localeCompare(a.ex_date))[0];
  return { years, reset: reset ? { type: reset.action_type, date: reset.ex_date } : null };
}

/** Return on equity by fiscal year - IndianAPI's derived history, else Google's balance sheet row. */
export function roeSeries(history: RoePoint[] | undefined, statements: Statements): RoeBar[] {
  if (history && history.length > 0) {
    return history.slice(-YEARS).map((h) => ({ period: `FY${h.period_end.slice(2, 4)}`, roe: h.roe }));
  }
  const grid = statements.gf_balance_annual;
  if (!grid) return [];
  const roe = rowOf(grid, /^Return on equity/);
  return datedColumns(grid, YEARS)
    .map(({ p, i }) => ({ period: p, roe: at(roe, i) }))
    .filter((b): b is RoeBar => b.roe !== null);
}

/** Crore, written short for an axis: 1,23,456 Cr as "1.2L Cr". */
export function shortCrore(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  const one = (n: number) => n.toFixed(1).replace(/\.0$/, "");
  if (abs >= 100000) return `${sign}${one(abs / 100000)}L Cr`;
  if (abs >= 1000) return `${sign}${one(abs / 1000)}K Cr`;
  return `${sign}${abs.toFixed(0)} Cr`;
}

/**
 * Axis ticks on round steps (1, 2, 2.5 or 5 x 10^n), from zero or below it
 * to the top of the data, about `steps` intervals. Recharts' own picker lands
 * on steps like 5.5K and 7, which read as arbitrary.
 */
export function niceTicks(values: readonly (number | null | undefined)[], steps = 4): number[] {
  const nums = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const lo = Math.min(0, ...nums);
  const hi = Math.max(0, ...nums);
  if (hi === lo) return [0, 1];
  const rough = (hi - lo) / steps;
  const mag = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= rough) ?? 10 * mag;
  const start = Math.floor(lo / step);
  const end = Math.ceil(hi / step);
  return Array.from({ length: end - start + 1 }, (_, i) => Number(((start + i) * step).toPrecision(12)));
}

/**
 * Compound annual growth of one figure over the last `years` fiscal years, as
 * a percentage. Absent without both endpoints, or when the starting figure was
 * not positive - compounding from a loss has no meaning.
 */
export function cagr(points: PerformancePoint[], key: "revenue" | "profit", years: number): number | null {
  if (points.length <= years) return null;
  const end = points[points.length - 1][key];
  const start = points[points.length - 1 - years][key];
  if (end === null || start === null || start <= 0 || end <= 0) return null;
  return (Math.pow(end / start, 1 / years) - 1) * 100;
}

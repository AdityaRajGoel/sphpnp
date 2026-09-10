/**
 * Display rules for the IndianAPI statements and profile on a stock page
 * (stock_statements / stock_profiles, written by sync-stock-statements).
 *
 * Statement figures are stored in crore and percentages as percentages, as
 * upstream sends them. Nothing here converts units; it only decides how each
 * figure is written and which columns fit.
 */

export type StatementKind = "quarter_results" | "yoy_results" | "balancesheet" | "cashflow" | "ratios";

export type StatementRow = { label: string; values: (number | null)[] };

export type StatementGrid = {
  statement: StatementKind;
  periods: string[];
  period_ends: (string | null)[];
  rows: StatementRow[];
  verified: boolean;
  fetched_at: string;
};

export type KeyMetrics = Record<string, Record<string, number | null>>;
export type RoePoint = { period_end: string; roe: number };
export type HolderSeries = { category: string; points: { date: string; pct: number }[] };
export type MovingAverage = { days: number; nse: number | null; bse: number | null };

export const ABSENT = "—";

const grouped = (n: number, digits: number) =>
  n.toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits });

/**
 * One cell. Crore figures keep upstream's precision (whole crore - two
 * decimals would claim accuracy the source does not have); "%" rows read as
 * percentages; EPS is rupees and paise.
 */
export function formatStatementValue(label: string, value: number | null): string {
  if (value === null || !Number.isFinite(value)) return ABSENT;
  if (label.trim().endsWith("%")) return `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
  if (/^EPS/i.test(label)) return `₹${value.toFixed(2)}`;
  return grouped(value, Number.isInteger(value) ? 0 : 2);
}

/**
 * Indices of the columns to show: the most recent `max` periods, oldest to
 * newest, with TTM kept whenever the statement has it - the trailing year is
 * the figure a reader looks for first.
 */
export function visibleColumns(grid: StatementGrid, max: number): number[] {
  const all = grid.periods.map((_, i) => i);
  if (all.length <= max) return all;
  const ttm = grid.periods.indexOf("TTM");
  if (ttm === -1) return all.slice(-max);
  const dated = all.filter((i) => i !== ttm);
  return [...dated.slice(-(max - 1)), ttm];
}

type Card = { label: string; value: string; hint?: string };

const metric = (km: KeyMetrics, group: string, key: string): number | null => km[group]?.[key] ?? null;
const fixed = (n: number | null, digits: number, suffix = "") => (n === null ? ABSENT : `${n.toFixed(digits)}${suffix}`);
const fiscalLabel = (periodEnd: string) => `FY${periodEnd.slice(2, 4)}`;

/**
 * The headline ratios, each from the most direct source available. ROE is
 * derived from the stored statements (net profit over average equity) rather
 * than taken from keyMetrics, whose figure is a 5-year average - a different
 * question. A metric the source did not report shows as absent.
 */
export function keyMetricCards(km: KeyMetrics, roe: RoePoint[], ratios: StatementRow[]): Card[] {
  const latestRoe = roe.length > 0 ? roe[roe.length - 1] : null;
  const roceRow = ratios.find((r) => r.label === "ROCE %");
  const roce = roceRow ? [...roceRow.values].reverse().find((v): v is number => v !== null) ?? null : null;
  return [
    { label: "P/E (TTM)", value: fixed(metric(km, "valuation", "pPerEBasicExcludingExtraordinaryItemsTTM"), 1) },
    { label: "Price / Book", value: fixed(metric(km, "valuation", "priceToBookMostRecentFiscalYear"), 2) },
    {
      label: latestRoe ? `ROE (${fiscalLabel(latestRoe.period_end)})` : "ROE",
      value: latestRoe ? `${latestRoe.roe.toFixed(1)}%` : ABSENT,
      hint: "Net profit over average shareholders' equity",
    },
    { label: "ROCE (latest year)", value: roce === null ? ABSENT : `${Number.isInteger(roce) ? roce : roce.toFixed(1)}%` },
    { label: "Dividend yield", value: fixed(metric(km, "valuation", "currentDividendYieldCommonStockPrimaryIssueLTM"), 2, "%") },
    { label: "Net margin (TTM)", value: fixed(metric(km, "margins", "netProfitMarginPercentTrailing12Month"), 1, "%") },
    { label: "Current ratio", value: fixed(metric(km, "financialstrength", "currentRatioMostRecentFiscalYear"), 2) },
    { label: "Debt / Equity", value: fixed(metric(km, "financialstrength", "ltDebtPerEquityMostRecentFiscalYear"), 2), hint: "Long-term debt, latest fiscal year" },
    { label: "Revenue growth (5y)", value: fixed(metric(km, "growth", "revenueGrowthRate5Year"), 1, "%") },
    { label: "EPS growth (5y)", value: fixed(metric(km, "growth", "ePSGrowthRate5Year"), 1, "%") },
  ];
}

/** A holder category's latest reading and its change since the previous one. */
export function latestHolding(series: HolderSeries): { date: string; pct: number; change: number | null } | null {
  const { points } = series;
  const last = points[points.length - 1];
  if (!last) return null;
  const previous = points.length > 1 ? points[points.length - 2] : undefined;
  return {
    date: last.date,
    pct: last.pct,
    change: previous ? Math.round((last.pct - previous.pct) * 100) / 100 : null,
  };
}

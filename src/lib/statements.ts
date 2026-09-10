/**
 * Display rules for the IndianAPI statements and profile on a stock page
 * (stock_statements / stock_profiles, written by sync-stock-statements).
 *
 * Statement figures are stored in crore and percentages as percentages, as
 * upstream sends them. Nothing here converts units; it only decides how each
 * figure is written and which columns fit.
 */

export type IndianApiKind = "quarter_results" | "yoy_results" | "balancesheet" | "cashflow" | "ratios";
export type GoogleFinanceKind =
  | "gf_income_quarterly" | "gf_income_annual"
  | "gf_balance_quarterly" | "gf_balance_annual"
  | "gf_cashflow_quarterly" | "gf_cashflow_annual";
export type StatementKind = IndianApiKind | GoogleFinanceKind;

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

/** Google Finance's key stats (via SerpApi) - the fallback for metrics IndianAPI did not report. */
export type FallbackStats = { pe: number | null; eps: number | null; dividend_yield_pct: number | null; roe_pct: number | null };

const NO_FALLBACK: FallbackStats = { pe: null, eps: null, dividend_yield_pct: null, roe_pct: null };

const metric = (km: KeyMetrics, group: string, key: string): number | null => km[group]?.[key] ?? null;
const fixed = (n: number | null, digits: number, suffix = "") => (n === null ? ABSENT : `${n.toFixed(digits)}${suffix}`);
const fiscalLabel = (periodEnd: string) => `FY${periodEnd.slice(2, 4)}`;
const rupeesOrAbsent = (n: number | null) => (n === null ? ABSENT : `₹${n.toFixed(2)}`);

/**
 * The headline ratios, each from the most direct source available. ROE is
 * derived from the stored statements (net profit over average equity) rather
 * than taken from keyMetrics, whose figure is a 5-year average - a different
 * question. A metric the source did not report shows as absent.
 */
export function keyMetricCards(km: KeyMetrics, roe: RoePoint[], ratios: StatementRow[], fallback: FallbackStats = NO_FALLBACK): Card[] {
  const latestRoe = roe.length > 0 ? roe[roe.length - 1] : null;
  // IndianAPI first; Google Finance only where IndianAPI reported nothing.
  const or = (primary: number | null, secondary: number | null) => primary ?? secondary;
  const roceRow = ratios.find((r) => r.label === "ROCE %");
  const roce = roceRow ? [...roceRow.values].reverse().find((v): v is number => v !== null) ?? null : null;
  return [
    { label: "P/E (TTM)", value: fixed(or(metric(km, "valuation", "pPerEBasicExcludingExtraordinaryItemsTTM"), fallback.pe), 1) },
    // Upstream's own key, typos included ("Iitems", "12onth").
    { label: "EPS (TTM)", value: rupeesOrAbsent(or(metric(km, "persharedata", "eEPSExcludingExtraordinaryIitemsTrailing12onth"), fallback.eps)) },
    { label: "Price / Book", value: fixed(metric(km, "valuation", "priceToBookMostRecentFiscalYear"), 2) },
    {
      label: latestRoe ? `ROE (${fiscalLabel(latestRoe.period_end)})` : "ROE",
      value: latestRoe ? `${latestRoe.roe.toFixed(1)}%` : fallback.roe_pct === null ? ABSENT : `${fallback.roe_pct.toFixed(1)}%`,
      hint: "Net profit over average shareholders' equity",
    },
    { label: "ROCE (latest year)", value: roce === null ? ABSENT : `${Number.isInteger(roce) ? roce : roce.toFixed(1)}%` },
    { label: "Dividend yield", value: fixed(or(metric(km, "valuation", "currentDividendYieldCommonStockPrimaryIssueLTM"), fallback.dividend_yield_pct), 2, "%") },
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

export type StatementTab = { kind: StatementKind; label: string; caption: string };

const INDIANAPI_TABS: StatementTab[] = [
  { kind: "quarter_results", label: "Quarterly", caption: "Quarterly results" },
  { kind: "yoy_results", label: "Profit & loss", caption: "Annual profit and loss, with trailing twelve months" },
  { kind: "balancesheet", label: "Balance sheet", caption: "Balance sheet at each fiscal year end" },
  { kind: "cashflow", label: "Cash flow", caption: "Cash flows for each fiscal year" },
  { kind: "ratios", label: "Ratios", caption: "Efficiency and return ratios for each fiscal year" },
];

const GOOGLE_TABS: StatementTab[] = [
  { kind: "gf_income_quarterly", label: "Quarterly", caption: "Quarterly income statement" },
  { kind: "gf_income_annual", label: "Profit & loss", caption: "Annual income statement by fiscal year" },
  { kind: "gf_balance_annual", label: "Balance sheet", caption: "Balance sheet at each fiscal year end" },
  { kind: "gf_balance_quarterly", label: "Balance sheet (quarterly)", caption: "Balance sheet at each quarter end" },
  { kind: "gf_cashflow_annual", label: "Cash flow", caption: "Cash flows for each fiscal year" },
  { kind: "gf_cashflow_quarterly", label: "Cash flow (quarterly)", caption: "Cash flows for each quarter" },
];

/**
 * The statement tabs to show, from one source only. IndianAPI's when the stock
 * has any - they are Screener's layout and the primary source - and Google
 * Finance's otherwise. Never both: two sets of figures for the same quarter,
 * defined differently, would read as a contradiction.
 */
export function statementTabs(statements: Partial<Record<StatementKind, StatementGrid>>): { source: "indianapi" | "google_finance" | null; tabs: StatementTab[] } {
  const indian = INDIANAPI_TABS.filter((tab) => statements[tab.kind]);
  if (indian.length > 0) return { source: "indianapi", tabs: indian };
  const google = GOOGLE_TABS.filter((tab) => statements[tab.kind]);
  return google.length > 0 ? { source: "google_finance", tabs: google } : { source: null, tabs: [] };
}

/** The latest annual "Return on equity %" in Google's balance sheet, for the ROE fallback. */
export function googleRoe(statements: Partial<Record<StatementKind, StatementGrid>>): number | null {
  const row = statements.gf_balance_annual?.rows.find((r) => /^Return on equity/.test(r.label));
  return row ? [...row.values].reverse().find((v): v is number => v !== null) ?? null : null;
}

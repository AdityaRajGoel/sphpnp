// One row of screener fundamentals per stock, derived from what the stock
// syncs have already stored (stock_statements, stock_profiles) - no request to
// any provider. IndianAPI's figures are used where a stock has them and Google
// Finance's otherwise, and the summary records which. A figure neither source
// supports is null, never estimated.
//
// Pure: no fetch, no Deno APIs. build-screener-fundamentals does the I/O.

type Grid = { periods: string[]; period_ends: (string | null)[]; rows: { label: string; values: (number | null)[] }[] };
type KeyMetrics = Record<string, Record<string, number | null>>;

export type FundamentalsSource = "indianapi" | "google_finance";

export type FundamentalsSummary = {
  source: FundamentalsSource;
  roe: number | null;
  roce: number | null;
  opm: number | null;
  sales_growth_yoy: number | null;
  profit_growth_yoy: number | null;
  debt_to_equity: number | null;
  pb: number | null;
  dividend_yield: number | null;
  eps_ttm: number | null;
  latest_quarter: string | null;
};

export type SummaryInput = {
  source: FundamentalsSource;
  quarters?: Grid;
  balance?: Grid;
  ratios?: Grid;
  keyMetrics?: KeyMetrics;
  roeHistory?: { period_end: string; roe: number }[];
  googleStats?: { pe: number | null; eps: number | null; dividend_yield_pct: number | null };
};

const row = (grid: Grid | undefined, pattern: RegExp) => grid?.rows.find((r) => pattern.test(r.label));
const lastValue = (values: (number | null)[] | undefined) =>
  values ? [...values].reverse().find((v): v is number => v !== null && Number.isFinite(v)) ?? null : null;
/** The latest dated column, skipping a trailing TTM. */
const latestIndex = (grid: Grid | undefined) => {
  if (!grid) return -1;
  for (let i = grid.periods.length - 1; i >= 0; i--) if (grid.periods[i] !== "TTM") return i;
  return -1;
};

/**
 * Latest quarter against the same quarter a year earlier (four columns back),
 * as a percentage. Absent without a year-ago figure, or when that figure was
 * zero or a loss - growth from a loss is not a percentage anyone can read.
 */
export function yoyGrowth(grid: Grid, label: string | RegExp): number | null {
  const pattern = typeof label === "string" ? new RegExp(`^${label}$`) : label;
  const r = row(grid, pattern);
  const i = latestIndex(grid);
  if (!r || i < 4) return null;
  const now = r.values[i];
  const then = r.values[i - 4];
  if (now === null || then === null || then <= 0) return null;
  return (now / then - 1) * 100;
}

const metric = (km: KeyMetrics | undefined, group: string, key: string) => km?.[group]?.[key] ?? null;

function valueAtLatest(grid: Grid | undefined, pattern: RegExp): number | null {
  const r = row(grid, pattern);
  const i = latestIndex(grid);
  return r && i >= 0 ? r.values[i] : null;
}

export function summariseFundamentals(input: SummaryInput): FundamentalsSummary {
  const { source, quarters, balance, ratios, keyMetrics, roeHistory, googleStats } = input;
  const qEnd = quarters ? quarters.period_ends[latestIndex(quarters)] ?? null : null;

  if (source === "indianapi") {
    // A bank's statement has Revenue / Financing Margin % where others have Sales / OPM %.
    const equity = (() => {
      const capital = valueAtLatest(balance, /^Equity Capital$/);
      const reserves = valueAtLatest(balance, /^Reserves$/);
      return capital === null || reserves === null ? null : capital + reserves;
    })();
    const borrowings = valueAtLatest(balance, /^Borrowings?$/);
    return {
      source,
      roe: roeHistory && roeHistory.length > 0 ? roeHistory[roeHistory.length - 1].roe : null,
      roce: lastValue(row(ratios, /^ROCE %$/)?.values),
      opm: quarters ? valueAtLatest(quarters, /^(OPM %|Financing Margin %)$/) : null,
      sales_growth_yoy: quarters ? yoyGrowth(quarters, /^(Sales|Revenue)$/) : null,
      profit_growth_yoy: quarters ? yoyGrowth(quarters, "Net Profit") : null,
      debt_to_equity: equity !== null && equity > 0 && borrowings !== null ? borrowings / equity : null,
      pb: metric(keyMetrics, "valuation", "priceToBookMostRecentFiscalYear"),
      dividend_yield: metric(keyMetrics, "valuation", "currentDividendYieldCommonStockPrimaryIssueLTM"),
      eps_ttm: metric(keyMetrics, "persharedata", "eEPSExcludingExtraordinaryIitemsTrailing12onth"),
      latest_quarter: qEnd,
    };
  }

  // Google Finance: amounts already in crore, percentages labelled with "%".
  const revenue = valueAtLatest(quarters, /^Revenue$/);
  const operating = valueAtLatest(quarters, /^Operating income$/);
  const equity = valueAtLatest(balance, /^Total equity$/);
  const debtParts = [/^Long term debt$/, /^Short term borrowings$/, /^Current portion long term debt$/]
    .map((p) => valueAtLatest(balance, p))
    .filter((v): v is number => v !== null);
  return {
    source,
    roe: lastValue(row(balance, /^Return on equity/)?.values),
    roce: lastValue(row(balance, /^Return on capital/)?.values),
    opm: revenue !== null && revenue > 0 && operating !== null ? (operating / revenue) * 100 : null,
    sales_growth_yoy: quarters ? yoyGrowth(quarters, "Revenue") : null,
    profit_growth_yoy: quarters ? yoyGrowth(quarters, "Net income") : null,
    debt_to_equity: equity !== null && equity > 0 && debtParts.length > 0 ? debtParts.reduce((a, b) => a + b, 0) / equity : null,
    pb: lastValue(row(balance, /^Price to book$/)?.values),
    dividend_yield: googleStats?.dividend_yield_pct ?? null,
    eps_ttm: googleStats?.eps ?? null,
    latest_quarter: qEnd,
  };
}

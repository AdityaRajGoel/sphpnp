import type { ScreenerStock } from "@/hooks/useScreenerStocks";
import type { FundamentalsSummary } from "@/lib/screener-fundamentals";
import type { RiskSummary } from "@/lib/screener-risk";
import type { ScoreSummary } from "@/lib/screener-scores";

/**
 * One registry of every per-stock number the site holds - live quote,
 * statement fundamentals, computed technicals, composite scores - plus the
 * metrics we DERIVE from them (earnings yield, Graham number, 12-1 momentum,
 * cross-sectional factor percentiles, Magic Formula rank).
 *
 * The screener's tables, scanners and custom filters, the stock page's
 * research profile and Market Pulse's breadth all read through here, so a
 * figure means the same thing on every surface.
 *
 * The rule inherited from every table this reads: a metric that cannot be
 * computed is null, never zero, and a null fails any filter that needs it.
 */

export type MetricQuote = Pick<ScreenerStock, "symbol" | "name" | "sector" | "price" | "change_pct" | "volume" | "pe" | "market_cap" | "high_52" | "low_52">;

export type FactorScores = {
  value: number | null;
  quality: number | null;
  momentum: number | null;
  low_vol: number | null;
  composite: number | null;
  magic_formula_rank: number | null;
};

export type MetricRow = {
  symbol: string;
  quote: MetricQuote | null;
  fundamentals: FundamentalsSummary | null;
  risk: RiskSummary | null;
  scores: ScoreSummary | null;
  factors: FactorScores | null;
};

export type MetricUnit = "pct" | "signed_pct" | "ratio" | "rupees" | "crore" | "sigma" | "points" | "percentile" | "rank" | "number";

export type MetricGroup =
  | "price" | "valuation" | "profitability" | "growth" | "balance_sheet" | "cash_flow"
  | "trend" | "oscillators" | "volume" | "risk" | "factors";

export const METRIC_GROUP_LABEL: Record<MetricGroup, string> = {
  price: "Price", valuation: "Valuation", profitability: "Profitability", growth: "Growth",
  balance_sheet: "Balance sheet", cash_flow: "Cash flow", trend: "Trend", oscillators: "Oscillators",
  volume: "Volume & delivery", risk: "Risk", factors: "Factor scores",
};

export type Metric = {
  id: string;
  label: string;
  title: string;
  group: MetricGroup;
  unit: MetricUnit;
  get: (row: MetricRow) => number | null;
  /** Colour by sign. Only for figures where up/down reads plainly (returns, growth) - never for risk. */
  signed?: boolean;
  /** Lower is the conventional "better" end; used for percentile direction, not colour. */
  lowerIsBetter?: boolean;
  /** Custom text, where the number alone would mislead (a Piotroski score without its denominator). */
  display?: (row: MetricRow) => string | null;
};

const finite = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);
const pos = (v: number | null | undefined): v is number => finite(v) && v > 0;

/** Quote fields use 0 as "unknown"; a real zero P/E or price does not exist. */
const quoteNum = (row: MetricRow, key: "price" | "pe" | "market_cap" | "high_52" | "low_52" | "volume"): number | null => {
  const v = row.quote?.[key];
  return pos(v) ? v : null;
};

const earningsYield = (row: MetricRow) => { const pe = quoteNum(row, "pe"); return pe === null ? null : 100 / pe; };

const grahamNumber = (row: MetricRow): number | null => {
  const eps = row.fundamentals?.eps_ttm;
  const pb = row.fundamentals?.pb;
  const price = quoteNum(row, "price");
  if (!pos(eps) || !pos(pb) || price === null) return null;
  // Book value per share recovered from price and P/B - both are as-of today.
  return Math.sqrt(22.5 * eps * (price / pb));
};

const momentum12_1 = (row: MetricRow): number | null => {
  const y = row.risk?.return_1y;
  const m = row.risk?.return_1m;
  if (!finite(y) || !finite(m) || m <= -100) return null;
  return ((1 + y / 100) / (1 + m / 100) - 1) * 100;
};

const piotroskiRatio = (row: MetricRow): number | null => {
  const s = row.scores;
  // Fewer than six testable criteria is too thin a basis to compare stocks on.
  return s && finite(s.piotroski_score) && finite(s.piotroski_testable) && s.piotroski_testable >= 6 ? s.piotroski_score / s.piotroski_testable : null;
};

const pctOf = (v: number | null | undefined) => (finite(v) ? v * 100 : null);
const f = (key: keyof FundamentalsSummary) => (row: MetricRow) => { const v = row.fundamentals?.[key]; return finite(v as number) ? (v as number) : null; };
const r = (key: keyof RiskSummary) => (row: MetricRow) => { const v = row.risk?.[key]; return finite(v as number) ? (v as number) : null; };
const s = (key: keyof ScoreSummary) => (row: MetricRow) => { const v = row.scores?.[key]; return finite(v as number) ? (v as number) : null; };
const fac = (key: keyof FactorScores) => (row: MetricRow) => { const v = row.factors?.[key]; return finite(v) ? v : null; };

export const METRICS: Metric[] = [
  // Price
  { id: "price", label: "Price", title: "Last traded price", group: "price", unit: "rupees", get: (row) => quoteNum(row, "price") },
  { id: "change_pct", label: "Day %", title: "Change on the previous close", group: "price", unit: "signed_pct", signed: true, get: (row) => (finite(row.quote?.change_pct) && row.quote!.price > 0 ? row.quote!.change_pct : null) },
  { id: "market_cap", label: "M-cap", title: "Market capitalisation, ₹ crore", group: "price", unit: "crore", get: (row) => quoteNum(row, "market_cap") },
  { id: "dist_52w_high", label: "From 52W high", title: "How far the price sits below its 52-week high", group: "price", unit: "signed_pct", get: (row) => { const p = quoteNum(row, "price"); const h = quoteNum(row, "high_52"); return p === null || h === null ? null : (p / h - 1) * 100; } },
  { id: "week52_position", label: "52W position", title: "Where the close sits in its 52-week range: 0 at the low, 100 at the high", group: "price", unit: "number", get: r("week52_position") },
  { id: "return_1m", label: "1M", title: "Price change over one month", group: "price", unit: "signed_pct", signed: true, get: r("return_1m") },
  { id: "return_3m", label: "3M", title: "Price change over three months", group: "price", unit: "signed_pct", signed: true, get: r("return_3m") },
  { id: "return_6m", label: "6M", title: "Price change over six months", group: "price", unit: "signed_pct", signed: true, get: r("return_6m") },
  { id: "return_1y", label: "1Y", title: "Price change over one year", group: "price", unit: "signed_pct", signed: true, get: r("return_1y") },
  { id: "momentum_12_1", label: "12-1 mom.", title: "One-year return excluding the latest month - the academic momentum measure, which skips the month where short-term reversal dominates", group: "price", unit: "signed_pct", signed: true, get: momentum12_1 },
  { id: "relative_strength_3m", label: "vs Nifty 3M", title: "Percentage points ahead of or behind the Nifty 50 over three months", group: "price", unit: "points", signed: true, get: r("relative_strength_3m") },

  // Valuation
  { id: "pe", label: "P/E", title: "Price to trailing earnings", group: "valuation", unit: "ratio", lowerIsBetter: true, get: (row) => quoteNum(row, "pe") },
  { id: "earnings_yield", label: "Earn. yield", title: "Earnings over price (1 / P/E) - comparable across stocks where P/E is not, and defined for low earners", group: "valuation", unit: "pct", get: earningsYield },
  { id: "pb", label: "P/B", title: "Price to book value", group: "valuation", unit: "ratio", lowerIsBetter: true, get: f("pb") },
  { id: "roe_to_pb", label: "ROE ÷ P/B", title: "Return on equity divided by price-to-book: the earnings yield an investor buying at today's price earns on book", group: "valuation", unit: "pct", get: (row) => { const roe = row.fundamentals?.roe; const pb = row.fundamentals?.pb; return finite(roe) && pos(pb) ? roe / pb : null; } },
  { id: "graham_number", label: "Graham no.", title: "√(22.5 × EPS × book value per share). Withheld for loss-makers and negative book value", group: "valuation", unit: "rupees", get: grahamNumber },
  { id: "graham_upside", label: "vs Graham", title: "Graham number against today's price. A description of a 1970s rule of thumb, not a fair value", group: "valuation", unit: "signed_pct", get: (row) => { const g = grahamNumber(row); const p = quoteNum(row, "price"); return g === null || p === null ? null : (g / p - 1) * 100; } },
  { id: "peg", label: "PEG", title: "P/E over profit growth. Withheld when profit is flat or falling", group: "valuation", unit: "ratio", lowerIsBetter: true, get: s("peg") },
  { id: "ev_to_sales", label: "EV/Sales", title: "Enterprise value over revenue", group: "valuation", unit: "ratio", lowerIsBetter: true, get: s("ev_to_sales") },
  { id: "dividend_yield", label: "Div. yield", title: "Dividend yield, trailing twelve months", group: "valuation", unit: "pct", get: f("dividend_yield") },
  { id: "fcf_yield", label: "FCF yield", title: "Free cash flow over market capitalisation", group: "valuation", unit: "pct", get: (row) => pctOf(row.scores?.fcf_yield) },

  // Profitability
  { id: "roe", label: "ROE", title: "Return on equity, latest fiscal year", group: "profitability", unit: "pct", get: f("roe") },
  { id: "roce", label: "ROCE", title: "Return on capital employed, latest fiscal year", group: "profitability", unit: "pct", get: f("roce") },
  { id: "opm", label: "OPM", title: "Operating margin, latest quarter", group: "profitability", unit: "pct", get: f("opm") },
  { id: "eps_ttm", label: "EPS (TTM)", title: "Earnings per share, trailing twelve months", group: "profitability", unit: "rupees", get: f("eps_ttm") },
  { id: "piotroski_score", label: "Piotroski", title: "Piotroski F-Score: criteria passed out of those that could be tested", group: "profitability", unit: "number", get: s("piotroski_score"), display: (row) => (row.scores && finite(row.scores.piotroski_score) ? `${row.scores.piotroski_score}/${row.scores.piotroski_testable ?? "?"}` : null) },

  // Growth
  { id: "sales_growth_yoy", label: "Sales YoY", title: "Latest quarter's revenue against the same quarter a year earlier", group: "growth", unit: "signed_pct", signed: true, get: f("sales_growth_yoy") },
  { id: "profit_growth_yoy", label: "Profit YoY", title: "Latest quarter's net profit against the same quarter a year earlier", group: "growth", unit: "signed_pct", signed: true, get: f("profit_growth_yoy") },
  { id: "revenue_cagr_3y", label: "Rev CAGR 3Y", title: "Three-year compound revenue growth", group: "growth", unit: "signed_pct", signed: true, get: s("revenue_cagr_3y") },
  { id: "profit_cagr_3y", label: "Profit CAGR 3Y", title: "Three-year compound profit growth", group: "growth", unit: "signed_pct", signed: true, get: s("profit_cagr_3y") },

  // Balance sheet
  { id: "debt_to_equity", label: "D/E", title: "Borrowings over shareholders' equity, latest fiscal year", group: "balance_sheet", unit: "ratio", lowerIsBetter: true, get: f("debt_to_equity") },
  { id: "net_debt_to_equity", label: "Net D/E", title: "Borrowings less cash, over equity. Negative means net cash", group: "balance_sheet", unit: "ratio", lowerIsBetter: true, get: s("net_debt_to_equity") },

  // Cash flow
  { id: "cash_conversion", label: "Cash conv.", title: "Operating cash flow per rupee of reported profit", group: "cash_flow", unit: "ratio", get: s("cash_conversion") },
  { id: "accruals_ratio", label: "Accruals", title: "(Profit − operating cash flow) / assets. High and positive is the earnings-quality warning", group: "cash_flow", unit: "ratio", lowerIsBetter: true, get: s("accruals_ratio") },
  { id: "payout_ratio", label: "Payout", title: "Dividends as a share of profit", group: "cash_flow", unit: "pct", get: (row) => pctOf(row.scores?.payout_ratio) },
  { id: "capex_intensity", label: "Capex / sales", title: "Capital spending as a share of revenue", group: "cash_flow", unit: "pct", get: (row) => pctOf(row.scores?.capex_intensity) },

  // Trend
  { id: "distance_from_200", label: "vs 200DMA", title: "Distance from the 200-day moving average", group: "trend", unit: "signed_pct", signed: true, get: r("distance_from_200") },
  { id: "price_vs_sma50", label: "vs 50DMA", title: "Distance from the 50-day moving average", group: "trend", unit: "signed_pct", signed: true, get: (row) => { const p = quoteNum(row, "price"); const m = row.risk?.sma_50; return p === null || !pos(m) ? null : (p / m - 1) * 100; } },
  { id: "macd_histogram", label: "MACD hist.", title: "MACD minus its signal line. Positive means momentum is building, not that price is rising", group: "trend", unit: "ratio", signed: true, get: r("macd_histogram") },
  { id: "adx", label: "ADX", title: "Trend strength (14), regardless of direction", group: "trend", unit: "number", get: r("adx") },
  { id: "di_spread", label: "+DI − −DI", title: "Directional index spread: positive when the up-moves dominate", group: "trend", unit: "points", signed: true, get: (row) => { const p = row.risk?.plus_di; const m = row.risk?.minus_di; return finite(p) && finite(m) ? p - m : null; } },

  // Oscillators
  { id: "rsi_14", label: "RSI", title: "Relative strength index (14), Wilder", group: "oscillators", unit: "number", get: r("rsi_14") },
  { id: "stochastic_k", label: "Stoch %K", title: "Stochastic oscillator %K (14, 3)", group: "oscillators", unit: "number", get: r("stochastic_k") },
  { id: "money_flow_index", label: "MFI", title: "Money flow index (14): RSI weighted by traded value", group: "oscillators", unit: "number", get: r("money_flow_index") },
  { id: "bollinger_percent_b", label: "%B", title: "Where the close sits across the Bollinger band: 0 at the lower band, 1 at the upper", group: "oscillators", unit: "ratio", get: r("bollinger_percent_b") },
  { id: "bollinger_bandwidth", label: "Band width", title: "Bollinger band width as a percentage of the 20-day average. Low values are the 'squeeze'", group: "oscillators", unit: "pct", get: r("bollinger_bandwidth") },

  // Volume & delivery
  { id: "volume_zscore", label: "Vol. σ", title: "Latest session's volume against the previous 20 sessions", group: "volume", unit: "sigma", get: r("volume_zscore") },
  { id: "delivery_recent", label: "Delivery", title: "Share of traded quantity settled as delivery, 20-day average", group: "volume", unit: "pct", get: r("delivery_recent") },
  { id: "delivery_change", label: "Δ Delivery", title: "Delivery share against its own 60-day baseline", group: "volume", unit: "points", signed: true, get: r("delivery_change") },
  { id: "obv_trend_20", label: "OBV 20D", title: "On-balance volume, percentage change over 20 sessions", group: "volume", unit: "signed_pct", signed: true, get: r("obv_trend_20") },
  { id: "close_vs_vwap", label: "vs VWAP", title: "Close against the day's true volume-weighted price", group: "volume", unit: "signed_pct", signed: true, get: r("close_vs_vwap") },

  // Risk
  { id: "volatility_1y", label: "Volatility", title: "Annualised volatility of daily returns over the past year", group: "risk", unit: "pct", lowerIsBetter: true, get: r("volatility_1y") },
  { id: "beta_1y", label: "Beta", title: "Sensitivity to the Nifty 50 over the past year", group: "risk", unit: "ratio", lowerIsBetter: true, get: r("beta_1y") },
  { id: "max_drawdown_1y", label: "Max DD", title: "Deepest peak-to-trough fall over the past year", group: "risk", unit: "pct", lowerIsBetter: true, get: r("max_drawdown_1y") },
  { id: "drawdown_from_peak", label: "Below peak", title: "How far the close sits below its one-year peak", group: "risk", unit: "pct", lowerIsBetter: true, get: r("drawdown_from_peak") },
  { id: "atr_pct_14", label: "ATR %", title: "Average true range (14) as a share of price: a typical day's swing", group: "risk", unit: "pct", lowerIsBetter: true, get: r("atr_pct_14") },
  { id: "return_to_vol", label: "Return / vol", title: "One-year return per unit of one-year volatility - a Sharpe ratio without the risk-free rate", group: "risk", unit: "ratio", signed: true, get: (row) => { const y = row.risk?.return_1y; const v = row.risk?.volatility_1y; return finite(y) && pos(v) ? y / v : null; } },

  // Factor scores (cross-sectional; see computeFactors)
  { id: "composite_score", label: "Composite", title: "Average of the value, quality, momentum and low-volatility percentiles, where at least three are known", group: "factors", unit: "percentile", get: fac("composite") },
  { id: "value_score", label: "Value", title: "Percentile among tracked stocks on earnings yield, book multiple and FCF yield", group: "factors", unit: "percentile", get: fac("value") },
  { id: "quality_score", label: "Quality", title: "Percentile on ROE, ROCE, margin, leverage and Piotroski", group: "factors", unit: "percentile", get: fac("quality") },
  { id: "momentum_score", label: "Momentum", title: "Percentile on 12-1 momentum, six-month return, relative strength and distance from the 200-day average", group: "factors", unit: "percentile", get: fac("momentum") },
  { id: "low_vol_score", label: "Low vol.", title: "Percentile on low volatility, low beta and shallow drawdown", group: "factors", unit: "percentile", get: fac("low_vol") },
  { id: "magic_formula_rank", label: "Magic Formula", title: "Greenblatt's rank: earnings-yield rank plus ROCE rank, 1 is best. Financials excluded, as in the original", group: "factors", unit: "rank", lowerIsBetter: true, get: fac("magic_formula_rank") },
];

export const METRIC_BY_ID = new Map(METRICS.map((m) => [m.id, m]));

export const metricValue = (row: MetricRow | undefined, id: string): number | null => {
  const metric = METRIC_BY_ID.get(id);
  return metric && row ? metric.get(row) : null;
};

export function formatMetric(value: number | null, unit: MetricUnit): string {
  if (value === null || !Number.isFinite(value)) return "—";
  switch (unit) {
    case "pct": return `${value.toFixed(1)}%`;
    case "signed_pct": return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
    case "points": return `${value > 0 ? "+" : ""}${value.toFixed(1)}`;
    case "sigma": return `${value > 0 ? "+" : ""}${value.toFixed(1)}σ`;
    case "rupees": return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
    case "crore": return value >= 1000 ? `₹${(value / 1000).toFixed(1)}K Cr` : `₹${value.toFixed(0)} Cr`;
    case "percentile": return value.toFixed(0);
    case "rank": return `#${value.toFixed(0)}`;
    case "number": return value.toFixed(1);
    default: return value.toFixed(2);
  }
}

export const displayMetric = (metric: Metric, row: MetricRow | undefined): string =>
  (row && metric.display?.(row)) ?? formatMetric(row ? metric.get(row) : null, metric.unit);

export const metricTone = (metric: Metric, value: number | null): "up" | "down" | null =>
  !metric.signed || value === null || !Number.isFinite(value) || value === 0 ? null : value > 0 ? "up" : "down";

/** Sort by one metric; rows without it go last whichever way the column sorts. */
export function sortByMetric<T extends { symbol: string }>(items: T[], rows: Map<string, MetricRow>, metric: Metric, dir: "asc" | "desc"): T[] {
  const value = (item: T) => { const row = rows.get(item.symbol); return row ? metric.get(row) : null; };
  return [...items].sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    if (va === null && vb === null) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    return dir === "asc" ? va - vb : vb - va;
  });
}

// ---------------------------------------------------------------------------
// Cross-sectional factors
// ---------------------------------------------------------------------------

/** Below this many stocks with a figure, a percentile says more about the sample than the stock. */
export const MIN_FACTOR_UNIVERSE = 20;

const FINANCIALS = /bank|nbfc|insurance|financ/i;

/** Mid-rank percentile (0-100) of every non-null value; ties share a percentile. */
export function percentiles(values: (number | null)[], lowerIsBetter = false): (number | null)[] {
  const known = values.filter(finite).sort((a, b) => a - b);
  const n = known.length;
  if (n < MIN_FACTOR_UNIVERSE) return values.map(() => null);
  const lowerBound = (v: number) => { let lo = 0, hi = n; while (lo < hi) { const mid = (lo + hi) >> 1; if (known[mid] < v) lo = mid + 1; else hi = mid; } return lo; };
  const upperBound = (v: number) => { let lo = 0, hi = n; while (lo < hi) { const mid = (lo + hi) >> 1; if (known[mid] <= v) lo = mid + 1; else hi = mid; } return lo; };
  return values.map((v) => {
    if (!finite(v)) return null;
    const below = lowerBound(v);
    const equal = upperBound(v) - below;
    const pct = ((below + (equal - 1) / 2) / (n - 1)) * 100;
    return lowerIsBetter ? 100 - pct : pct;
  });
}

type FactorInput = { get: (row: MetricRow) => number | null; lowerIsBetter?: boolean };

const FACTOR_INPUTS: Record<Exclude<keyof FactorScores, "composite" | "magic_formula_rank">, { inputs: FactorInput[]; minimum: number }> = {
  value: { inputs: [{ get: earningsYield }, { get: f("pb"), lowerIsBetter: true }, { get: (row) => pctOf(row.scores?.fcf_yield) }], minimum: 2 },
  quality: { inputs: [{ get: f("roe") }, { get: f("roce") }, { get: f("opm") }, { get: f("debt_to_equity"), lowerIsBetter: true }, { get: piotroskiRatio }], minimum: 3 },
  momentum: { inputs: [{ get: momentum12_1 }, { get: r("return_6m") }, { get: r("relative_strength_3m") }, { get: r("distance_from_200") }], minimum: 2 },
  low_vol: { inputs: [{ get: r("volatility_1y"), lowerIsBetter: true }, { get: r("beta_1y"), lowerIsBetter: true }, { get: r("max_drawdown_1y"), lowerIsBetter: true }], minimum: 2 },
};

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/**
 * Value, quality, momentum and low-volatility percentiles for every row,
 * relative to the rows passed in, plus Greenblatt's Magic Formula rank.
 *
 * Each factor averages the percentiles of its inputs that are known, and is
 * withheld below a minimum count - a "quality" built from ROE alone is just
 * ROE. The composite needs three of the four factors.
 */
export function computeFactors(rows: Omit<MetricRow, "factors">[]): Map<string, FactorScores> {
  const asRows = rows.map((row) => ({ ...row, factors: null }) as MetricRow);
  const factorValues: Record<string, (number | null)[]> = {};

  for (const [name, spec] of Object.entries(FACTOR_INPUTS)) {
    const columns = spec.inputs.map((input) => percentiles(asRows.map(input.get), input.lowerIsBetter));
    factorValues[name] = asRows.map((_, i) => {
      const known = columns.map((col) => col[i]).filter(finite);
      return known.length >= spec.minimum ? mean(known) : null;
    });
  }

  // Magic Formula: rank the eligible stocks on each leg, sum, then rank the sums.
  const eligible = asRows
    .map((row, i) => ({ i, ey: earningsYield(row), roce: row.fundamentals?.roce ?? null, financial: FINANCIALS.test(row.quote?.sector ?? "") }))
    .filter((x): x is { i: number; ey: number; roce: number; financial: boolean } => finite(x.ey) && finite(x.roce) && !x.financial);
  const magic = new Map<number, number>();
  if (eligible.length >= MIN_FACTOR_UNIVERSE) {
    const rankOf = (key: "ey" | "roce") => {
      const order = [...eligible].sort((a, b) => b[key] - a[key]);
      return new Map(order.map((x, rank) => [x.i, rank + 1]));
    };
    const eyRank = rankOf("ey");
    const roceRank = rankOf("roce");
    [...eligible]
      .sort((a, b) => eyRank.get(a.i)! + roceRank.get(a.i)! - (eyRank.get(b.i)! + roceRank.get(b.i)!))
      .forEach((x, rank) => magic.set(x.i, rank + 1));
  }

  const out = new Map<string, FactorScores>();
  asRows.forEach((row, i) => {
    const parts = ["value", "quality", "momentum", "low_vol"].map((k) => factorValues[k][i]).filter(finite);
    out.set(row.symbol, {
      value: factorValues.value[i],
      quality: factorValues.quality[i],
      momentum: factorValues.momentum[i],
      low_vol: factorValues.low_vol[i],
      composite: parts.length >= 3 ? mean(parts) : null,
      magic_formula_rank: magic.get(i) ?? null,
    });
  });
  return out;
}

/** Joins every source on symbol, quotes first, then fills in the cross-sectional factors. */
export function buildMetricRows(
  quotes: MetricQuote[],
  fundamentals: Map<string, FundamentalsSummary>,
  risk: Map<string, RiskSummary>,
  scores: Map<string, ScoreSummary>,
): Map<string, MetricRow> {
  const base = quotes.map((quote) => ({
    symbol: quote.symbol,
    quote,
    fundamentals: fundamentals.get(quote.symbol) ?? null,
    risk: risk.get(quote.symbol) ?? null,
    scores: scores.get(quote.symbol) ?? null,
  }));
  const factors = computeFactors(base);
  return new Map(base.map((row) => [row.symbol, { ...row, factors: factors.get(row.symbol) ?? null }]));
}

// ---------------------------------------------------------------------------
// Custom filter rules
// ---------------------------------------------------------------------------

export type RuleOp = ">" | ">=" | "<" | "<=";
export type Rule = { metric: string; op: RuleOp; value: number };

export const RULE_OPS: RuleOp[] = [">", ">=", "<", "<="];

const RULE_PATTERN = /^([a-z0-9_]+)(>=|<=|>|<)(-?\d+(?:\.\d+)?)$/;

/** "roe>15;pe<=20" → rules. Unknown metrics and malformed parts are dropped, not guessed at. */
export function parseRules(text: string | null | undefined): Rule[] {
  if (!text) return [];
  return text.split(";").flatMap((part) => {
    const match = RULE_PATTERN.exec(part.trim());
    if (!match || !METRIC_BY_ID.has(match[1])) return [];
    return [{ metric: match[1], op: match[2] as RuleOp, value: Number(match[3]) }];
  });
}

export const serializeRules = (rules: Rule[]): string => rules.map((rule) => `${rule.metric}${rule.op}${rule.value}`).join(";");

/** Every rule must hold. A stock missing a figure a rule needs does not pass it. */
export function passesRules(row: MetricRow | undefined, rules: Rule[]): boolean {
  return rules.every((rule) => {
    const v = metricValue(row, rule.metric);
    if (v === null) return false;
    switch (rule.op) {
      case ">": return v > rule.value;
      case ">=": return v >= rule.value;
      case "<": return v < rule.value;
      default: return v <= rule.value;
    }
  });
}

import { FUNDAMENTAL_SCREENS } from "@/lib/screener-fundamentals";
import { RISK_SCREENS } from "@/lib/screener-risk";
import { metricValue, type MetricRow } from "@/lib/screener-metrics";

/**
 * Every ready-made scan the site offers, over the joined metric rows.
 *
 * The copy is descriptive on purpose: "RSI at or below 30" says where an
 * indicator sits, not what anyone should do. A scan needing a figure a stock
 * lacks does not match it - an unknown RSI is not an oversold one.
 */

export type ScanGroup = "today" | "trend" | "oscillators" | "volume" | "risk" | "fundamental" | "scores";

export const SCAN_GROUPS: { id: ScanGroup; label: string; view: "list" | "fundamentals" | "risk" | "technicals" | "scores" }[] = [
  { id: "today", label: "Today", view: "list" },
  { id: "trend", label: "Trend", view: "technicals" },
  { id: "oscillators", label: "Oscillators", view: "technicals" },
  { id: "volume", label: "Volume & delivery", view: "risk" },
  { id: "risk", label: "Risk", view: "risk" },
  { id: "fundamental", label: "Fundamentals", view: "fundamentals" },
  { id: "scores", label: "Scores & factors", view: "scores" },
];

export type Scan = { id: string; name: string; desc: string; group: ScanGroup; test: (row: MetricRow) => boolean };

const v = metricValue;
const gt = (row: MetricRow, id: string, x: number) => { const n = v(row, id); return n !== null && n > x; };
const gte = (row: MetricRow, id: string, x: number) => { const n = v(row, id); return n !== null && n >= x; };
const lt = (row: MetricRow, id: string, x: number) => { const n = v(row, id); return n !== null && n < x; };
const lte = (row: MetricRow, id: string, x: number) => { const n = v(row, id); return n !== null && n <= x; };

export const SCANS: Scan[] = [
  // Today - live quote only. Ids predate this file and are kept for shared links.
  { id: "vol_shocker", group: "today", name: "Volume shockers", desc: "Over 50 lakh shares traded and a 2%+ move", test: (row) => !!row.quote && row.quote.volume > 5_000_000 && Math.abs(row.quote.change_pct) > 2 },
  { id: "momentum", group: "today", name: "Up 4%+ today", desc: "Day's change above 4%", test: (row) => !!row.quote && row.quote.price > 0 && row.quote.change_pct > 4 },
  { id: "losers_4", group: "today", name: "Down 4%+ today", desc: "Day's change below −4%", test: (row) => !!row.quote && row.quote.price > 0 && row.quote.change_pct < -4 },
  { id: "52w_high", group: "today", name: "Near 52W high", desc: "Within 5% of the 52-week high", test: (row) => !!row.quote && row.quote.high_52 > 0 && row.quote.price >= row.quote.high_52 * 0.95 },
  { id: "52w_low", group: "today", name: "Near 52W low", desc: "Within 5% of the 52-week low", test: (row) => !!row.quote && row.quote.low_52 > 0 && row.quote.price <= row.quote.low_52 * 1.05 },
  { id: "value_buy", group: "today", name: "Low P/E, sizeable", desc: "P/E under 15, market cap over ₹5,000 Cr", test: (row) => gt(row, "pe", 0) && lt(row, "pe", 15) && gt(row, "market_cap", 5000) },

  // Trend
  { id: "golden", group: "trend", name: "50DMA above 200DMA", desc: "The 'golden cross' state", test: (row) => row.risk?.ma_trend === "golden" },
  { id: "death", group: "trend", name: "50DMA below 200DMA", desc: "The 'death cross' state", test: (row) => row.risk?.ma_trend === "death" },
  { id: "above_200", group: "trend", name: "Above 200DMA", desc: "Close above its 200-day average", test: (row) => gt(row, "distance_from_200", 0) },
  { id: "below_200", group: "trend", name: "Below 200DMA", desc: "Close below its 200-day average", test: (row) => lt(row, "distance_from_200", 0) },
  { id: "macd_positive", group: "trend", name: "MACD above signal", desc: "Positive MACD histogram", test: (row) => gt(row, "macd_histogram", 0) },
  { id: "strong_uptrend", group: "trend", name: "Strong uptrend", desc: "ADX above 25 with +DI over −DI", test: (row) => gt(row, "adx", 25) && gt(row, "di_spread", 0) },
  { id: "strong_downtrend", group: "trend", name: "Strong downtrend", desc: "ADX above 25 with −DI over +DI", test: (row) => gt(row, "adx", 25) && lt(row, "di_spread", 0) },
  ...RISK_SCREENS.filter((s) => s.id === "leaders" || s.id === "trending").map((s): Scan => ({ id: s.id, group: "trend", name: s.name, desc: s.desc, test: (row) => !!row.risk && s.test(row.risk) })),
  { id: "pullback_uptrend", group: "trend", name: "Pullback in uptrend", desc: "Above 200DMA, 50 over 200, RSI under 45", test: (row) => row.risk?.ma_trend === "golden" && gt(row, "distance_from_200", 0) && lt(row, "rsi_14", 45) },
  { id: "at_highs", group: "trend", name: "Top of 52W range", desc: "Close in the top 10% of its 52-week range", test: (row) => gte(row, "week52_position", 90) },

  // Oscillators
  { id: "rsi_oversold", group: "oscillators", name: "RSI oversold", desc: "RSI (14) at or below 30", test: (row) => lte(row, "rsi_14", 30) },
  { id: "rsi_overbought", group: "oscillators", name: "RSI overbought", desc: "RSI (14) at or above 70", test: (row) => gte(row, "rsi_14", 70) },
  { id: "stoch_oversold", group: "oscillators", name: "Stochastic low", desc: "%K at or below 20", test: (row) => lte(row, "stochastic_k", 20) },
  { id: "stoch_overbought", group: "oscillators", name: "Stochastic high", desc: "%K at or above 80", test: (row) => gte(row, "stochastic_k", 80) },
  { id: "mfi_oversold", group: "oscillators", name: "MFI low", desc: "Money flow index at or below 20", test: (row) => lte(row, "money_flow_index", 20) },
  { id: "mfi_overbought", group: "oscillators", name: "MFI high", desc: "Money flow index at or above 80", test: (row) => gte(row, "money_flow_index", 80) },
  { id: "bb_squeeze", group: "oscillators", name: "Bollinger squeeze", desc: "Band width under 6% of the 20-day average", test: (row) => lt(row, "bollinger_bandwidth", 6) },
  { id: "bb_above", group: "oscillators", name: "Above upper band", desc: "Close outside the upper Bollinger band", test: (row) => gt(row, "bollinger_percent_b", 1) },
  { id: "bb_below", group: "oscillators", name: "Below lower band", desc: "Close outside the lower Bollinger band", test: (row) => lt(row, "bollinger_percent_b", 0) },

  // Volume & delivery
  { id: "volume_spike", group: "volume", name: "Volume spike", desc: "Latest volume 2σ above its 20-day norm", test: (row) => gte(row, "volume_zscore", 2) },
  ...RISK_SCREENS.filter((s) => s.id === "delivery").map((s): Scan => ({ id: s.id, group: "volume", name: s.name, desc: s.desc, test: (row) => !!row.risk && s.test(row.risk) })),
  { id: "high_delivery", group: "volume", name: "High delivery", desc: "20-day delivery share at or above 60%", test: (row) => gte(row, "delivery_recent", 60) },
  { id: "obv_divergence", group: "volume", name: "OBV up, price down", desc: "On-balance volume rising over 20 days while the month's return is negative", test: (row) => gt(row, "obv_trend_20", 0) && lt(row, "return_1m", 0) },
  { id: "above_vwap", group: "volume", name: "Closed above VWAP", desc: "Close above the day's volume-weighted price", test: (row) => gt(row, "close_vs_vwap", 0) },

  // Risk
  ...RISK_SCREENS.filter((s) => s.id === "steady").map((s): Scan => ({ id: s.id, group: "risk", name: s.name, desc: s.desc, test: (row) => !!row.risk && s.test(row.risk) })),
  { id: "low_beta", group: "risk", name: "Low beta", desc: "Beta to the Nifty below 0.8", test: (row) => lt(row, "beta_1y", 0.8) },
  { id: "high_beta", group: "risk", name: "High beta", desc: "Beta to the Nifty above 1.3", test: (row) => gt(row, "beta_1y", 1.3) },
  { id: "deep_drawdown", group: "risk", name: "30%+ below peak", desc: "Close at least 30% under its one-year peak", test: (row) => gte(row, "drawdown_from_peak", 30) },
  { id: "best_return_to_vol", group: "risk", name: "Return beat volatility", desc: "One-year return larger than one-year volatility", test: (row) => gt(row, "return_to_vol", 1) },

  // Fundamentals
  ...FUNDAMENTAL_SCREENS.map((s): Scan => ({ id: s.id, group: "fundamental", name: s.name, desc: s.desc, test: (row) => !!row.fundamentals && s.test(row.fundamentals) })),
  { id: "high_roce", group: "fundamental", name: "High ROCE", desc: "ROCE at or above 20%", test: (row) => gte(row, "roce", 20) },
  { id: "cheap_quality", group: "fundamental", name: "Quality at low P/E", desc: "ROE above 15% with P/E under 20", test: (row) => gt(row, "roe", 15) && gt(row, "pe", 0) && lt(row, "pe", 20) },
  { id: "below_graham", group: "fundamental", name: "Under Graham number", desc: "Price below √(22.5 × EPS × book value)", test: (row) => gt(row, "graham_upside", 0) },
  { id: "margin_expansion", group: "fundamental", name: "Profit outgrowing sales", desc: "Profit YoY above sales YoY, sales growing", test: (row) => { const p = v(row, "profit_growth_yoy"); const sg = v(row, "sales_growth_yoy"); return p !== null && sg !== null && sg > 0 && p > sg; } },

  // Scores & factors
  { id: "piotroski_strong", group: "scores", name: "Piotroski 7+", desc: "7 or more criteria passed, at least 8 testable", test: (row) => gte(row, "piotroski_score", 7) && (row.scores?.piotroski_testable ?? 0) >= 8 },
  { id: "fcf_yield_5", group: "scores", name: "FCF yield 5%+", desc: "Free cash flow at least 5% of market cap", test: (row) => gte(row, "fcf_yield", 5) },
  { id: "peg_under_1", group: "scores", name: "PEG under 1", desc: "P/E below profit growth", test: (row) => gt(row, "peg", 0) && lt(row, "peg", 1) },
  { id: "net_cash", group: "scores", name: "Net cash", desc: "Cash exceeds borrowings", test: (row) => lt(row, "net_debt_to_equity", 0) },
  { id: "compounders", group: "scores", name: "3Y compounders", desc: "Revenue and profit CAGR both 15%+", test: (row) => gte(row, "revenue_cagr_3y", 15) && gte(row, "profit_cagr_3y", 15) },
  { id: "cash_backed", group: "scores", name: "Cash-backed profit", desc: "Operating cash flow at least equal to profit", test: (row) => gte(row, "cash_conversion", 1) },
  { id: "magic_formula", group: "scores", name: "Magic Formula top 30", desc: "Best 30 on earnings yield + ROCE rank", test: (row) => lte(row, "magic_formula_rank", 30) },
  { id: "top_composite", group: "scores", name: "Composite 75+", desc: "Top quartile across value, quality, momentum, low vol.", test: (row) => gte(row, "composite_score", 75) },
  { id: "quality_momentum", group: "scores", name: "Quality + momentum", desc: "Both factor percentiles at 70 or above", test: (row) => gte(row, "quality_score", 70) && gte(row, "momentum_score", 70) },
  { id: "value_quality", group: "scores", name: "Value + quality", desc: "Both factor percentiles at 70 or above", test: (row) => gte(row, "value_score", 70) && gte(row, "quality_score", 70) },
];

export const SCAN_BY_ID = new Map(SCANS.map((s) => [s.id, s]));

/** "a,b" plus the legacy single-valued `screen` param → known scan ids, deduplicated, order kept. */
export function parseScanIds(scan: string | null, legacyScreen?: string | null): string[] {
  const ids = [...(scan ?? "").split(","), legacyScreen ?? ""].map((id) => id.trim()).filter((id) => SCAN_BY_ID.has(id));
  return [...new Set(ids)];
}

/** Every chosen scan must match. */
export const passesScans = (row: MetricRow | undefined, ids: string[]): boolean =>
  !!row && ids.every((id) => SCAN_BY_ID.get(id)?.test(row) ?? true);

export const matchingScans = (row: MetricRow | undefined): Scan[] => (row ? SCANS.filter((s) => s.test(row)) : []);

export function scanCounts(rows: Iterable<MetricRow>): Map<string, number> {
  const counts = new Map(SCANS.map((s) => [s.id, 0]));
  for (const row of rows) for (const scan of SCANS) if (scan.test(row)) counts.set(scan.id, counts.get(scan.id)! + 1);
  return counts;
}

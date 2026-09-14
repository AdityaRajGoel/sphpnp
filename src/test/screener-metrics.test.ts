import { describe, it, expect, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import {
  buildMetricRows, computeFactors, formatMetric, metricValue, parseRules, passesRules, percentiles, serializeRules, sortByMetric,
  MIN_FACTOR_UNIVERSE, METRIC_BY_ID, type MetricQuote, type MetricRow,
} from "@/lib/screener-metrics";
import { matchingScans, parseScanIds, passesScans, scanCounts, SCANS } from "@/lib/screener-scans";
import type { FundamentalsSummary } from "@/lib/screener-fundamentals";
import type { RiskSummary } from "@/lib/screener-risk";
import type { ScoreSummary } from "@/lib/screener-scores";

const quote = (symbol: string, over: Partial<MetricQuote> = {}): MetricQuote => ({
  symbol, name: symbol, sector: "IT", price: 100, change_pct: 0, volume: 0, pe: 20, market_cap: 10000, high_52: 120, low_52: 80, ...over,
});

const fundamentals = (symbol: string, over: Partial<FundamentalsSummary> = {}): FundamentalsSummary => ({
  symbol, source: "screener_in", roe: null, roce: null, opm: null, sales_growth_yoy: null, profit_growth_yoy: null,
  debt_to_equity: null, pb: null, dividend_yield: null, eps_ttm: null, latest_quarter: null, ...over,
});

const risk = (symbol: string, over: Partial<RiskSummary> = {}): RiskSummary => ({
  symbol, as_of: "2026-09-11", volatility_1y: null, max_drawdown_1y: null, beta_1y: null, rsi_14: null, adx: null, return_3m: null,
  relative_strength_3m: null, week52_position: null, delivery_recent: null, delivery_change: null, volume_zscore: null, distance_from_200: null,
  ma_trend: null, drawdown_from_peak: null, atr_pct_14: null, return_1m: null, return_6m: null, return_1y: null, sma_50: null, sma_200: null,
  macd_histogram: null, bollinger_percent_b: null, bollinger_bandwidth: null, stochastic_k: null, stochastic_d: null, plus_di: null, minus_di: null,
  obv_trend_20: null, money_flow_index: null, close_vs_vwap: null, ...over,
});

const scores = (symbol: string, over: Partial<ScoreSummary> = {}): ScoreSummary => ({
  symbol, period_end: "2026-03-31", piotroski_score: null, piotroski_testable: null, net_debt_to_equity: null, accruals_ratio: null,
  cash_conversion: null, capex_intensity: null, fcf_yield: null, ev_to_sales: null, peg: null, payout_ratio: null, revenue_cagr_3y: null,
  profit_cagr_3y: null, ...over,
});

const row = (over: Partial<MetricRow> = {}): MetricRow => ({ symbol: "X", quote: quote("X"), fundamentals: null, risk: null, scores: null, factors: null, ...over });

describe("derived metrics", () => {
  it("earnings yield is the inverse of P/E, withheld when P/E is unknown", () => {
    expect(metricValue(row(), "earnings_yield")).toBe(5);
    expect(metricValue(row({ quote: quote("X", { pe: 0 }) }), "earnings_yield")).toBeNull();
  });

  it("Graham number recovers book value from price and P/B, and refuses loss-makers", () => {
    // EPS 10, P/B 2 at ₹100 → BVPS 50 → √(22.5 × 10 × 50) = 106.07
    const r = row({ fundamentals: fundamentals("X", { eps_ttm: 10, pb: 2 }) });
    expect(metricValue(r, "graham_number")).toBeCloseTo(106.066, 2);
    expect(metricValue(r, "graham_upside")).toBeCloseTo(6.07, 1);
    expect(metricValue(row({ fundamentals: fundamentals("X", { eps_ttm: -3, pb: 2 }) }), "graham_number")).toBeNull();
  });

  it("12-1 momentum strips the latest month out of the year multiplicatively", () => {
    // +32% over the year, +10% in the last month → 1.32 / 1.10 − 1 = +20%
    expect(metricValue(row({ risk: risk("X", { return_1y: 32, return_1m: 10 }) }), "momentum_12_1")).toBeCloseTo(20, 6);
  });

  it("converts the score table's fractions to percentages exactly once", () => {
    expect(metricValue(row({ scores: scores("X", { fcf_yield: 0.062 }) }), "fcf_yield")).toBeCloseTo(6.2, 6);
    expect(metricValue(row({ scores: scores("X", { revenue_cagr_3y: 18 }) }), "revenue_cagr_3y")).toBe(18);
  });

  it("shows a Piotroski score with the criteria it was tested on", () => {
    const metric = METRIC_BY_ID.get("piotroski_score")!;
    expect(metric.display!(row({ scores: scores("X", { piotroski_score: 6, piotroski_testable: 8 }) }))).toBe("6/8");
  });
});

describe("formatMetric", () => {
  it("writes each unit its own way and a dash for none", () => {
    expect(formatMetric(4.25, "signed_pct")).toBe("+4.3%");
    expect(formatMetric(2.4, "sigma")).toBe("+2.4σ");
    expect(formatMetric(3, "rank")).toBe("#3");
    expect(formatMetric(null, "pct")).toBe("—");
  });
});

describe("percentiles", () => {
  it("refuses a sample smaller than the minimum universe", () => {
    expect(percentiles([1, 2, 3])).toEqual([null, null, null]);
  });

  it("spans 0 to 100, shares ties, skips nulls and inverts when lower is better", () => {
    const values = [...Array.from({ length: MIN_FACTOR_UNIVERSE }, (_, i) => i), null, 5];
    const pct = percentiles(values);
    expect(pct[0]).toBe(0);
    expect(pct[MIN_FACTOR_UNIVERSE - 1]).toBe(100);
    expect(pct[MIN_FACTOR_UNIVERSE]).toBeNull();
    expect(pct[5]).toBe(pct[MIN_FACTOR_UNIVERSE + 1]);
    expect(percentiles(values, true)[0]).toBe(100);
  });
});

describe("computeFactors", () => {
  const universe = Array.from({ length: 30 }, (_, i) => {
    const symbol = `S${i}`;
    return {
      symbol,
      quote: quote(symbol, { pe: 10 + i, sector: i === 0 ? "Banking" : "IT" }),
      fundamentals: fundamentals(symbol, { roe: 5 + i, roce: 5 + i, opm: 10, debt_to_equity: 0.5, pb: 1 + i / 10 }),
      risk: risk(symbol, { return_1y: i, return_1m: 0, return_6m: i, relative_strength_3m: i, distance_from_200: i, volatility_1y: 20 + i, beta_1y: 1, max_drawdown_1y: 10 + i }),
      scores: null,
    };
  });
  const factors = computeFactors(universe);

  it("ranks the momentum leader highest and the calmest stock highest on low volatility", () => {
    expect(factors.get("S29")!.momentum).toBeGreaterThan(factors.get("S0")!.momentum!);
    expect(factors.get("S0")!.low_vol).toBeGreaterThan(factors.get("S29")!.low_vol!);
  });

  it("withholds quality when fewer than three inputs are known", () => {
    const thin = computeFactors(universe.map((u) => ({ ...u, fundamentals: fundamentals(u.symbol, { roe: 10 }) })));
    expect(thin.get("S3")!.quality).toBeNull();
  });

  it("leaves financials out of the Magic Formula, as Greenblatt did", () => {
    expect(factors.get("S0")!.magic_formula_rank).toBeNull();
    expect(factors.get("S1")!.magic_formula_rank).not.toBeNull();
  });
});

describe("custom rules", () => {
  it("round-trips through the URL form and drops what it cannot read", () => {
    const rules = parseRules("roe>=15;pe<20;nonsense>3;rsi_14<>4");
    expect(rules).toEqual([{ metric: "roe", op: ">=", value: 15 }, { metric: "pe", op: "<", value: 20 }]);
    expect(serializeRules(rules)).toBe("roe>=15;pe<20");
  });

  it("fails a stock missing the figure a rule needs", () => {
    const rules = parseRules("roe>15");
    expect(passesRules(row({ fundamentals: fundamentals("X", { roe: 18 }) }), rules)).toBe(true);
    expect(passesRules(row(), rules)).toBe(false);
  });
});

describe("sortByMetric", () => {
  it("puts stocks without the figure last whichever way it sorts", () => {
    const rows = buildMetricRows([quote("A", { pe: 30 }), quote("B", { pe: 10 }), quote("C", { pe: 0 })], new Map(), new Map(), new Map());
    const pe = METRIC_BY_ID.get("pe")!;
    const items = [{ symbol: "A" }, { symbol: "B" }, { symbol: "C" }];
    expect(sortByMetric(items, rows, pe, "asc").map((i) => i.symbol)).toEqual(["B", "A", "C"]);
    expect(sortByMetric(items, rows, pe, "desc").map((i) => i.symbol)).toEqual(["A", "B", "C"]);
  });
});

describe("scans", () => {
  it("have unique ids", () => {
    expect(new Set(SCANS.map((s) => s.id)).size).toBe(SCANS.length);
  });

  it("an unknown RSI is not an oversold one", () => {
    expect(passesScans(row({ risk: risk("X", { rsi_14: 25 }) }), ["rsi_oversold"])).toBe(true);
    expect(passesScans(row({ risk: risk("X") }), ["rsi_oversold"])).toBe(false);
  });

  it("combine with AND", () => {
    const r = row({ risk: risk("X", { adx: 30, plus_di: 25, minus_di: 15, rsi_14: 75 }) });
    expect(passesScans(r, ["strong_uptrend", "rsi_overbought"])).toBe(true);
    expect(passesScans(r, ["strong_uptrend", "rsi_oversold"])).toBe(false);
  });

  it("keep the old scan and screen links working", () => {
    expect(parseScanIds("52w_high,bogus", "quality")).toEqual(["52w_high", "quality"]);
  });

  it("counts every scan a set of rows matches", () => {
    const r = row({ risk: risk("X", { rsi_14: 20 }) });
    expect(scanCounts([r, r]).get("rsi_oversold")).toBe(2);
    expect(matchingScans(r).map((s) => s.id)).toContain("rsi_oversold");
  });
});

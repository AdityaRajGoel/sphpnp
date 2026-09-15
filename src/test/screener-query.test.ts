import { describe, it, expect, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { evaluateQuery, parseQuery, tokenize } from "@/lib/screener-query";
import type { MetricRow } from "@/lib/screener-metrics";
import type { FundamentalsSummary } from "@/lib/screener-fundamentals";
import type { RiskSummary } from "@/lib/screener-risk";

const fundamentals = (over: Partial<FundamentalsSummary>): FundamentalsSummary => ({
  symbol: "X", source: "screener_in", roe: null, roce: null, opm: null, sales_growth_yoy: null, profit_growth_yoy: null,
  debt_to_equity: null, pb: null, dividend_yield: null, eps_ttm: null, latest_quarter: null, ...over,
});

const row = (f: Partial<FundamentalsSummary> = {}, quote: Partial<MetricRow["quote"] & object> = {}, risk: Partial<RiskSummary> | null = null): MetricRow => ({
  symbol: "X",
  quote: { symbol: "X", name: "X", sector: "IT", price: 100, change_pct: 0, volume: 0, pe: 20, market_cap: 10000, high_52: 120, low_52: 80, ...quote },
  fundamentals: fundamentals(f),
  risk: risk as RiskSummary | null,
  scores: null,
  factors: null,
});

const passes = (q: string, r: MetricRow) => {
  const p = parseQuery(q);
  if (!p.ok) throw new Error(p.error);
  return evaluateQuery(p.cond, r);
};

describe("tokenize", () => {
  it("reads labels, ids, aliases and multi-word names longest-first", () => {
    const t = tokenize("Debt to equity < 0.5 and market_cap >= 5000");
    expect(t.ok).toBe(true);
    if (t.ok) expect(t.tokens.filter((x) => x.t === "metric").map((x) => (x as { m: { id: string } }).m.id)).toEqual(["debt_to_equity", "market_cap"]);
  });

  it("names an unknown metric in the error", () => {
    const t = tokenize("Frobnication > 3");
    expect(t.ok).toBe(false);
    if (!t.ok) expect(t.error).toMatch(/Frobnication/);
  });
});

describe("parseQuery and evaluateQuery", () => {
  it("handles AND, OR, brackets and precedence", () => {
    const r = row({ roce: 25, debt_to_equity: 0.2, sales_growth_yoy: 5, profit_growth_yoy: 30 });
    expect(passes("ROCE > 20 AND Debt to equity < 0.5", r)).toBe(true);
    expect(passes("(Sales YoY > 15 OR Profit YoY > 20) AND ROCE > 20", r)).toBe(true);
    expect(passes("Sales YoY > 15 OR Profit YoY > 20 AND ROCE > 30", r)).toBe(false);
  });

  it("does arithmetic between metrics", () => {
    // Earnings yield = 100 / P/E = 5; ROE 18 > 3 * 5.
    expect(passes("ROE > 3 * Earnings yield", row({ roe: 18 }))).toBe(true);
    expect(passes("Market cap / 1000 >= 10", row())).toBe(true);
  });

  it("fails any comparison on a missing figure, including under NOT", () => {
    expect(passes("ROCE > 20", row())).toBe(false);
    expect(passes("NOT RSI > 70", row({}, {}, { rsi_14: 50 }))).toBe(true);
    expect(passes("NOT RSI > 70", row())).toBe(false);
  });

  it("reports where a malformed query goes wrong", () => {
    const missingOp = parseQuery("ROCE 20");
    expect(missingOp.ok).toBe(false);
    const dangling = parseQuery("ROCE > 20 AND");
    expect(dangling.ok).toBe(false);
    if (!dangling.ok) expect(dangling.error).toMatch(/ends too early/);
    expect(parseQuery("(ROCE > 20").ok).toBe(false);
  });

  it("rejects hostile input from a shared link without running it", () => {
    expect(parseQuery("ROCE > 1 OR ".repeat(60) + "ROCE > 1").ok).toBe(false);
    expect(parseQuery("(".repeat(40) + "ROCE > 1" + ")".repeat(40)).ok).toBe(false);
    const started = performance.now();
    parseQuery("(((((( ROCE > 1 ))))))");
    expect(performance.now() - started).toBeLessThan(200);
    for (const attack of ["'; DROP TABLE screener_stocks; --", "constructor.prototype > 1", "__proto__ > 1", "alert(1) > 0", "roce > 1; select *"]) {
      expect(parseQuery(attack).ok).toBe(false);
    }
  });

  it("lists the metrics a query uses", () => {
    const p = parseQuery("ROCE > 20 AND ROCE < 60 OR P/E < 15");
    expect(p.ok && p.metrics.map((m) => m.id)).toEqual(["roce", "pe"]);
  });
});

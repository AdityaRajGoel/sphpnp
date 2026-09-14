import { describe, it, expect, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { computeBreadth, median } from "@/lib/market-breadth";
import type { MetricRow } from "@/lib/screener-metrics";
import type { RiskSummary } from "@/lib/screener-risk";

const row = (symbol: string, change: number, risk: Partial<RiskSummary> | null): MetricRow => ({
  symbol,
  quote: { symbol, name: symbol, sector: "IT", price: 100, change_pct: change, volume: 0, pe: 20, market_cap: 1000, high_52: 0, low_52: 0 },
  fundamentals: null,
  risk: risk as RiskSummary | null,
  scores: null,
  factors: null,
});

describe("median", () => {
  it("handles odd, even and empty samples", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe("computeBreadth", () => {
  const rows = [
    row("A", 1, { distance_from_200: 5, rsi_14: 75, relative_strength_3m: 12, adx: 30, plus_di: 30, minus_di: 10 }),
    row("B", -1, { distance_from_200: -2, rsi_14: 25, relative_strength_3m: -8, adx: 30, plus_di: 10, minus_di: 30 }),
    row("C", 0, null),
  ];
  const b = computeBreadth(rows, 1);

  it("measures each share against the stocks where the figure is known", () => {
    expect(b.advancers.count).toBe(1);
    expect(b.advancers.known).toBe(3);
    expect(b.advancers.pct).toBeCloseTo(100 / 3, 10);
    expect(b.above200).toEqual({ count: 1, known: 2, pct: 50 });
    expect(b.golden.known).toBe(0);
    expect(b.golden.pct).toBeNull();
  });

  it("counts RSI extremes, directional trends and relative-strength ends", () => {
    expect(b.rsiOverbought.count).toBe(1);
    expect(b.rsiOversold.count).toBe(1);
    expect(b.trendingUp.count).toBe(1);
    expect(b.trendingDown.count).toBe(1);
    expect(b.leaders.map((r) => r.symbol)).toEqual(["A"]);
    expect(b.laggards.map((r) => r.symbol)).toEqual(["B"]);
  });
});

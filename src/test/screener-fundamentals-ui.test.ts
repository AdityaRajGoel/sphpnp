import { describe, it, expect, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { formatFundamental, sortByFundamental, FUNDAMENTAL_SCREENS, toneOf, type FundamentalsSummary } from "@/lib/screener-fundamentals";

const summary = (symbol: string, over: Partial<FundamentalsSummary>): FundamentalsSummary => ({
  symbol, source: "indianapi", roe: null, roce: null, opm: null, sales_growth_yoy: null, profit_growth_yoy: null,
  debt_to_equity: null, pb: null, dividend_yield: null, eps_ttm: null, latest_quarter: null, ...over,
});

describe("formatFundamental", () => {
  it("writes each kind of figure in its own unit, and a dash for none", () => {
    expect(formatFundamental(14.26, "pct")).toBe("14.3%");
    expect(formatFundamental(0.446, "ratio")).toBe("0.45");
    expect(formatFundamental(55.22, "rupees")).toBe("₹55.22");
    expect(formatFundamental(null, "pct")).toBe("—");
  });
});

describe("sortByFundamental", () => {
  const map = new Map([
    ["A", summary("A", { roe: 12 })],
    ["B", summary("B", { roe: 25 })],
    ["C", summary("C", {})],
  ]);
  const rows = [{ symbol: "A" }, { symbol: "B" }, { symbol: "C" }, { symbol: "D" }];

  it("puts stocks without the figure last whichever way it sorts", () => {
    expect(sortByFundamental(rows, map, "roe", "desc").map((r) => r.symbol)).toEqual(["B", "A", "C", "D"]);
    expect(sortByFundamental(rows, map, "roe", "asc").map((r) => r.symbol).slice(0, 2)).toEqual(["A", "B"]);
  });
});

describe("FUNDAMENTAL_SCREENS", () => {
  const screen = (id: string) => FUNDAMENTAL_SCREENS.find((s) => s.id === id)!;

  it("quality needs both a high ROE and low debt", () => {
    expect(screen("quality").test(summary("X", { roe: 20, debt_to_equity: 0.2 }))).toBe(true);
    expect(screen("quality").test(summary("X", { roe: 20, debt_to_equity: null }))).toBe(false);
  });

  it("growth needs sales and profit both up 20%", () => {
    expect(screen("growth").test(summary("X", { sales_growth_yoy: 25, profit_growth_yoy: 30 }))).toBe(true);
    expect(screen("growth").test(summary("X", { sales_growth_yoy: 25, profit_growth_yoy: null }))).toBe(false);
  });
});

describe("toneOf", () => {
  it("colours growth and returns, not ratios", () => {
    expect(toneOf("sales_growth_yoy", -3)).toBe("down");
    expect(toneOf("roe", 18)).toBe("up");
    expect(toneOf("pb", 3)).toBeNull();
  });
});

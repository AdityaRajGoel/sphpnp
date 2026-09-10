import { describe, it, expect } from "vitest";
import {
  formatStatementValue,
  visibleColumns,
  keyMetricCards,
  latestHolding,
  statementTabs,
  type StatementGrid,
} from "@/lib/statements";

/*
 * Display rules for the IndianAPI statements on a stock page.
 *
 * Figures arrive in crore and percentages as percentages; the rules here only
 * decide how each is written and which columns fit. The standing rule from the
 * rest of the stock page applies: an absent figure is shown as absent, never
 * as zero.
 */

const grid = (periods: string[]): StatementGrid => ({
  statement: "quarter_results",
  periods,
  period_ends: periods.map((p) => (p === "TTM" ? null : "2026-06-30")),
  rows: [{ label: "Sales", values: periods.map(() => 1) }],
  verified: true,
  fetched_at: "2026-09-10T00:00:00Z",
});

describe("formatStatementValue", () => {
  it("writes crore figures with Indian grouping and no invented decimals", () => {
    expect(formatStatementValue("Sales", 309468)).toBe("3,09,468");
    expect(formatStatementValue("Net Profit", -1520)).toBe("-1,520");
  });

  it("writes percentage rows as percentages", () => {
    expect(formatStatementValue("OPM %", 15)).toBe("15%");
    expect(formatStatementValue("ROCE %", 10.4)).toBe("10.4%");
  });

  it("keeps EPS in rupees with paise", () => {
    expect(formatStatementValue("EPS in Rs", 15.48)).toBe("₹15.48");
  });

  it("shows an absent figure as absent", () => {
    expect(formatStatementValue("Sales", null)).toBe("—");
  });
});

describe("visibleColumns", () => {
  it("keeps the most recent periods, oldest to newest", () => {
    const g = grid(["Mar 2023", "Jun 2023", "Sep 2023", "Dec 2023", "Mar 2024"]);
    expect(visibleColumns(g, 3)).toEqual([2, 3, 4]);
  });

  it("always keeps TTM when the statement has it", () => {
    const g = grid(["Mar 2024", "Mar 2025", "Mar 2026", "TTM"]);
    expect(visibleColumns(g, 2).map((i) => g.periods[i])).toEqual(["Mar 2026", "TTM"]);
  });

  it("shows everything when it fits", () => {
    expect(visibleColumns(grid(["Mar 2025", "Mar 2026"]), 8)).toEqual([0, 1]);
  });
});

describe("keyMetricCards", () => {
  it("picks the headline ratios and says which are missing rather than inventing them", () => {
    const cards = keyMetricCards(
      {
        valuation: { pPerEBasicExcludingExtraordinaryItemsTTM: 23.43, priceToBookMostRecentFiscalYear: 1.96, currentDividendYieldCommonStockPrimaryIssueLTM: 0.46 },
        financialstrength: { currentRatioMostRecentFiscalYear: 1.1, ltDebtPerEquityMostRecentFiscalYear: 0.32 },
        margins: { netProfitMarginPercentTrailing12Month: 7.72 },
      },
      [{ period_end: "2026-03-31", roe: 10.96 }],
      [{ label: "ROCE %", values: [9, 10] }],
    );
    const byLabel = Object.fromEntries(cards.map((c) => [c.label, c.value]));
    expect(byLabel["P/E (TTM)"]).toBe("23.4");
    expect(byLabel["Price / Book"]).toBe("1.96");
    expect(byLabel["ROE (FY26)"]).toBe("11.0%");
    expect(byLabel["ROCE (latest year)"]).toBe("10%");
    expect(byLabel["Dividend yield"]).toBe("0.46%");
    expect(byLabel["Current ratio"]).toBe("1.10");
    expect(byLabel["Net margin (TTM)"]).toBe("7.7%");
    expect(byLabel["Debt / Equity"]).toBe("0.32");
  });

  it("marks a metric the source did not report as absent", () => {
    const cards = keyMetricCards({}, [], []);
    expect(cards.find((c) => c.label === "P/E (TTM)")?.value).toBe("—");
    expect(cards.find((c) => c.label.startsWith("ROE"))?.value).toBe("—");
  });
});

describe("latestHolding", () => {
  it("reads each category's most recent percentage and its change on the quarter", () => {
    expect(latestHolding({ category: "Promoter", points: [
      { date: "2026-03-31", pct: 50 }, { date: "2026-06-30", pct: 50.48 },
    ] })).toEqual({ date: "2026-06-30", pct: 50.48, change: 0.48 });
  });

  it("has no change for a single observation", () => {
    expect(latestHolding({ category: "FII", points: [{ date: "2026-06-30", pct: 19.1 }] }))
      .toEqual({ date: "2026-06-30", pct: 19.1, change: null });
  });
});

describe("keyMetricCards with Google Finance as the fallback", () => {
  it("fills the ratios IndianAPI did not report from Google's key stats", () => {
    // M&M: IndianAPI returned no key metrics at all.
    const cards = keyMetricCards({}, [], [], { pe: 18.97, eps: 164.44, dividend_yield_pct: 1.06, roe_pct: 17.2 });
    const byLabel = Object.fromEntries(cards.map((c) => [c.label, c.value]));
    expect(byLabel["P/E (TTM)"]).toBe("19.0");
    expect(byLabel["Dividend yield"]).toBe("1.06%");
    expect(byLabel["EPS (TTM)"]).toBe("₹164.44");
    expect(byLabel["ROE"]).toBe("17.2%");
  });

  it("prefers IndianAPI's figure when both have one", () => {
    const cards = keyMetricCards({ valuation: { pPerEBasicExcludingExtraordinaryItemsTTM: 23.43 } }, [], [], { pe: 99, eps: null, dividend_yield_pct: null, roe_pct: null });
    expect(cards.find((c) => c.label === "P/E (TTM)")?.value).toBe("23.4");
  });
});

describe("statementTabs", () => {
  const grid = (statement: StatementGrid["statement"]): StatementGrid => ({
    statement, periods: ["Mar 2026"], period_ends: ["2026-03-31"], rows: [{ label: "Sales", values: [1] }], verified: true, fetched_at: "2026-09-10T00:00:00Z",
  });

  it("shows IndianAPI's statements when the stock has them, never both sources", () => {
    const tabs = statementTabs({ quarter_results: grid("quarter_results"), gf_income_quarterly: grid("gf_income_quarterly") });
    expect(tabs.source).toBe("indianapi");
    expect(tabs.tabs.map((t) => t.kind)).toEqual(["quarter_results"]);
  });

  it("falls back to Google Finance's statements otherwise", () => {
    const tabs = statementTabs({ gf_income_quarterly: grid("gf_income_quarterly"), gf_balance_annual: grid("gf_balance_annual") });
    expect(tabs.source).toBe("google_finance");
    expect(tabs.tabs.map((t) => t.kind)).toEqual(["gf_income_quarterly", "gf_balance_annual"]);
  });
});

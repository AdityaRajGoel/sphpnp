import { describe, it, expect } from "vitest";
import {
  cagr,
  oneReportingBasis,
  piotroskiScore,
  qualityMetrics,
  type BalancePeriod,
  type CashflowPeriod,
  type IncomePeriod,
} from "../../supabase/functions/_shared/fundamental-scores";

/*
 * Periods are newest-first, as the fundamentals tables return them. The company
 * below improves on every testable axis, so it should pass everything that can
 * be tested and pass nothing that cannot.
 */
const improvingIncome: IncomePeriod[] = [
  { period_end: "2026-03-31", revenue: 1200, total_income: 1250, total_expenses: 1000, profit_after_tax: 180 },
  { period_end: "2025-03-31", revenue: 1000, total_income: 1040, total_expenses: 900, profit_after_tax: 100 },
];
const improvingBalance: BalancePeriod[] = [
  { period_end: "2026-03-31", total_assets: 2000, total_debt: 300, total_equity: 1200, cash_and_equivalents: 250, current_assets: 800, current_liabilities: 400 },
  { period_end: "2025-03-31", total_assets: 1900, total_debt: 500, total_equity: 1000, cash_and_equivalents: 150, current_assets: 700, current_liabilities: 500 },
];
const improvingCashflow: CashflowPeriod[] = [
  { period_end: "2026-03-31", operating_cf: 260, capex: -60, free_cash_flow: 200 },
  { period_end: "2025-03-31", operating_cf: 140, capex: -50, free_cash_flow: 90 },
];

describe("piotroskiScore", () => {
  it("passes every testable criterion for a company improving on all of them", () => {
    const result = piotroskiScore(improvingIncome, improvingBalance, improvingCashflow)!;

    expect(result.testable).toBe(8);
    expect(result.score).toBe(8);
  });

  it("never counts the share-issuance test it cannot run", () => {
    // The distinction that matters: 8 of 8 tested, NOT 8 of 9. Reporting the
    // latter would imply the company failed a test that was never run.
    const result = piotroskiScore(improvingIncome, improvingBalance, improvingCashflow)!;
    const equity = result.criteria.find((c) => c.name === "No new equity issued")!;

    expect(result.criteria).toHaveLength(9);
    expect(equity.passed).toBeNull();
    expect(equity.unavailable).toContain("share count");
    expect(result.testable).toBeLessThan(result.criteria.length);
  });

  it("marks a criterion untestable rather than failed when its input is missing", () => {
    const noCashflow = piotroskiScore(improvingIncome, improvingBalance, [])!;
    const cfoPositive = noCashflow.criteria.find((c) => c.name === "Operating cash flow positive")!;

    expect(cfoPositive.passed).toBeNull();
    // Two cash-flow-dependent tests drop out, not one: the accrual test needs
    // it too.
    expect(noCashflow.testable).toBe(6);
    expect(noCashflow.score).toBe(6);
  });

  it("scores a deteriorating company low on the same tests", () => {
    const result = piotroskiScore(
      [improvingIncome[1], improvingIncome[0]],
      [improvingBalance[1], improvingBalance[0]],
      [improvingCashflow[1], improvingCashflow[0]],
    )!;

    // Same company, periods reversed: all five TREND tests flip to failing.
    // Exactly three survive, and which three is the point - they are the tests
    // of level rather than of direction (profit positive, cash flow positive,
    // cash flow ahead of profit), and those do not care which period is newer.
    expect(result.score).toBe(3);
    expect(result.testable).toBe(8);
    expect(result.criteria.filter((c) => c.passed === true).map((c) => c.name)).toEqual([
      "Return on assets positive",
      "Operating cash flow positive",
      "Cash flow exceeds profit",
    ]);
  });

  it("refuses a score when too few criteria can be tested", () => {
    // A symbol with one period, or with almost nothing filled in, must not
    // produce a low score that reads as a judgement on the company.
    expect(piotroskiScore([improvingIncome[0]], improvingBalance, improvingCashflow)).toBeNull();
    expect(
      piotroskiScore(
        [{ period_end: "2026-03-31" }, { period_end: "2025-03-31" }],
        [{ period_end: "2026-03-31" }, { period_end: "2025-03-31" }],
        [],
      ),
    ).toBeNull();
  });
});

describe("qualityMetrics", () => {
  const market = { market_cap: 4000, pe: 22, dividend_yield_pct: 1.5, profit_growth_yoy_pct: 80 };

  it("nets debt against cash and scales it by equity", () => {
    const metrics = qualityMetrics(improvingIncome, improvingBalance, improvingCashflow, market);

    expect(metrics.net_debt).toBe(50);
    expect(metrics.net_debt_to_equity).toBeCloseTo(50 / 1200, 10);
  });

  it("flags profit that is not arriving as cash", () => {
    // Cash flow above profit gives a negative accruals ratio, which is the
    // good direction; conversion above 1 says the same thing the other way.
    const metrics = qualityMetrics(improvingIncome, improvingBalance, improvingCashflow, market);

    expect(metrics.accruals_ratio!).toBeLessThan(0);
    expect(metrics.cash_conversion!).toBeGreaterThan(1);
  });

  it("derives the payout ratio from yield and P/E", () => {
    // yield = DPS/price and P/E = price/EPS, so the product is DPS/EPS exactly.
    const metrics = qualityMetrics(improvingIncome, improvingBalance, improvingCashflow, market);

    expect(metrics.payout_ratio).toBeCloseTo((1.5 * 22) / 100, 10);
  });

  it("builds enterprise value from market cap plus net debt", () => {
    const metrics = qualityMetrics(improvingIncome, improvingBalance, improvingCashflow, market);

    expect(metrics.ev_to_sales).toBeCloseTo((4000 + 50) / 1200, 10);
  });

  it("refuses a PEG on flat or falling profit", () => {
    // A negative denominator would print an attractive-looking negative PEG
    // for a company whose profit is collapsing.
    for (const growth of [0, -15]) {
      const metrics = qualityMetrics(improvingIncome, improvingBalance, improvingCashflow, { ...market, profit_growth_yoy_pct: growth });
      expect(metrics.peg).toBeNull();
    }
    expect(qualityMetrics(improvingIncome, improvingBalance, improvingCashflow, market).peg).toBeCloseTo(22 / 80, 10);
  });

  it("treats capex sign-agnostically when deriving free cash flow", () => {
    // Yahoo stores capex as a negative outflow, other sources as a positive
    // spend. Subtracting a negative would INFLATE free cash flow.
    const positiveCapex: CashflowPeriod[] = [{ period_end: "2026-03-31", operating_cf: 260, capex: 60 }];
    const negativeCapex: CashflowPeriod[] = [{ period_end: "2026-03-31", operating_cf: 260, capex: -60 }];

    expect(qualityMetrics(improvingIncome, improvingBalance, positiveCapex, market).free_cash_flow).toBe(200);
    expect(qualityMetrics(improvingIncome, improvingBalance, negativeCapex, market).free_cash_flow).toBe(200);
  });

  it("returns nulls rather than zeros when nothing is filled in", () => {
    const metrics = qualityMetrics([{ period_end: "2026-03-31" }], [{ period_end: "2026-03-31" }], []);

    expect(metrics.net_debt).toBeNull();
    expect(metrics.free_cash_flow).toBeNull();
    expect(metrics.fcf_yield).toBeNull();
    expect(metrics.accruals_ratio).toBeNull();
  });
});

describe("cagr", () => {
  it("compounds between the first and last value", () => {
    // 100 to 200 over 3 years is about 25.99% a year.
    expect(cagr([100, 140, 170, 200], 3)!).toBeCloseTo((2 ** (1 / 3) - 1) * 100, 8);
  });

  it("refuses a base that is zero or a loss", () => {
    // Moving from a loss to a profit has no growth RATE; the formula would
    // return a confident number from a negative base.
    expect(cagr([-50, 120], 2)).toBeNull();
    expect(cagr([0, 120], 2)).toBeNull();
  });
});

describe("oneReportingBasis", () => {
  it("keeps consolidated rows and drops the standalone twins", () => {
    // The trap: fundamentals_income is unique on
    // (symbol, period_end, is_consolidated), so most symbols hold two rows per
    // period. Scoring across both pairs a standalone profit with a
    // consolidated balance sheet.
    const rows = [
      { period_end: "2026-03-31", is_consolidated: true, profit_after_tax: 180 },
      { period_end: "2026-03-31", is_consolidated: false, profit_after_tax: 150 },
      { period_end: "2025-03-31", is_consolidated: true, profit_after_tax: 100 },
      { period_end: "2025-03-31", is_consolidated: false, profit_after_tax: 80 },
    ];

    const chosen = oneReportingBasis(rows);

    expect(chosen).toHaveLength(2);
    expect(chosen.every((row) => row.is_consolidated)).toBe(true);
  });

  it("falls back to standalone for a symbol that never reports consolidated", () => {
    const rows = [
      { period_end: "2026-03-31", is_consolidated: false, profit_after_tax: 40 },
      { period_end: "2025-03-31", is_consolidated: false, profit_after_tax: 30 },
    ];

    expect(oneReportingBasis(rows)).toHaveLength(2);
  });

  it("keeps one row per period when a period was re-filed", () => {
    const rows = [
      { period_end: "2026-03-31", is_consolidated: true, profit_after_tax: 185 },
      { period_end: "2026-03-31", is_consolidated: true, profit_after_tax: 180 },
    ];

    // The first of an ordered list wins - the caller orders newest-first, so
    // that is the latest filing.
    expect(oneReportingBasis(rows)).toHaveLength(1);
    expect(oneReportingBasis(rows)[0].profit_after_tax).toBe(185);
  });

  it("never mixes bases into a score", () => {
    const mixed = [
      { period_end: "2026-03-31", is_consolidated: true, revenue: 1200, total_income: 1250, total_expenses: 1000, profit_after_tax: 180 },
      { period_end: "2026-03-31", is_consolidated: false, revenue: 900, total_income: 940, total_expenses: 800, profit_after_tax: 120 },
      { period_end: "2025-03-31", is_consolidated: true, revenue: 1000, total_income: 1040, total_expenses: 900, profit_after_tax: 100 },
      { period_end: "2025-03-31", is_consolidated: false, revenue: 800, total_income: 830, total_expenses: 720, profit_after_tax: 70 },
    ];

    // Without the collapse the two newest rows are the same period on two
    // bases, so "this year vs last year" would compare a company to itself.
    const scored = piotroskiScore(oneReportingBasis(mixed), improvingBalance, improvingCashflow)!;

    expect(scored.testable).toBe(8);
    expect(scored.score).toBe(8);
  });
});

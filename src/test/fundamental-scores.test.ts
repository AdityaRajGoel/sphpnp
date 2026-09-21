import { describe, it, expect } from "vitest";
import {
  alignPeriods,
  cagr,
  cagrOverPeriods,
  oneReportingBasis,
  piotroskiScore,
  qualityMetrics,
  trailingYear,
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
    // The figures are swapped between the two dates rather than the arrays
    // being reversed: alignment sorts by period_end, so input order no longer
    // changes which period is "latest" - which is the point of it.
    const swap = <T extends { period_end: string }>(rows: T[]): T[] => [
      { ...rows[1], period_end: rows[0].period_end },
      { ...rows[0], period_end: rows[1].period_end },
    ];

    const result = piotroskiScore(swap(improvingIncome), swap(improvingBalance), swap(improvingCashflow))!;

    // Only the tests of LEVEL survive - profit positive, cash flow positive,
    // cash flow ahead of profit. Every test of direction now fails.
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
  // Crore, as screener_stocks quotes it. The fixtures' statements are in the
  // same made-up unit, so the conversion is asserted explicitly below instead.
  const market = { market_cap_crore: 4000, pe: 22, dividend_yield_pct: 1.5, profit_growth_yoy_pct: 80 };

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

    expect(metrics.ev_to_sales).toBeCloseTo((4000 * 1e7 + 50) / 1200, 10);
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
  it("keeps the filing over Yahoo's copy even when another quarter sits between them", () => {
    // The order the database hands back without ORDER BY: the two March rows are
    // not adjacent, which the old sort-based pick did not reliably handle.
    const rows = [
      { period_end: "2026-03-31", is_consolidated: true, source: "yahoo", v: 1 },
      { period_end: "2025-12-31", is_consolidated: true, source: "nse_xbrl", v: 2 },
      { period_end: "2026-03-31", is_consolidated: true, source: "nse_xbrl", v: 3 },
      { period_end: "2025-12-31", is_consolidated: true, source: "yahoo", v: 4 },
    ];
    expect(oneReportingBasis(rows).map((r) => [r.period_end, r.source, r.v])).toEqual([
      ["2026-03-31", "nse_xbrl", 3],
      ["2025-12-31", "nse_xbrl", 2],
    ]);
  });

  it("keeps the NSE filing over a Yahoo copy of the same quarter, whatever the row order", () => {
    const rows = [
      { period_end: "2026-03-31", is_consolidated: true, source: "yahoo", profit_after_tax: 74 },
      { period_end: "2026-03-31", is_consolidated: true, source: "nse_xbrl", profit_after_tax: 205 },
      { period_end: "2025-12-31", is_consolidated: true, source: "yahoo", profit_after_tax: 180 },
    ];
    expect(oneReportingBasis(rows).map((r) => [r.period_end, r.source])).toEqual([["2026-03-31", "nse_xbrl"], ["2025-12-31", "yahoo"]]);
  });

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

/*
 * Period alignment. Found on the first live run: fundamentals_income comes
 * from NSE's XBRL filings and fundamentals_balance from Yahoo, both quarterly,
 * and they do not always hold the same quarters for a symbol. Pairing
 * income[0] with balance[0] positionally divided June's profit by March's
 * assets and called it a return on assets.
 */
describe("period alignment", () => {
  it("pairs statements by date, not by position", () => {
    // The balance sheet is missing the newest quarter. Positionally, June's
    // profit would meet March's assets; by date, June is simply skipped.
    const income = [
      { period_end: "2026-06-30", revenue: 300, total_income: 310, total_expenses: 250, profit_after_tax: 45 },
      { period_end: "2026-03-31", revenue: 1200, total_income: 1250, total_expenses: 1000, profit_after_tax: 180 },
      { period_end: "2025-03-31", revenue: 1000, total_income: 1040, total_expenses: 900, profit_after_tax: 100 },
    ];

    const aligned = alignPeriods(income, improvingBalance, improvingCashflow);

    expect(aligned.map((p) => p.period_end)).toEqual(["2026-03-31", "2025-03-31"]);
    expect(aligned[0].income.profit_after_tax).toBe(180);
    expect(aligned[0].balance.total_assets).toBe(2000);
  });

  it("skips a statement row that carries no figures", () => {
    // Yahoo writes a dated row for every recent quarter even when it has no
    // numbers for it. Treated as real, that empty June balance sheet became the
    // "latest" period and every ratio came out null (234 of 236 stocks).
    const income = [
      { period_end: "2026-06-30", revenue: 300, total_income: 310, total_expenses: 250, profit_after_tax: 45 },
      { period_end: "2026-03-31", revenue: 1200, total_income: 1250, total_expenses: 1000, profit_after_tax: 180 },
    ];
    const balance = [{ period_end: "2026-06-30", total_assets: null, total_equity: null }, ...improvingBalance];
    const cashflow = [
      { period_end: "2026-03-31", operating_cf: null, capex: null, free_cash_flow: null },
    ];

    const aligned = alignPeriods(income, balance, cashflow);

    expect(aligned[0].period_end).toBe("2026-03-31");
    expect(aligned[0].cashflow).toBeNull();
  });

  it("scores the aligned pair and reports both dates", () => {
    const result = piotroskiScore(improvingIncome, improvingBalance, improvingCashflow)!;

    expect(result.period_end).toBe("2026-03-31");
    expect(result.compared_with).toBe("2025-03-31");
  });

  it("compares year-on-year, never quarter-on-quarter", () => {
    // A seasonal business beats its own previous quarter most years regardless
    // of how it is doing, so consecutive quarters must not be compared.
    const quarters = ["2026-06-30", "2026-03-31", "2025-12-31"];
    const income = quarters.map((period_end, i) => ({ period_end, revenue: 300 - i * 10, total_income: 310, total_expenses: 250, profit_after_tax: 45 }));
    const balance = quarters.map((period_end) => ({ period_end, total_assets: 2000, total_debt: 300, total_equity: 1200, cash_and_equivalents: 250, current_assets: 800, current_liabilities: 400 }));
    const cashflow = quarters.map((period_end) => ({ period_end, operating_cf: 60, capex: -10 }));

    // Three consecutive quarters, none twelve months apart: nothing to compare.
    expect(piotroskiScore(income, balance, cashflow)).toBeNull();
  });

  it("accepts an anniversary that landed a few weeks early or late", () => {
    const income = [
      { period_end: "2026-06-30", revenue: 320, total_income: 330, total_expenses: 260, profit_after_tax: 50 },
      { period_end: "2025-06-15", revenue: 300, total_income: 310, total_expenses: 255, profit_after_tax: 40 },
    ];
    const balance = income.map((r) => ({ period_end: r.period_end, total_assets: 2000, total_debt: 300, total_equity: 1200, cash_and_equivalents: 250, current_assets: 800, current_liabilities: 400 }));
    const cashflow = income.map((r) => ({ period_end: r.period_end, operating_cf: 90, capex: -10 }));

    const result = piotroskiScore(income, balance, cashflow)!;

    expect(result.compared_with).toBe("2025-06-15");
  });
});

describe("cagrOverPeriods", () => {
  it("compounds over elapsed time, not over the number of periods", () => {
    // Eight quarterly periods span two years, not seven. Counting periods as
    // years divided the real growth rate by nearly four.
    const periods = alignPeriods(
      [
        { period_end: "2026-03-31", revenue: 1210 },
        { period_end: "2025-03-31", revenue: 1100 },
        { period_end: "2024-03-31", revenue: 1000 },
      ],
      ["2026-03-31", "2025-03-31", "2024-03-31"].map((period_end) => ({ period_end, total_assets: 1 })),
      [],
    );

    // 1000 -> 1210 over exactly two years is 10% a year.
    expect(cagrOverPeriods(periods, (i) => i.revenue)!).toBeCloseTo(10, 1);
  });

  it("refuses a span shorter than a year", () => {
    const periods = alignPeriods(
      [{ period_end: "2026-06-30", revenue: 320 }, { period_end: "2026-03-31", revenue: 300 }],
      ["2026-06-30", "2026-03-31"].map((period_end) => ({ period_end, total_assets: 1 })),
      [],
    );

    expect(cagrOverPeriods(periods, (i) => i.revenue)).toBeNull();
  });
});

describe("choosing which period to score", () => {
  /*
   * The two sources carry different quarters. ABB's newest aligned period is
   * 2026-06-30, whose 2025-06-30 anniversary the income table does not hold,
   * while 2025-12-31 and 2024-12-31 are both present and a year apart. Scoring
   * only the newest period refused every such symbol - nothing at all scored
   * across the universe on the first corrected run.
   */
  const period = (period_end: string, profit: number) => ({
    income: { period_end, revenue: 1000 + profit, total_income: 1040, total_expenses: 900, profit_after_tax: profit },
    balance: { period_end, total_assets: 2000, total_debt: 300, total_equity: 1200, cash_and_equivalents: 250, current_assets: 800, current_liabilities: 400 },
    cashflow: { period_end, operating_cf: 260, capex: -60 },
  });

  const dates = ["2026-06-30", "2026-03-31", "2025-12-31", "2025-09-30", "2024-12-31"];
  const built = dates.map((d, i) => period(d, 180 - i * 10));

  it("walks back to the newest period that has a year-ago counterpart", () => {
    const result = piotroskiScore(
      built.map((p) => p.income),
      built.map((p) => p.balance),
      built.map((p) => p.cashflow),
    )!;

    // 2026-06-30 has no 2025-06-30; 2025-12-31 has 2024-12-31.
    expect(result.period_end).toBe("2025-12-31");
    expect(result.compared_with).toBe("2024-12-31");
  });

  it("still refuses when no period has a counterpart a year back", () => {
    const consecutive = ["2026-06-30", "2026-03-31", "2025-12-31"].map((d, i) => period(d, 180 - i * 10));

    expect(
      piotroskiScore(
        consecutive.map((p) => p.income),
        consecutive.map((p) => p.balance),
        consecutive.map((p) => p.cashflow),
      ),
    ).toBeNull();
  });
});

describe("a market capitalisation of zero", () => {
  /*
   * screener_stocks defaults market_cap to 0 rather than leaving it null, so a
   * symbol whose cap was never fetched arrives as a real-looking zero. On the
   * first live run that made enterprise value collapse to net debt alone, and
   * BDL - a net-cash company - printed an EV/sales of -1.8.
   */
  const noCap = { market_cap_crore: 0, pe: 0, dividend_yield_pct: 0, profit_growth_yoy_pct: 40 };
  const netCash: BalancePeriod[] = [
    { period_end: "2026-03-31", total_assets: 2000, total_debt: 100, total_equity: 1200, cash_and_equivalents: 900, current_assets: 800, current_liabilities: 400 },
  ];

  it("withholds enterprise value rather than reporting a negative one", () => {
    const metrics = qualityMetrics(improvingIncome, netCash, improvingCashflow, noCap);

    // Net debt is genuinely negative here - that is a real fact and is kept.
    expect(metrics.net_debt).toBe(-800);
    // But enterprise value without a market cap is unknowable, not negative.
    expect(metrics.ev_to_sales).toBeNull();
    expect(metrics.fcf_yield).toBeNull();
  });

  it("computes enterprise value normally once a cap is present", () => {
    const metrics = qualityMetrics(improvingIncome, netCash, improvingCashflow, { ...noCap, market_cap_crore: 4000 });

    expect(metrics.ev_to_sales).toBeCloseTo((4000 * 1e7 - 800) / 1200, 10);
  });
});

describe("the crore / rupee boundary", () => {
  /*
   * screener_stocks quotes market_cap in CRORE (Infosys: 420300) while every
   * fundamentals_* figure is in absolute RUPEES (Infosys total debt:
   * 923000000). Added directly, enterprise value became the net debt with a
   * rounding error attached - negative for thirteen symbols including Infosys -
   * and FCF yield was inflated by ten million.
   */
  const infosys = {
    income: [{ period_end: "2026-03-31", revenue: 482_110_000_000, total_income: 490_000_000_000, total_expenses: 390_000_000_000, profit_after_tax: 77_690_000_000 }],
    balance: [{ period_end: "2026-03-31", total_assets: 1_500_000_000_000, total_debt: 923_000_000, total_equity: 900_000_000_000, cash_and_equivalents: 2_287_000_000, current_assets: 10_000_000_000, current_liabilities: 5_000_000_000 }],
    cashflow: [{ period_end: "2026-03-31", operating_cf: 90_000_000_000, capex: -10_000_000_000 }],
  };

  it("puts a large-cap's enterprise value above its net cash, not below zero", () => {
    const metrics = qualityMetrics(infosys.income, infosys.balance, infosys.cashflow, { market_cap_crore: 420_300 });

    // ₹4.2 lakh crore of market cap against ₹136 crore of net cash.
    expect(metrics.net_debt).toBe(923_000_000 - 2_287_000_000);
    expect(metrics.ev_to_sales!).toBeGreaterThan(0);
    // Roughly 8.7x sales, which is the order of magnitude for a large IT name.
    expect(metrics.ev_to_sales!).toBeCloseTo((420_300 * 1e7 - 1_364_000_000) / 482_110_000_000, 6);
  });

  it("keeps FCF yield in a believable range instead of ten million times it", () => {
    const metrics = qualityMetrics(infosys.income, infosys.balance, infosys.cashflow, { market_cap_crore: 420_300 });

    expect(metrics.fcf_yield!).toBeGreaterThan(0);
    expect(metrics.fcf_yield!).toBeLessThan(0.2);
  });
});

describe("trailingYear", () => {
  const q = (period_end: string, revenue: number, profit_after_tax: number) =>
    ({ period_end, revenue, total_income: revenue, total_expenses: revenue - profit_after_tax, profit_after_tax });
  const quarters = [q("2026-03-31", 400, 40), q("2025-12-31", 300, 30), q("2025-09-30", 200, 20), q("2025-06-30", 100, 10)];

  it("sums the four quarters ending on the date into one year", () => {
    const year = trailingYear(quarters, "2026-03-31")!;
    expect(year).toMatchObject({ period_end: "2026-03-31", revenue: 1000, profit_after_tax: 100 });
  });

  it("refuses a year with a missing quarter rather than understating it", () => {
    expect(trailingYear(quarters.filter((r) => r.period_end !== "2025-09-30"), "2026-03-31")).toBeNull();
  });

  it("refuses a year whose end quarter is not reported", () => {
    expect(trailingYear(quarters, "2026-06-30")).toBeNull();
  });

  it("keeps a sum unknown when any quarter lacks that figure", () => {
    const gappy = [{ ...quarters[0], revenue: null }, ...quarters.slice(1)];
    expect(trailingYear(gappy, "2026-03-31")!.revenue).toBeNull();
  });
});

describe("EV to sales", () => {
  it("is computed on a year of revenue, not one quarter", () => {
    // It used to take the latest QUARTER's revenue, printing every EV/sales
    // about four times too high (RELIANCE showed 13.6).
    const year = { period_end: "2026-03-31", revenue: 1000 * 1e7 };
    const metrics = qualityMetrics([year], [{ period_end: "2026-03-31", total_debt: 0, cash_and_equivalents: 0 }], [], { market_cap_crore: 3000 });
    expect(metrics.ev_to_sales).toBeCloseTo(3);
  });
});

describe("the year EV/sales is measured over", () => {
  // Yahoo carries only the four newest quarters, and the balance sheet arrives a
  // quarter later. Anchoring the year to the newest BALANCE date asked for a
  // fifth quarter nobody had, so EV/sales covered 50 of 234 stocks; anchoring it
  // to the newest income quarter uses exactly what Yahoo provides.
  const income = ["2026-06-30", "2026-03-31", "2025-12-31", "2025-09-30"].map((period_end, i) => ({
    period_end, revenue: 1000 - i * 10, total_income: 1000, total_expenses: 800, profit_after_tax: 100,
  }));

  it("builds the year from the newest income quarter", () => {
    expect(trailingYear(income, income[0].period_end)!.revenue).toBe(1000 + 990 + 980 + 970);
  });

  it("cannot build it from the newest balance-sheet quarter alone", () => {
    expect(trailingYear(income, "2026-03-31")).toBeNull();
  });
});

import { describe, it, expect } from "vitest";
import { parseIncomeStatement } from "../../supabase/functions/_shared/yahoo";

/*
 * Quarterly income from Yahoo, alongside the balance sheet and cash flow the
 * same call already returns.
 *
 * The reason this exists: NSE's corporates-financial-results endpoint stopped
 * returning filings after 31-Dec-2024 for every symbol tested, while the
 * Yahoo-sourced balance and cash flow reach 30-Jun-2026. alignPeriods joins
 * income to balance on an exact period_end match, so the two series never met
 * and derived ratios were computed for 3 rows out of ~1,800 — meaning no stock
 * on the site displayed a ROE at all. Income from the same source as balance
 * and cash flow makes the periods align by construction.
 *
 * NSE XBRL stays authoritative where it exists; these rows carry source
 * 'yahoo' and coexist with it rather than replacing it.
 */

const wrap = (statements: unknown[]) => ({
  quoteSummary: {
    result: [{ incomeStatementHistoryQuarterly: { incomeStatementHistory: statements } }],
  },
});

/** 30 Jun 2026, the shape Yahoo actually returns. */
const JUN_2026 = { raw: 1782777600, fmt: "2026-06-30" };

describe("parseIncomeStatement", () => {
  it("reads a quarter", () => {
    const rows = parseIncomeStatement(
      wrap([
        {
          endDate: JUN_2026,
          totalRevenue: { raw: 2_500_000_000 },
          netIncome: { raw: 300_000_000 },
          incomeBeforeTax: { raw: 400_000_000 },
        },
      ]),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].periodEnd).toBe("2026-06-30");
    expect(rows[0].revenue).toBe(2_500_000_000);
    expect(rows[0].profitAfterTax).toBe(300_000_000);
    expect(rows[0].profitBeforeTax).toBe(400_000_000);
  });

  it("drops a statement with no period, rather than dating it today", () => {
    // A row keyed on the wrong quarter is worse than a missing row: it would
    // join against the wrong balance sheet and produce a confident wrong ratio.
    const rows = parseIncomeStatement(wrap([{ totalRevenue: { raw: 1 } }]));
    expect(rows).toEqual([]);
  });

  it("keeps a quarter whose figures are absent, as nulls", () => {
    // Absent is not zero. computeRatios already treats null as "cannot
    // compute"; writing 0 would make it compute a confidently wrong answer.
    const rows = parseIncomeStatement(wrap([{ endDate: JUN_2026 }]));

    expect(rows).toHaveLength(1);
    expect(rows[0].revenue).toBeNull();
    expect(rows[0].profitAfterTax).toBeNull();
    expect(rows[0].profitBeforeTax).toBeNull();
  });

  it("returns nothing when the module is absent", () => {
    expect(parseIncomeStatement({ quoteSummary: { result: [{}] } })).toEqual([]);
    expect(parseIncomeStatement({})).toEqual([]);
    expect(parseIncomeStatement(null)).toEqual([]);
  });

  it("reads every quarter Yahoo returns, newest first order preserved", () => {
    const rows = parseIncomeStatement(
      wrap([
        { endDate: JUN_2026, totalRevenue: { raw: 4 } },
        { endDate: { raw: 1774915200 }, totalRevenue: { raw: 3 } },
      ]),
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].revenue).toBe(4);
  });
});

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseIncomeStatement } from "../../supabase/functions/_shared/xbrl";

/*
 * RELIANCE's June 2026 quarter as filed under NSE's Integrated Filing regime
 * (INTEGRATED_FILING_INDAS_..._WEB.xml, fetched 2026-09-20). Same in-capmkt
 * vocabulary and same OneD headline context as the older filings, but a
 * different namespace prefix: the matcher hardcoded in-bse-fin:, so every one
 * of these parsed as null and the sync recorded 24 failures with 0 rows.
 */
const xml = readFileSync("src/test/fixtures/nse/integrated-filing-reliance-q1fy27.xml", "utf-8");

describe("parseIncomeStatement on an integrated filing", () => {
  const statement = parseIncomeStatement(xml)!;

  it("reads the headline figures", () => {
    expect(statement).not.toBeNull();
    expect(statement.revenue).toBeGreaterThan(0);
    expect(statement.profitAfterTax).toBeGreaterThan(0);
  });

  it("keeps the Income - Expenses = ProfitBeforeTax identity", () => {
    expect(statement.totalIncome! - statement.totalExpenses!).toBeCloseTo(statement.profitBeforeTax!, 0);
  });

  it("reads the current quarter, not the year to date", () => {
    // OneD is the quarter column; FourD would be several times larger.
    expect(statement.profitAfterTax!).toBeLessThan(statement.totalIncome!);
  });
});

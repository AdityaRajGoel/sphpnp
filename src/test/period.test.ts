import { describe, it, expect } from "vitest";
import { alignPeriods } from "../../supabase/functions/_shared/period";

const inc = (period_end: string, pat = 100, pbt = 130) =>
  ({ period_end, profit_after_tax: pat, profit_before_tax: pbt });
const bal = (period_end: string, eq = 500) =>
  ({ period_end, total_equity: eq, total_debt: 200, current_assets: 300, current_liabilities: 150 });
const cf = (period_end: string, op = 90) =>
  ({ period_end, operating_cf: op, capex: 30 });

describe("alignPeriods", () => {
  it("pairs rows that share an exact period_end", () => {
    const out = alignPeriods([inc("2024-12-31")], [bal("2024-12-31")], [cf("2024-12-31")]);
    expect(out).toHaveLength(1);
    expect(out[0].periodEnd).toBe("2024-12-31");
    expect(out[0].input.profitAfterTax).toBe(100);
    expect(out[0].input.totalEquity).toBe(500);
    expect(out[0].input.operatingCf).toBe(90);
  });

  // THE TRAP. NSE's filing toDate and Yahoo's quarter endDate can differ by a
  // few days. Pairing a Q2 profit with a Q3 equity yields a plausible, wrong
  // ROE - the same class of defect as mixing consolidated with standalone.
  it("never pairs periods that differ, even by one day", () => {
    const out = alignPeriods([inc("2024-12-31")], [bal("2024-12-30")], [cf("2024-12-31")]);
    expect(out).toHaveLength(0);
  });

  it("emits nothing when the balance sheet is missing for a period", () => {
    expect(alignPeriods([inc("2024-12-31")], [], [cf("2024-12-31")])).toHaveLength(0);
  });

  it("emits nothing when cash flow is missing for a period", () => {
    expect(alignPeriods([inc("2024-12-31")], [bal("2024-12-31")], [])).toHaveLength(0);
  });

  it("aligns only the periods present in all three, ignoring the rest", () => {
    const out = alignPeriods(
      [inc("2024-12-31"), inc("2024-09-30"), inc("2024-06-30")],
      [bal("2024-12-31"), bal("2024-09-30")],
      [cf("2024-12-31")],
    );
    expect(out.map((x) => x.periodEnd)).toEqual(["2024-12-31"]);
  });

  it("passes nulls through rather than substituting zero", () => {
    const out = alignPeriods(
      [{ period_end: "2024-12-31", profit_after_tax: null, profit_before_tax: null }],
      [{ period_end: "2024-12-31", total_equity: null, total_debt: null, current_assets: null, current_liabilities: null }],
      [{ period_end: "2024-12-31", operating_cf: null, capex: null }],
    );
    expect(out[0].input.profitAfterTax).toBeNull();
    expect(out[0].input.totalEquity).toBeNull();
  });
});

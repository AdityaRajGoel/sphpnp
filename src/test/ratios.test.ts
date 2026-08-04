import { describe, it, expect } from "vitest";
import { computeRatios } from "../../supabase/functions/_shared/ratios";

const complete = {
  profitAfterTax: 100,
  totalEquity: 500,
  profitBeforeTax: 120,
  totalDebt: 300,
  currentAssets: 200,
  currentLiabilities: 100,
  operatingCf: 150,
  capex: 50,
};

describe("computeRatios", () => {
  it("computes ratios when every input is present", () => {
    const r = computeRatios(complete);
    expect(r.roe).toBeCloseTo(20);          // 100/500
    expect(r.roce).toBeCloseTo(15);         // 120/(500+300)
    expect(r.currentRatio).toBeCloseTo(2);  // 200/100
    expect(r.freeCashFlow).toBe(100);       // 150-50
    expect(r.inputsComplete).toBe(true);
    expect(r.missingInputs).toEqual([]);
  });

  it("withholds ROE entirely when equity is missing", () => {
    const r = computeRatios({ ...complete, totalEquity: null });
    // The point of the whole design: no ROE beats an ROE on a partial
    // denominator. It must be null, not 0 and not Infinity.
    expect(r.roe).toBeNull();
    expect(r.inputsComplete).toBe(false);
    expect(r.missingInputs).toContain("totalEquity");
  });

  it("withholds free cash flow when capex is missing", () => {
    const r = computeRatios({ ...complete, capex: null });
    expect(r.freeCashFlow).toBeNull();
    expect(r.missingInputs).toContain("capex");
  });

  it("never divides by zero", () => {
    const r = computeRatios({ ...complete, totalEquity: 0, currentLiabilities: 0 });
    expect(r.roe).toBeNull();
    expect(r.currentRatio).toBeNull();
  });

  it("still reports the ratios it can compute", () => {
    const r = computeRatios({ ...complete, operatingCf: null });
    expect(r.freeCashFlow).toBeNull();
    expect(r.roe).toBeCloseTo(20);
    expect(r.inputsComplete).toBe(false);
  });
});

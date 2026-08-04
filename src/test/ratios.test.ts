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

  // Regression coverage: a present-but-zero denominator must not be reported
  // as "inputsComplete: true". totalEquity: 0 is finite, so the old
  // missingInputs-only bookkeeping never flagged it — a consumer branching
  // on inputsComplete would have been told the row was trustworthy while
  // roe was silently null.
  it("marks inputs incomplete when a denominator is present but zero", () => {
    const r = computeRatios({ ...complete, totalEquity: 0 });
    expect(r.roe).toBeNull();
    expect(r.inputsComplete).toBe(false);
    // It is not missing — it is unusable. The two lists must stay distinct.
    expect(r.missingInputs).not.toContain("totalEquity");
    expect(r.unusableInputs).toContain("totalEquity");
  });

  // Neither totalEquity nor totalDebt is individually zero here; they cancel
  // out to a zero capital-employed denominator for ROCE specifically.
  it("marks inputs incomplete when equity and debt cancel to a zero denominator", () => {
    const r = computeRatios({ ...complete, totalEquity: 100, totalDebt: -100 });
    expect(r.roce).toBeNull();
    expect(r.inputsComplete).toBe(false);
    expect(r.unusableInputs).toContain("totalEquity+totalDebt");
  });

  // Guard against over-correcting: a fully-populated, fully-usable input
  // must still report inputsComplete: true. If this test ever fails, the
  // fix for the finding above was too aggressive.
  it("still reports inputsComplete true when every input is genuinely usable", () => {
    const r = computeRatios(complete);
    expect(r.inputsComplete).toBe(true);
    expect(r.unusableInputs).toEqual([]);
  });
});

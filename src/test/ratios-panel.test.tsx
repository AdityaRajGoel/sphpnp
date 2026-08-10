import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import RatiosPanel from "@/components/stock/RatiosPanel";
import type { DerivedRow } from "@/hooks/useStockFundamentals";
import { computeRatios, type RatioInput } from "../../supabase/functions/_shared/ratios";

/**
 * These tests exist for one reason: RatiosPanel explains a blank cell by
 * matching strings against `missing_inputs` / `unusable_inputs`, and those
 * strings are produced a whole system away - by `computeRatios` in a Deno edge
 * function, written to Postgres, read back by the hook. Nothing in the type
 * system connects the two ends. Rename a `RatioInput` field and the panel does
 * not fail to compile and does not fail to render; it silently downgrades every
 * explained gap to a bare "Not available" forever, which is precisely the
 * class of quiet degradation `ratios.ts` was written to prevent one layer down.
 *
 * So the panel is driven from real `computeRatios` output rather than
 * hand-written arrays. A fixture that hardcoded "totalEquity" would keep
 * passing through exactly the rename that breaks production.
 */

const COMPLETE: RatioInput = {
  profitAfterTax: 100,
  totalEquity: 500,
  profitBeforeTax: 120,
  totalDebt: 300,
  currentAssets: 200,
  currentLiabilities: 100,
  operatingCf: 150,
  capex: 50,
};

/** Runs the real pipeline, then shapes it exactly as the sync writes it. */
const rowFrom = (input: RatioInput, periodEnd = "2026-03-31"): DerivedRow => {
  const r = computeRatios(input);
  return {
    period_end: periodEnd,
    roe: r.roe,
    roce: r.roce,
    current_ratio: r.currentRatio,
    free_cash_flow: r.freeCashFlow,
    inputs_complete: r.inputsComplete,
    missing_inputs: r.missingInputs,
    unusable_inputs: r.unusableInputs,
  };
};

afterEach(cleanup);

describe("RatiosPanel", () => {
  it("renders nothing when the Yahoo sync has not reached the symbol", () => {
    const { container } = render(<RatiosPanel derived={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders ROE and ROCE as percentages, not as fractions", () => {
    render(<RatiosPanel derived={[rowFrom(COMPLETE)]} />);
    // computeRatios already multiplies by 100 - 100/500 is a 20% return, and a
    // cell reading "0.20%" would be the panel double-converting.
    expect(screen.getByText("20.00%")).toBeDefined();
    expect(screen.getByText("15.00%")).toBeDefined();
  });

  it("says 'not reported' when an input never arrived", () => {
    render(<RatiosPanel derived={[rowFrom({ ...COMPLETE, totalEquity: null })]} />);
    expect(screen.getAllByText("Not reported").length).toBeGreaterThan(0);
    expect(screen.queryByText("Not meaningful")).toBeNull();
  });

  it("says 'not meaningful' when a denominator arrived and is unusable", () => {
    // Negative equity is a real state; a loss divided into it reads as a
    // healthy return, which is why computeRatios withholds rather than divides.
    render(<RatiosPanel derived={[rowFrom({ ...COMPLETE, totalEquity: -500 })]} />);
    expect(screen.getAllByText("Not meaningful").length).toBeGreaterThan(0);
  });

  it("never falls back to the generic label when the row carries a reason", () => {
    // The regression this whole file guards: if the panel's input names drift
    // from RatioInput's keys, every explained gap quietly becomes "Not
    // available" and no other assertion here would notice.
    render(<RatiosPanel derived={[rowFrom({ ...COMPLETE, currentLiabilities: 0 })]} />);
    expect(screen.getAllByText("Not meaningful").length).toBeGreaterThan(0);
    expect(screen.queryByText("Not available")).toBeNull();
  });

  it("explains each metric from its own inputs, not the row's", () => {
    // capex is a free-cash-flow input only. It must not blank or annotate ROE.
    render(<RatiosPanel derived={[rowFrom({ ...COMPLETE, capex: null })]} />);
    expect(screen.getByText("20.00%")).toBeDefined();
    expect(screen.getAllByText("Not reported")).toHaveLength(1);
  });
});

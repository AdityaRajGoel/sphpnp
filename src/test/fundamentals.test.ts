import { describe, it, expect } from "vitest";
import {
  selectBasis, formatINR, formatCrore, formatRatio, toCell, type IncomeRow,
} from "../lib/fundamentals";

const row = (over: Partial<IncomeRow> = {}): IncomeRow => ({
  symbol: "RELIANCE", period_end: "2024-12-31", is_consolidated: true,
  revenue: 1282600000000, other_income: null, total_income: null,
  total_expenses: null, profit_before_tax: null, profit_after_tax: null,
  basic_eps: 6.44, diluted_eps: 6.44, debt_equity_ratio: 0.41,
  debt_service_coverage_ratio: null, ...over,
});

describe("selectBasis", () => {
  it("prefers consolidated when both bases exist", () => {
    const r = selectBasis([
      row({ period_end: "2024-12-31", is_consolidated: true, revenue: 100 }),
      row({ period_end: "2024-12-31", is_consolidated: false, revenue: 90 }),
    ]);
    expect(r.basis).toBe("consolidated");
    expect(r.rows.map((x) => x.revenue)).toEqual([100]);
    expect(r.bothAvailable).toBe(true);
  });

  // The mixing trap: a naive query orders by period_end and interleaves both
  // bases into what reads as a revenue trend and is not one.
  it("never interleaves the two bases", () => {
    const r = selectBasis([
      row({ period_end: "2024-12-31", is_consolidated: true, revenue: 100 }),
      row({ period_end: "2024-09-30", is_consolidated: false, revenue: 90 }),
      row({ period_end: "2024-06-30", is_consolidated: true, revenue: 80 }),
    ]);
    expect(r.rows.every((x) => x.is_consolidated)).toBe(true);
  });

  it("falls back to standalone when no consolidated row exists", () => {
    const r = selectBasis([row({ is_consolidated: false })]);
    expect(r.basis).toBe("standalone");
    expect(r.bothAvailable).toBe(false);
  });

  it("returns a null basis for no rows", () => {
    expect(selectBasis([]).basis).toBeNull();
  });

  it("orders rows newest first", () => {
    const r = selectBasis([
      row({ period_end: "2024-06-30" }), row({ period_end: "2024-12-31" }),
    ]);
    expect(r.rows.map((x) => x.period_end)).toEqual(["2024-12-31", "2024-06-30"]);
  });
});

describe("formatINR", () => {
  it("renders crore for values at or above one crore", () => {
    expect(formatINR(1282600000000)).toBe("₹1,28,260.00 Cr");
  });
  it("renders lakh below a crore", () => {
    expect(formatINR(2500000)).toBe("₹25.00 L");
  });
  it("keeps the sign on negatives", () => {
    expect(formatINR(-50000000)).toBe("-₹5.00 Cr");
  });
  it("returns an em dash for null so callers must use toCell", () => {
    expect(formatINR(null)).toBe("—");
  });
});

describe("formatCrore", () => {
  // screener_stocks.market_cap is stored in crore. Reliance sits at ~17.93 lakh
  // crore; formatINR read the same number as rupees and published "₹17.93 L".
  it("renders a large cap in lakh crore", () => {
    expect(formatCrore(1793000)).toBe("₹17.93 L Cr");
  });
  it("does not agree with formatINR on the same number", () => {
    expect(formatCrore(1793000)).not.toBe(formatINR(1793000));
  });
  it("renders a mid cap in plain crore with Indian grouping", () => {
    expect(formatCrore(66927)).toBe("₹66,927 Cr");
  });
  it("stays in plain crore just below one lakh crore", () => {
    expect(formatCrore(99999)).toBe("₹99,999 Cr");
  });
  it("switches to lakh crore exactly at one lakh crore", () => {
    expect(formatCrore(100000)).toBe("₹1.00 L Cr");
  });
  it("keeps the sign on negatives", () => {
    expect(formatCrore(-500)).toBe("-₹500 Cr");
  });
  it("returns an em dash for null", () => {
    expect(formatCrore(null)).toBe("—");
  });
  // fetch-screener-data writes 0 when the upstream quote has no market cap, so
  // 0 is an unknown rather than a real value. Formatting it is still defined;
  // suppressing it is the caller's job (StockPage guards on truthiness).
  it("formats zero rather than throwing, leaving suppression to the caller", () => {
    expect(formatCrore(0)).toBe("₹0 Cr");
  });
});

describe("toCell", () => {
  it("marks null as missing with a reason, never as zero", () => {
    const c = toCell(null, (n) => String(n));
    expect(c.kind).toBe("missing");
    if (c.kind === "missing") expect(c.reason).toMatch(/not reported/i);
  });
  it("passes a real zero through as a value", () => {
    const c = toCell(0, (n) => String(n));
    expect(c).toEqual({ kind: "value", text: "0" });
  });
});

describe("formatRatio", () => {
  it("renders two decimals", () => expect(formatRatio(0.41)).toBe("0.41"));
  it("renders an em dash for null", () => expect(formatRatio(null)).toBe("—"));
});

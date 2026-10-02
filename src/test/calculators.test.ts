import { describe, it, expect } from "vitest";
import {
  averagePrice, cagr, cashFlowXirr, lumpsum, optionValue, sharesToReachAverage, stepUpSip, swp,
} from "@/lib/calculators";

/*
 * Reference values, not snapshots: each expectation below was worked out by
 * hand (or is the published textbook figure), so a regression in the maths
 * fails here rather than shipping a plausible-looking wrong number.
 */

describe("lumpsum", () => {
  it("compounds once a year", () => {
    const r = lumpsum(100000, 12, 10)!;
    expect(r.value).toBeCloseTo(310584.82, 2);
    expect(r.invested).toBe(100000);
    expect(r.gain).toBeCloseTo(210584.82, 2);
    expect(r.rows).toHaveLength(10);
    expect(r.rows[0]).toMatchObject({ year: 1, invested: 100000 });
    expect(r.rows[0].value).toBeCloseTo(112000, 6);
  });

  it("returns the amount unchanged at 0%", () => {
    expect(lumpsum(50000, 0, 5)!.value).toBe(50000);
  });

  it("refuses zero, negative and non-finite inputs", () => {
    expect(lumpsum(0, 12, 10)).toBeNull();
    expect(lumpsum(-5, 12, 10)).toBeNull();
    expect(lumpsum(1000, 12, 0)).toBeNull();
    expect(lumpsum(1000, NaN, 5)).toBeNull();
    expect(lumpsum(1000, -100, 5)).toBeNull();
  });
});

describe("stepUpSip", () => {
  it("matches a hand-checked month-by-month loop", () => {
    // ₹1,000 a month, +10% each year, 1% a month, 2 years, paid at the start of
    // each month: year 1 grows to 12,809.33, then compounds another 12 months to
    // 14,433.88; year 2's ₹1,100 instalments reach 14,090.26. Total 28,524.13.
    const r = stepUpSip(1000, 10, 12, 2)!;
    expect(r.value).toBeCloseTo(28524.13, 2);
    expect(r.invested).toBeCloseTo(12000 + 13200, 6);
    expect(r.rows[0].invested).toBeCloseTo(12000, 6);
    expect(r.rows[0].value).toBeCloseTo(12809.33, 2);
  });

  it("equals the plain SIP formula with no step-up", () => {
    // Same annuity-due formula the /sip-calculator uses.
    expect(stepUpSip(5000, 0, 12, 10)!.value).toBeCloseTo(1161695.38, 2);
  });

  it("refuses zero or negative amounts and periods", () => {
    expect(stepUpSip(0, 10, 12, 10)).toBeNull();
    expect(stepUpSip(5000, -5, 12, 10)).toBeNull();
    expect(stepUpSip(5000, 10, 12, 0)).toBeNull();
  });
});

describe("swp", () => {
  it("matches a hand-checked month-by-month loop", () => {
    // Each month the corpus earns 1%, then ₹10,000 is paid out:
    // 1,01,000 - 10,000 = 91,000; 91,910 - 10,000 = 81,910; 82,729.10 - 10,000 = 72,729.10.
    const r = swp(100000, 10000, 12, 0.25)!;
    expect(r.balance).toBeCloseTo(72729.1, 4);
    expect(r.withdrawn).toBe(30000);
    expect(r.monthsPaid).toBe(3);
    expect(r.depleted).toBe(false);
  });

  it("stops when the corpus runs out, paying the remainder last", () => {
    const r = swp(25000, 10000, 0, 1)!;
    expect(r.withdrawn).toBe(25000);
    expect(r.balance).toBe(0);
    expect(r.monthsPaid).toBe(3);
    expect(r.depleted).toBe(true);
  });

  it("keeps a year-end row per year", () => {
    const r = swp(1000000, 5000, 8, 3)!;
    expect(r.rows.map((x) => x.year)).toEqual([1, 2, 3]);
    expect(r.rows[2].withdrawn).toBe(180000);
  });

  it("refuses zero or negative inputs", () => {
    expect(swp(0, 1000, 8, 5)).toBeNull();
    expect(swp(100000, 0, 8, 5)).toBeNull();
    expect(swp(100000, 1000, 8, -1)).toBeNull();
  });
});

describe("cagr", () => {
  it("annualises growth", () => {
    expect(cagr(100000, 200000, 5)!).toBeCloseTo(14.8698, 4);
    expect(cagr(100, 100, 3)!).toBe(0);
  });

  it("shows a total loss as -100%", () => {
    expect(cagr(100, 0, 2)!).toBe(-100);
  });

  it("refuses a non-positive start, negative end or period", () => {
    expect(cagr(0, 100, 5)).toBeNull();
    expect(cagr(-10, 100, 5)).toBeNull();
    expect(cagr(100, -1, 5)).toBeNull();
    expect(cagr(100, 200, 0)).toBeNull();
  });
});

describe("cashFlowXirr", () => {
  it("matches the textbook example (Excel's XIRR documentation, 37.34%)", () => {
    const r = cashFlowXirr([
      { date: "2008-01-01", amount: -10000 },
      { date: "2008-03-01", amount: 2750 },
      { date: "2008-10-30", amount: 4250 },
      { date: "2009-02-15", amount: 3250 },
      { date: "2009-04-01", amount: 2750 },
    ]);
    expect(r).not.toBeNull();
    expect(r!).toBeCloseTo(37.336, 2);
  });

  it("does not care what order the rows are typed in", () => {
    const r = cashFlowXirr([
      { date: "2009-04-01", amount: 2750 },
      { date: "2008-01-01", amount: -10000 },
      { date: "2009-02-15", amount: 3250 },
      { date: "2008-10-30", amount: 4250 },
      { date: "2008-03-01", amount: 2750 },
    ]);
    expect(r!).toBeCloseTo(37.336, 2);
  });

  it("returns null, never NaN, when it cannot be solved", () => {
    // No money coming back: no rate makes the flows net to zero.
    expect(cashFlowXirr([{ date: "2024-01-01", amount: -1000 }, { date: "2025-01-01", amount: -1000 }])).toBeNull();
    // A single flow.
    expect(cashFlowXirr([{ date: "2024-01-01", amount: -1000 }])).toBeNull();
    // Unparseable rows.
    expect(cashFlowXirr([{ date: "not a date", amount: -1000 }, { date: "2025-01-01", amount: 1100 }])).toBeNull();
    expect(cashFlowXirr([{ date: "2024-01-01", amount: NaN }, { date: "2025-01-01", amount: 1100 }])).toBeNull();
    // Every flow on one day has no time in it to annualise over.
    expect(cashFlowXirr([{ date: "2024-01-01", amount: -1000 }, { date: "2024-01-01", amount: 1100 }])).toBeNull();
  });
});

describe("averagePrice", () => {
  it("averages several buys, including averaging down", () => {
    const r = averagePrice([
      { side: "buy", qty: 10, price: 100 },
      { side: "buy", qty: 10, price: 80 },
    ]);
    expect(r).toMatchObject({ ok: true, qty: 20, average: 90, cost: 1800, realised: 0 });
  });

  it("matches sells against the earliest buys first", () => {
    const r = averagePrice([
      { side: "buy", qty: 10, price: 100 },
      { side: "buy", qty: 10, price: 80 },
      { side: "sell", qty: 12, price: 95 },
      { side: "buy", qty: 2, price: 70 },
    ]);
    // The sell takes all 10 @100 (-50) and 2 @80 (+30): realised -20.
    // Left: 8 @80 + 2 @70 = 780 for 10 shares.
    expect(r).toMatchObject({ ok: true, qty: 10, average: 78, cost: 780, realised: -20 });
  });

  it("flags a sell of more shares than are held", () => {
    const r = averagePrice([
      { side: "buy", qty: 5, price: 100 },
      { side: "sell", qty: 6, price: 110 },
    ]);
    expect(r).toMatchObject({ ok: false, row: 1 });
  });

  it("flags zero or negative quantities and prices", () => {
    expect(averagePrice([{ side: "buy", qty: 0, price: 100 }])).toMatchObject({ ok: false, row: 0 });
    expect(averagePrice([{ side: "buy", qty: 5, price: -1 }])).toMatchObject({ ok: false, row: 0 });
  });

  it("reports an empty holding once everything is sold", () => {
    const r = averagePrice([
      { side: "buy", qty: 5, price: 100 },
      { side: "sell", qty: 5, price: 120 },
    ]);
    expect(r).toMatchObject({ ok: true, qty: 0, average: 0, cost: 0, realised: 100 });
  });
});

describe("sharesToReachAverage", () => {
  it("works out the buy that brings the average down to a target", () => {
    // 100 @ 500; buying x @ 400 to reach 450: (50000 + 400x) / (100 + x) = 450 → x = 100.
    expect(sharesToReachAverage(100, 500, 400, 450)).toBe(100);
  });

  it("rounds up to whole shares", () => {
    // 100 @ 500 → 460 at 400: x = 100 * 40 / 60 = 66.7 → 67.
    expect(sharesToReachAverage(100, 500, 400, 460)).toBe(67);
  });

  it("is null when the target cannot be reached at that price", () => {
    expect(sharesToReachAverage(100, 500, 400, 400)).toBeNull();
    expect(sharesToReachAverage(100, 500, 400, 350)).toBeNull();
    expect(sharesToReachAverage(100, 500, 520, 480)).toBeNull();
    expect(sharesToReachAverage(0, 500, 400, 450)).toBeNull();
  });
});

describe("optionValue", () => {
  // The canonical case: S=100, K=100, r=5%, sigma=20%, T=1 year.
  const canonical = optionValue({ spot: 100, strike: 100, days: 365, volPct: 20, ratePct: 5 })!;

  it("prices the textbook call and put", () => {
    expect(canonical.call.price).toBeCloseTo(10.4506, 3);
    expect(canonical.put.price).toBeCloseTo(5.5735, 3);
  });

  it("gives the textbook Greeks", () => {
    expect(canonical.call.delta).toBeCloseTo(0.6368, 4);
    expect(canonical.put.delta).toBeCloseTo(-0.3632, 4);
    expect(canonical.call.gamma).toBeCloseTo(0.018762, 5);
    expect(canonical.call.vega).toBeCloseTo(0.3752, 4);
    expect(canonical.call.theta).toBeCloseTo(-0.017573, 5);
    expect(canonical.call.rho).toBeCloseTo(0.5323, 4);
    expect(canonical.put.rho).toBeCloseTo(-0.4189, 4);
  });

  it("satisfies put-call parity", () => {
    expect(canonical.call.price - canonical.put.price).toBeCloseTo(100 - 100 * Math.exp(-0.05), 6);
  });

  it("refuses inputs that cannot support a price", () => {
    expect(optionValue({ spot: 0, strike: 100, days: 30, volPct: 20, ratePct: 5 })).toBeNull();
    expect(optionValue({ spot: 100, strike: 100, days: 0, volPct: 20, ratePct: 5 })).toBeNull();
    expect(optionValue({ spot: 100, strike: 100, days: 30, volPct: 0, ratePct: 5 })).toBeNull();
    expect(optionValue({ spot: 100, strike: -1, days: 30, volPct: 20, ratePct: 5 })).toBeNull();
  });
});

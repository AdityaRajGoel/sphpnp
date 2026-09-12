import { describe, it, expect } from "vitest";
import {
  atmMetrics,
  blackScholes,
  greeks,
  impliedVolatility,
  ivRank,
  normalCdf,
  yearsToExpiry,
  RISK_FREE_RATE,
  type ChainRow,
} from "../../supabase/functions/_shared/option-greeks";

/*
 * Black-Scholes has published reference values, so these assert the real
 * numbers rather than snapshots of whatever the code happened to produce. The
 * canonical case throughout is S=100, K=100, r=5%, T=1y, vol=20%, whose call is
 * 10.4506 and put 5.5735 in every textbook that prints one.
 */
const canonical = { spot: 100, strike: 100, years: 1, vol: 0.2, rate: 0.05 };

describe("normalCdf", () => {
  it("matches the standard normal at the points everyone knows", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 4);
    expect(normalCdf(-1.96)).toBeCloseTo(0.025, 4);
  });
});

describe("blackScholes", () => {
  it("prices the canonical call and put", () => {
    expect(blackScholes(canonical, "call")!).toBeCloseTo(10.4506, 3);
    expect(blackScholes(canonical, "put")!).toBeCloseTo(5.5735, 3);
  });

  it("satisfies put-call parity", () => {
    // C - P = S - K*e^(-rT). If this fails the two branches have drifted apart.
    const call = blackScholes(canonical, "call")!;
    const put = blackScholes(canonical, "put")!;

    expect(call - put).toBeCloseTo(100 - 100 * Math.exp(-0.05), 6);
  });

  it("returns null rather than NaN for an expired or zero-volatility input", () => {
    // Both produce a division by zero inside d1. A NaN escaping here would be
    // stored as a number and rendered as one.
    expect(blackScholes({ ...canonical, years: 0 }, "call")).toBeNull();
    expect(blackScholes({ ...canonical, vol: 0 }, "call")).toBeNull();
    expect(blackScholes({ ...canonical, spot: 0 }, "call")).toBeNull();
  });
});

describe("greeks", () => {
  it("matches the canonical call greeks in reader-facing units", () => {
    const g = greeks(canonical, "call")!;

    expect(g.delta).toBeCloseTo(0.6368, 3);
    expect(g.gamma).toBeCloseTo(0.018762, 5);
    // Vega per percentage point of IV, not per whole unit of it: the raw
    // figure here is 37.52, which is not what a reader means by vega.
    expect(g.vega).toBeCloseTo(0.3752, 3);
    // Theta per calendar day, and negative - a long call decays.
    expect(g.theta).toBeLessThan(0);
    expect(g.theta).toBeCloseTo(-6.414 / 365, 4);
  });

  it("gives a put a negative delta and the same gamma as the call", () => {
    const call = greeks(canonical, "call")!;
    const put = greeks(canonical, "put")!;

    expect(put.delta).toBeCloseTo(call.delta - 1, 6);
    expect(put.gamma).toBeCloseTo(call.gamma, 10);
  });
});

describe("impliedVolatility", () => {
  it("recovers the volatility a price was generated from", () => {
    for (const vol of [0.12, 0.2, 0.45, 0.9]) {
      const price = blackScholes({ ...canonical, vol }, "call")!;

      expect(impliedVolatility(price, { spot: 100, strike: 100, years: 1, rate: 0.05 }, "call")!).toBeCloseTo(vol * 100, 2);
    }
  });

  it("recovers it for a far out-of-the-money index strike", () => {
    // A real shape: Nifty at 25,000, the 27,000 call a month out. Vega is much
    // lower here than at the money, which is where an unguarded Newton step
    // starts walking off toward a negative volatility.
    const input = { spot: 25000, strike: 27000, years: 0.08, rate: 0.05 };
    const price = blackScholes({ ...input, vol: 0.14 }, "call")!;

    expect(impliedVolatility(price, input, "call")!).toBeCloseTo(14, 1);
  });

  it("refuses a premium thinner than one tick of time value", () => {
    // The 180 call on a 100 spot, a month out, models at ₹0.0004 - below NSE's
    // ₹0.05 tick, so it could never be quoted. Whatever volatility explains
    // that number is a property of the rounding, not of the market.
    const input = { spot: 100, strike: 180, years: 0.08, rate: 0.05 };
    const price = blackScholes({ ...input, vol: 0.55 }, "call")!;

    expect(price).toBeLessThan(0.05);
    expect(impliedVolatility(price, input, "call")).toBeNull();
  });

  it("refuses a price at or below intrinsic value", () => {
    // No time value left to invert. A solver asked to explain it will happily
    // return a volatility of essentially zero, which is a statement about the
    // model rather than the market.
    const intrinsic = 100 - 80 * Math.exp(-RISK_FREE_RATE * 0.5);

    expect(impliedVolatility(intrinsic, { spot: 100, strike: 80, years: 0.5 }, "call")).toBeNull();
    expect(impliedVolatility(0, { spot: 100, strike: 100, years: 0.5 }, "call")).toBeNull();
  });

  it("refuses an expired contract", () => {
    expect(impliedVolatility(5, { spot: 100, strike: 100, years: 0 }, "call")).toBeNull();
  });
});

describe("yearsToExpiry", () => {
  it("counts calendar days, and floors an expired contract at zero", () => {
    expect(yearsToExpiry("2026-09-11", "2026-10-11")).toBeCloseTo(30 / 365, 10);
    expect(yearsToExpiry("2026-09-11", "2026-09-11")).toBe(0);
    expect(yearsToExpiry("2026-09-11", "2026-09-01")).toBe(0);
  });
});

describe("atmMetrics", () => {
  const rows: ChainRow[] = [
    { strike: 24800, callLTP: 310, callIV: 12.4, putLTP: 95, putIV: 13.1 },
    { strike: 25000, callLTP: 180, callIV: 11.8, putLTP: 165, putIV: 13.6 },
    { strike: 25200, callLTP: 95, callIV: 11.5, putLTP: 290, putIV: 14.2 },
  ];

  it("picks the strike nearest spot and prices the straddle from it", () => {
    const atm = atmMetrics(rows, 25040)!;

    expect(atm.strike).toBe(25000);
    expect(atm.straddle).toBe(345);
    // 345 on a 25,040 spot: the market is pricing about a 1.4% move by expiry.
    expect(atm.expectedMovePct).toBeCloseTo((345 / 25040) * 100, 6);
  });

  it("reports skew as puts over calls", () => {
    expect(atmMetrics(rows, 25040)!.skew).toBeCloseTo(13.6 - 11.8, 10);
  });

  it("treats NSE's zero IV as absent, not as a volatility of zero", () => {
    // The chain parser coerces a missing field to 0. Averaging that in would
    // drag every IV measure toward nothing.
    const blank: ChainRow[] = [{ strike: 25000, callLTP: 180, callIV: 0, putLTP: 165, putIV: 0 }];

    const atm = atmMetrics(blank, 25000)!;

    expect(atm.callIV).toBeNull();
    expect(atm.putIV).toBeNull();
    expect(atm.skew).toBeNull();
    // The straddle is still real - those are traded prices, not model output.
    expect(atm.straddle).toBe(345);
  });

  it("is null for an empty chain or an unusable spot", () => {
    expect(atmMetrics([], 25000)).toBeNull();
    expect(atmMetrics(rows, 0)).toBeNull();
  });
});

describe("ivRank", () => {
  const history = Array.from({ length: 60 }, (_, i) => 10 + (i % 21));

  it("places a value in its own observed range", () => {
    expect(ivRank(10, history)).toBeCloseTo(0, 6);
    expect(ivRank(30, history)).toBeCloseTo(100, 6);
    expect(ivRank(20, history)).toBeCloseTo(50, 6);
  });

  it("refuses a history too short to be a range", () => {
    expect(ivRank(20, [12, 18, 25])).toBeNull();
  });

  it("refuses a flat history rather than dividing by zero", () => {
    expect(ivRank(20, Array.from({ length: 60 }, () => 20))).toBeNull();
  });
});

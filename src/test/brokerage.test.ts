import { describe, it, expect } from "vitest";
import { calculateCharges, formatRule, RATE_CARD, SEGMENTS, segmentByKey } from "@/lib/brokerage";

describe("calculateCharges", () => {
  it("prices an intraday round trip at 0.02% with STT on the sell side only", () => {
    // Buy 100 @ 1500, sell @ 1520: turnover 3,02,000.
    const c = calculateCharges(segmentByKey("equity_intraday"), { buyPrice: 1500, sellPrice: 1520, quantity: 100, lots: 0 });
    expect(c.brokerage).toBeCloseTo(60.4, 4);
    expect(c.stt).toBeCloseTo(38, 4); // 0.025% of 1,52,000
    expect(c.exchange).toBeCloseTo(9.2714, 4); // 0.00307% of 3,02,000
    expect(c.sebi).toBeCloseTo(0.302, 4);
    expect(c.gst).toBeCloseTo(0.18 * (60.4 + 9.2714 + 0.302), 4); // SEBI fee is taxed too
    expect(c.stamp).toBeCloseTo(4.5, 4); // 0.003% of the buy side
    expect(c.total).toBeCloseTo(125.0686, 3);
  });

  it("charges options ₹30 per lot on each side, not a flat ₹30", () => {
    // 2 lots of 75, premium 100 -> 120.
    const c = calculateCharges(segmentByKey("options"), { buyPrice: 100, sellPrice: 120, quantity: 150, lots: 2 });
    expect(c.brokerage).toBe(120); // 30 x 2 lots x 2 sides
    expect(c.stt).toBeCloseTo(27, 4); // 0.15% of 18,000 sell premium
    expect(c.exchange).toBeCloseTo(11.7249, 4); // 0.03553% of 33,000 premium turnover
    expect(c.total).toBeCloseTo(120 + 27 + 11.7249 + 0.033 + 0.18 * (120 + 11.7249 + 0.033) + 0.45, 3);
  });

  it("charges one side only when there is no sell price", () => {
    const c = calculateCharges(segmentByKey("options"), { buyPrice: 100, sellPrice: 0, quantity: 75, lots: 1 });
    expect(c.brokerage).toBe(30);
    expect(c.stt).toBe(0);
  });

  it("treats blank or negative inputs as zero rather than producing NaN", () => {
    const c = calculateCharges(segmentByKey("equity_delivery"), { buyPrice: NaN, sellPrice: -5, quantity: 10, lots: 0 });
    expect(c.total).toBe(0);
  });

  it("applies CTT, not STT, to MCX and the currency stamp duty of 0.0001%", () => {
    expect(segmentByKey("commodity_futures").taxName).toBe("CTT");
    expect(segmentByKey("currency_futures").stamp).toBe(0.000001);
    expect(segmentByKey("currency_futures").sttSell).toBe(0);
  });
});

describe("rate card", () => {
  it("prints the published Parasram rates", () => {
    expect(RATE_CARD.map((r) => `${r.label}: ${formatRule(r.rule)}`)).toEqual([
      "Equity Delivery: 0.15%",
      "Equity Intraday: 0.02%",
      "Equity Futures: 0.02%",
      "Equity Options: ₹30 per lot",
      "Currency Futures: 0.02%",
      "Currency Options: ₹30 per lot",
      "Commodity (MCX): ₹30 per lot",
    ]);
  });

  it("has every calculator segment read its brokerage from the rate card", () => {
    const cardRules = new Set(RATE_CARD.map((r) => r.rule));
    for (const s of SEGMENTS) expect(cardRules.has(s.brokerage), s.key).toBe(true);
  });
});

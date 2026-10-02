import { describe, expect, it } from "vitest";
import { harvest } from "@/lib/tax-harvest";

const LAKH = 100_000;
const pos = (symbol: string, qty: number, avg: number, price: number, longTerm = false) => ({ symbol, qty, avg, price, longTerm });

describe("harvest", () => {
  it("lists only positions below cost, largest loss first, and ignores gains", () => {
    const r = harvest({ stcg: 0, ltcg: 0, positions: [pos("A", 10, 100, 90), pos("B", 10, 100, 150), pos("C", 5, 200, 100, true)] });
    expect(r.losses.map((l) => [l.symbol, l.loss])).toEqual([["C", 500], ["A", 100]]);
  });

  it("sets short-term losses against short-term gains first, then long-term gains", () => {
    // STCG 50k, LTCG 3L; ST loss 80k: 50k clears STCG, 30k cuts LTCG to 2.7L.
    const r = harvest({ stcg: 50_000, ltcg: 3 * LAKH, positions: [pos("A", 800, 200, 100)] });
    expect(r.after).toMatchObject({ stcg: 0, ltcg: 2.7 * LAKH });
    expect(r.carryForward).toEqual({ shortTerm: 0, longTerm: 0 });
  });

  it("uses long-term losses against long-term gains only, carrying the rest forward", () => {
    const r = harvest({ stcg: 1 * LAKH, ltcg: 20_000, positions: [pos("A", 500, 200, 100, true)] });
    expect(r.after).toMatchObject({ stcg: 1 * LAKH, ltcg: 0 });
    expect(r.carryForward).toEqual({ shortTerm: 0, longTerm: 30_000 });
  });

  it("taxes STCG at 20% and LTCG above ₹1.25 lakh at 12.5%, plus 4% cess, and reports the saving", () => {
    const r = harvest({ stcg: 1 * LAKH, ltcg: 2.25 * LAKH, positions: [pos("A", 1000, 150, 100)] });
    expect(r.before.tax).toBeCloseTo((1 * LAKH * 0.2 + 1 * LAKH * 0.125) * 1.04);
    // 50k ST loss clears half the STCG.
    expect(r.after.tax).toBeCloseTo((50_000 * 0.2 + 1 * LAKH * 0.125) * 1.04);
    expect(r.saved).toBeCloseTo(50_000 * 0.2 * 1.04);
  });

  it("saves nothing when long-term gains are already inside the exemption", () => {
    const r = harvest({ stcg: 0, ltcg: 1 * LAKH, positions: [pos("A", 100, 200, 100, true)] });
    expect(r.saved).toBe(0);
  });
});

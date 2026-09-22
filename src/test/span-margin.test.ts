import { describe, it, expect } from "vitest";
import { cleanExpiries, pickContracts, seriesFor, sortedStrikes, upstreamDate, validExpiry, validPositions, validQuery, validSymbol, MAX_LEGS, type Contract } from "../../supabase/functions/_shared/span-margin";

const c = (over: Partial<Contract>): Contract => ({
  ExchangeSegment: 2, ExchangeInstrumentID: 1, Name: "RELIANCE", DisplayName: "RELIANCE 27OCT2026", Series: "FUTSTK", LotSize: 500,
  ContractExpiration: "2026-10-27T14:30:00", ...over,
});

describe("span-margin contract search", () => {
  const universe = [
    c({ ExchangeInstrumentID: 5, DisplayName: "RELIANCE 27OCT2026 CE 1270", Series: "OPTSTK", StrikePrice: 1270 }),
    c({ ExchangeInstrumentID: 4, Name: "RELIANCEPP", DisplayName: "RELIANCEPP 27OCT2026" }),
    c({ ExchangeInstrumentID: 3, DisplayName: "RELIANCE 23NOV2026", ContractExpiration: "2026-11-23T14:30:00" }),
    c({ ExchangeInstrumentID: 2, DisplayName: "RELIANCE 29SEP27OCT SPD" }),
    c({ ExchangeInstrumentID: 1 }),
    c({ ExchangeInstrumentID: 9, ExchangeSegment: 12, DisplayName: "RELIANCE BSE" }),
  ];

  it("puts the underlying's nearest future first and drops spreads and other segments", () => {
    expect(pickContracts(universe, "reliance").map((x) => x.id)).toEqual([1, 3, 5, 4]);
  });

  it("filters on every word of the query", () => {
    expect(pickContracts(universe, "RELIANCE CE 1270").map((x) => x.id)).toEqual([5]);
    expect(pickContracts(universe, "RELIANCE 23NOV").map((x) => x.id)).toEqual([3]);
  });

  it("accepts symbols with & and -, and refuses anything else", () => {
    expect(validQuery("M&M")).toBe(true);
    expect(validQuery("BAJAJ-AUTO 27OCT")).toBe(true);
    expect(validQuery("x")).toBe(false);
    expect(validQuery("NIFTY'; DROP")).toBe(false);
    expect(validQuery(42)).toBe(false);
  });
});

describe("span-margin positions", () => {
  it("accepts MCX commodities", () => {
    expect(validPositions([{ exchange: "MCXFO", id: 584307, quantity: 1 }])).toEqual([{ exchange: "MCXFO", id: 584307, quantity: 1 }]);
  });

  it("accepts buys and sells on NSE F&O and currency", () => {
    expect(validPositions([{ exchange: "NSEFO", id: 48987, quantity: 500 }, { exchange: "NSECD", id: "7", quantity: -1000 }]))
      .toEqual([{ exchange: "NSEFO", id: 48987, quantity: 500 }, { exchange: "NSECD", id: 7, quantity: -1000 }]);
  });

  it("refuses anything that is not a nonzero whole position on an offered segment", () => {
    for (const bad of [[], [{ exchange: "BSEFO", id: 1, quantity: 1 }], [{ exchange: "NSEFO", id: 0, quantity: 1 }], [{ exchange: "NSEFO", id: 1, quantity: 0 }], [{ exchange: "NSEFO", id: 1, quantity: 1.5 }], "x"]) {
      expect(validPositions(bad)).toBeNull();
    }
    expect(validPositions(Array.from({ length: MAX_LEGS + 1 }, () => ({ exchange: "NSEFO", id: 1, quantity: 1 })))).toBeNull();
  });
});

describe("span-margin structured picker", () => {
  it("cleans the platform's expiry list", () => {
    const raw = ["2026-10-27T14:30:00", "2026-09-29T14:30:00", "2026-10-27T14:30:00", "2026-09-22T14:30:00", "2026-09-15T14:30:00", 5];
    expect(cleanExpiries(raw, "2026-09-22")).toEqual(["2026-09-22", "2026-09-29", "2026-10-27"]);
    expect(cleanExpiries({ error: 1 }, "2026-09-22")).toEqual([]);
  });

  it("sorts strikes numerically and drops junk", () => {
    expect(sortedStrikes([1760, 1130, "1300", 1130, -5, "x"])).toEqual([1130, 1300, 1760]);
  });

  it("formats dates and series the way the platform expects", () => {
    expect(upstreamDate("2026-10-27")).toBe("27Oct2026");
    expect(seriesFor("FUT", true)).toBe("FUTIDX");
    expect(seriesFor("CE", false)).toBe("OPTSTK");
  });

  it("validates symbols and dates", () => {
    expect(validSymbol("M&M")).toBe(true);
    expect(validSymbol("BAJAJ-AUTO")).toBe(true);
    expect(validSymbol("nifty")).toBe(false);
    expect(validSymbol("NIFTY 50")).toBe(false);
    expect(validExpiry("2026-10-27")).toBe(true);
    expect(validExpiry("27Oct2026")).toBe(false);
  });
});

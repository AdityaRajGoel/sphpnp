import { describe, it, expect } from "vitest";
import { pickContracts, validPositions, validQuery, MAX_LEGS, type Contract } from "../../supabase/functions/_shared/span-margin";

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

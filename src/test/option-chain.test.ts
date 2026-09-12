import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { aroundSpot, isAfterClose, maxPain, optionChainUrl, parseContractInfo, parseOptionChainV3, summariseChain, type OptionRow } from "../../supabase/functions/_shared/option-chain";

/*
 * NSE's v3 option chain for NIFTY (15-Sep-2026 expiry, 30 strikes around the
 * money) and its contract info, captured 2026-09-11. The v2 endpoints this
 * site called answer 404, which is why the F&O page was empty.
 */

const fixture = (name: string) => JSON.parse(readFileSync(`src/test/fixtures/nse-market/${name}.json`, "utf-8"));

describe("option chain urls", () => {
  it("asks for indices and equities by type, one expiry at a time", () => {
    expect(optionChainUrl("NIFTY", "15-Sep-2026")).toBe("https://www.nseindia.com/api/option-chain-v3?type=Indices&symbol=NIFTY&expiry=15-Sep-2026");
    expect(optionChainUrl("M&M", "29-Sep-2026")).toBe("https://www.nseindia.com/api/option-chain-v3?type=Equity&symbol=M%26M&expiry=29-Sep-2026");
  });
});

describe("parseContractInfo", () => {
  it("lists the expiries nearest first", () => {
    expect(parseContractInfo(fixture("option-chain-contract-info-nifty")).slice(0, 2)).toEqual(["15-Sep-2026", "22-Sep-2026"]);
  });
});

describe("parseOptionChainV3", () => {
  const chain = parseOptionChainV3(fixture("option-chain-v3-nifty"), "15-Sep-2026");

  it("reads every strike of the expiry with calls and puts side by side", () => {
    expect(chain.spot).toBe(23398.1);
    expect(chain.timestamp).toBe("11-Sep-2026 15:40:00");
    expect(chain.rows).toHaveLength(30);
    expect(chain.rows.map((r) => r.strike)).toEqual([...chain.rows.map((r) => r.strike)].sort((a, b) => a - b));
    expect(chain.rows.some((r) => r.callOI > 0 && r.putOI > 0)).toBe(true);
  });

  it("drops rows of another expiry", () => {
    expect(parseOptionChainV3(fixture("option-chain-v3-nifty"), "22-Sep-2026").rows).toEqual([]);
  });
});

describe("summariseChain", () => {
  const row = (strike: number, callOI: number, putOI: number): OptionRow => ({ strike, callOI, putOI, callChange: 0, callLTP: 0, callIV: 0, callVolume: 0, putChange: 0, putLTP: 0, putIV: 0, putVolume: 0 });

  it("finds max pain where writers pay least", () => {
    // Heavy puts at 100 and heavy calls at 120: settling at 110 costs least.
    expect(maxPain([row(100, 0, 1000), row(110, 10, 10), row(120, 1000, 0)])).toBe(110);
  });

  it("computes the put-call ratio and the OI walls", () => {
    expect(summariseChain([row(100, 50, 300), row(110, 200, 100)])).toMatchObject({ pcr: 400 / 250, callWall: 110, putWall: 100, totalCallOI: 250, totalPutOI: 400 });
    expect(summariseChain([]).pcr).toBeNull();
  });

  it("keeps the strikes nearest the price", () => {
    const rows = [100, 110, 120, 130, 140].map((s) => row(s, 1, 1));
    expect(aroundSpot(rows, 121, 1).map((r) => r.strike)).toEqual([110, 120, 130]);
  });
});

describe("isAfterClose", () => {
  it("accepts only a chain timestamped at or after the 15:30 close", () => {
    expect(isAfterClose("11-Sep-2026 15:40:00")).toBe(true);
    expect(isAfterClose("11-Sep-2026 15:30:00")).toBe(true);
    // The 09:30 IST run reads the market mid-session.
    expect(isAfterClose("11-Sep-2026 09:31:12")).toBe(false);
    expect(isAfterClose("11-Sep-2026 15:29:59")).toBe(false);
    expect(isAfterClose(null)).toBe(false);
    expect(isAfterClose("garbage")).toBe(false);
  });
});

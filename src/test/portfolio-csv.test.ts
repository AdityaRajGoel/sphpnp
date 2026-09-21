import { describe, it, expect } from "vitest";
import { cleanSymbol, parseHoldings } from "@/lib/portfolio-csv";

describe("parseHoldings", () => {
  it("reads a Zerodha holdings export", () => {
    const csv = 'Instrument,Qty.,Avg. cost,LTP,Cur. val,P&L,Net chg.,Day chg.\nRELIANCE,10,"1,250.50",1400,14000,1495,11.9,0.5\nINFY,5,1500,1600,8000,500,6.7,-0.2\n';
    expect(parseHoldings(csv)).toEqual({ holdings: [{ symbol: "RELIANCE", qty: 10, avg: 1250.5 }, { symbol: "INFY", qty: 5, avg: 1500 }], error: null });
  });

  it("skips a title line, cleans exchange prefixes and merges the same stock", () => {
    const csv = "Holdings statement for AB1234\nStock Symbol,Quantity,Average buy price\nNSE:TCS-EQ,2,3000\nTCS,2,4000\n";
    expect(parseHoldings(csv).holdings).toEqual([{ symbol: "TCS", qty: 4, avg: 3500 }]);
  });

  it("says what is missing instead of returning nothing", () => {
    expect(parseHoldings("name,value\nA,1").error).toMatch(/No symbol column/);
    expect(parseHoldings("symbol,price\nA,1").error).toMatch(/No quantity column/);
  });

  it("keeps M&M's ampersand", () => {
    expect(cleanSymbol("m&m-eq")).toBe("M&M");
  });
});

import { describe, it, expect } from "vitest";
import { nseDate, parseFiiDii } from "../../supabase/functions/_shared/fii-dii";

describe("nseDate", () => {
  it("converts NSE's day-month-year form and rejects anything else", () => {
    expect(nseDate("11-Sep-2026")).toBe("2026-09-11");
    expect(nseDate("1-Jan-2026")).toBe("2026-01-01");
    expect(nseDate("2026-09-11")).toBeNull();
  });
});

describe("parseFiiDii", () => {
  it("reads the response NSE returned on 11 Sep 2026", () => {
    const rows = parseFiiDii([
      { buyValue: "15109.58", category: "DII", date: "11-Sep-2026", netValue: "1968.17", sellValue: "13141.41" },
      { buyValue: "12616.89", category: "FII/FPI", date: "11-Sep-2026", netValue: "-930.9", sellValue: "13547.79" },
    ]);
    expect(rows).toEqual([
      { category: "DII", date: "2026-09-11", buy_cr: 15109.58, sell_cr: 13141.41, net_cr: 1968.17 },
      { category: "FII/FPI", date: "2026-09-11", buy_cr: 12616.89, sell_cr: 13547.79, net_cr: -930.9 },
    ]);
  });

  it("drops malformed rows instead of zero-filling them, and derives a missing net", () => {
    expect(parseFiiDii([{ category: "Retail", date: "11-Sep-2026", buyValue: "1", sellValue: "1" }])).toEqual([]);
    expect(parseFiiDii([{ category: "DII", date: "11-Sep-2026", buyValue: "abc", sellValue: "1" }])).toEqual([]);
    expect(parseFiiDii([{ category: "DII", date: "11-Sep-2026", buyValue: "1,200", sellValue: "1000" }])[0].net_cr).toBe(200);
    expect(parseFiiDii({ not: "an array" })).toEqual([]);
  });
});

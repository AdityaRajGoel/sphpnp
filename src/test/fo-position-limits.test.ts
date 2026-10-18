import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseCombineOi, parseOiSpurts } from "../../supabase/functions/_shared/market-files";

const fixture = (name: string) => readFileSync(`src/test/fixtures/nse-market/${name}`, "utf8");

describe("parseCombineOi", () => {
  const rows = parseCombineOi(fixture("combineoi_16102026.csv"));

  it("reads every F&O stock in NSE's combined OI file", () => {
    expect(rows).toHaveLength(11);
    expect(rows[0]).toMatchObject({ symbol: "AMBUJACEM", isin: "INE079A01024", name: "AMBUJA CEMENTS LTD", mwpl: 102300439, as_of: "2026-10-16" });
  });

  it("measures utilisation on future-equivalent OI, the figure the ban rule uses", () => {
    // 94,281,157 / 102,300,439 = 92.16% - in the ban (it entered above 95%) though raw OI exceeds MWPL.
    expect(rows[0].utilisation_pct).toBe(92.16);
    expect(rows[0].limit_next_day).toBe("No Fresh Positions");
    const abb = rows.find((r) => r.symbol === "ABB")!;
    expect(abb.utilisation_pct).toBe(23.31);
    expect(abb.limit_next_day).toBe("5697144");
  });

  it("returns nothing for a file without the header", () => {
    expect(parseCombineOi("<!DOCTYPE html><html>Resource not found</html>")).toEqual([]);
  });
});

describe("parseOiSpurts", () => {
  const rows = parseOiSpurts(JSON.parse(fixture("oi-spurts-underlyings.json")));

  it("reads OI changes by underlying with NSE's trade date", () => {
    expect(rows).toHaveLength(5);
    expect(rows[0]).toMatchObject({ symbol: "UJJIVANSFB", latest_oi: 13022, prev_oi: 10170, change_oi: 2852, change_pct: 28.04, underlying: 63, trade_date: "2026-10-16" });
  });

  it("keeps falling open interest as a negative change", () => {
    expect(rows.slice(3).every((r) => r.change_oi < 0 && (r.change_pct ?? 0) < 0)).toBe(true);
  });

  it("returns nothing without a trade date", () => {
    expect(parseOiSpurts({ data: [{ symbol: "X", latestOI: 1, prevOI: 1 }] })).toEqual([]);
  });
});

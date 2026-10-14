import { describe, it, expect } from "vitest";
import { currentStocks, liteStock, withLite, type ScreenerStock } from "@/hooks/useScreenerStocks";

const stock = (symbol: string, price: number, updated_at: string): ScreenerStock => ({
  symbol, name: symbol, sector: "General", price, change: 0, change_pct: 0, market_cap: 1, pe: 0, high_52: 0, low_52: 0,
  volume: 0, day_high: 0, day_low: 0, open_price: 0, prev_close: 0, updated_at,
});

describe("currentStocks", () => {
  it("drops a stock with no price and one whose quote has stopped updating", () => {
    const list = currentStocks([
      stock("RELIANCE", 1257, "2026-09-11T17:28:00Z"),
      stock("NSDL", 0, "2026-08-03T13:00:00Z"), // never priced
      stock("TATAMETALI", 1110.55, "2026-08-20T10:00:00Z"), // quote stopped weeks before the rest
      stock("ITC", 410, "2026-09-09T17:28:00Z"),
    ]);
    expect(list.map((s) => s.symbol)).toEqual(["RELIANCE", "ITC"]);
  });

  it("keeps everything when the whole refresh has stalled, rather than emptying the screener", () => {
    const list = currentStocks([stock("RELIANCE", 1257, "2026-07-01T10:00:00Z"), stock("ITC", 410, "2026-06-30T10:00:00Z")]);
    expect(list).toHaveLength(2);
  });
});

describe("end-of-day rows outside the live universe", () => {
  const lite = liteStock({
    symbol: "SBIFUNDS", name: "SBI Funds Management", close: 519.6, prev_close: 519.55, change_pct: 0.01,
    volume: 702693, high_52: 624.95, low_52: 494, market_cap_cr: 105833.17, pe: 34.19, trade_date: "2026-10-14",
  });

  it("maps a lite quote onto a screener row at that day's close", () => {
    expect(lite).toMatchObject({ symbol: "SBIFUNDS", price: 519.6, market_cap: 105833.17, pe: 34.19, eod: true, updated_at: "2026-10-14T10:00:00Z" });
    expect(lite.change).toBeCloseTo(0.05);
  });

  it("appends lite rows after the live ones and never duplicates a live symbol", () => {
    const live = { ...lite, symbol: "TCS", eod: undefined };
    const merged = withLite([live], [lite, { ...lite, symbol: "TCS" }]);
    expect(merged.map((s) => s.symbol)).toEqual(["TCS", "SBIFUNDS"]);
    expect(merged[0].eod).toBeUndefined();
  });
});

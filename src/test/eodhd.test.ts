import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { DAILY_BUDGET, GLOBAL_TICKERS, eodUrl, parseEodhdEod } from "../../supabase/functions/_shared/eodhd";

/* EODHD end-of-day responses on the free plan, captured 2026-09-11. */

const fixture = (name: string) => JSON.parse(readFileSync(`src/test/fixtures/eodhd/${name}.json`, "utf-8"));

describe("parseEodhdEod", () => {
  it("reads daily bars oldest first", () => {
    const bars = parseEodhdEod(fixture("gspc-indx"), "GSPC.INDX");
    expect(bars.length).toBeGreaterThan(5);
    expect(bars[0]).toMatchObject({ ticker: "GSPC.INDX", trade_date: "2026-08-25", open: 7676.66, close: 7677.2779 });
    expect(bars.map((b) => b.trade_date)).toEqual([...bars.map((b) => b.trade_date)].sort());
  });

  it("keeps a currency's zero volume and drops bars without a close", () => {
    expect(parseEodhdEod(fixture("usdinr-forex"), "USDINR.FOREX")[0]).toMatchObject({ close: 95.4175, volume: 0 });
    expect(parseEodhdEod([{ date: "2026-09-01", close: null }, { date: "bad", close: 1 }], "X")).toEqual([]);
    expect(parseEodhdEod("Ticker Not Found.", "X")).toEqual([]);
  });
});

describe("the free-plan budget", () => {
  it("fits the daily ticker list under the budget, which stays under the plan's 20 calls", () => {
    expect(GLOBAL_TICKERS.length).toBeLessThanOrEqual(DAILY_BUDGET);
    expect(DAILY_BUDGET).toBeLessThan(20);
    expect(new Set(GLOBAL_TICKERS.map((t) => t.ticker)).size).toBe(GLOBAL_TICKERS.length);
  });

  it("builds one request per ticker", () => {
    expect(eodUrl("BTC-USD.CC", "k", "2026-09-01")).toBe("https://eodhd.com/api/eod/BTC-USD.CC?api_token=k&fmt=json&from=2026-09-01");
  });
});

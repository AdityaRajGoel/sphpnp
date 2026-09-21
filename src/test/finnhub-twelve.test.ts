import { describe, it, expect } from "vitest";
import { parseFinnhubNews } from "../../supabase/functions/_shared/finnhub";
import { parseTwelveDataSeries, twelveDataUrl } from "../../supabase/functions/_shared/twelve-data";
import { GLOBAL_TICKERS } from "../../supabase/functions/_shared/eodhd";

/* Shapes from the providers' docs (finnhub.io/docs/api/market-news, twelvedata.com/docs#time-series). */

describe("parseFinnhubNews", () => {
  const now = Date.parse("2026-09-21T12:00:00Z");
  const at = (iso: string) => Date.parse(iso) / 1000;

  it("maps a story to the feed's item, crediting the publisher", () => {
    const [item] = parseFinnhubNews([{
      category: "top news", datetime: at("2026-09-21T09:30:00Z"), headline: " Fed holds rates ", id: 1,
      image: "", related: "", source: "Reuters", summary: "The Fed kept rates on hold.", url: "https://www.reuters.com/x",
    }], now);
    expect(item).toEqual({
      title: "Fed holds rates", summary: "The Fed kept rates on hold.", category: "Global", timeAgo: "2h ago",
      timestamp: "2026-09-21T09:30:00.000Z", source: "Reuters", url: "https://www.reuters.com/x",
    });
  });

  it("drops stories without a headline, an http link or a time, and falls back to the headline for summary", () => {
    const ok = { datetime: at("2026-09-21T11:50:00Z"), headline: "H", url: "https://a.b/c", summary: "" };
    const items = parseFinnhubNews([ok, { ...ok, headline: "" }, { ...ok, url: "javascript:alert(1)" }, { ...ok, datetime: 0 }], now);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ summary: "H", timeAgo: "10m ago", source: "Finnhub" });
    expect(parseFinnhubNews({ error: "API limit reached" })).toEqual([]);
  });
});

describe("parseTwelveDataSeries", () => {
  it("turns newest-first string values into oldest-first numeric bars", () => {
    const bars = parseTwelveDataSeries({
      meta: { symbol: "USD/INR", interval: "1day" }, status: "ok",
      values: [
        { datetime: "2026-09-19", open: "95.1", high: "95.6", low: "95.0", close: "95.42" },
        { datetime: "2026-09-18", open: "95.0", high: "95.3", low: "94.8", close: "95.10", volume: "" },
        { datetime: "2026-09-17", close: "n/a" },
      ],
    }, "USDINR.FOREX");
    expect(bars).toEqual([
      { ticker: "USDINR.FOREX", trade_date: "2026-09-18", open: 95, high: 95.3, low: 94.8, close: 95.1, volume: null },
      { ticker: "USDINR.FOREX", trade_date: "2026-09-19", open: 95.1, high: 95.6, low: 95, close: 95.42, volume: null },
    ]);
  });

  it("reads an error body as no bars", () => {
    expect(parseTwelveDataSeries({ code: 429, message: "You have run out of API credits", status: "error" }, "X")).toEqual([]);
  });

  it("asks for daily bars, and is mapped only where Yahoo is the primary", () => {
    expect(twelveDataUrl("USD/INR", "k", 20)).toBe("https://api.twelvedata.com/time_series?symbol=USD%2FINR&interval=1day&outputsize=20&apikey=k");
    for (const t of GLOBAL_TICKERS.filter((x) => x.twelve)) expect(t.yahoo).toBeTruthy();
  });
});

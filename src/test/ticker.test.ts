import { describe, it, expect } from "vitest";
import {
  ipoItems, moverItems, newsItems, exDateItems, announcementItems, interleave, symbolResolver, globalItems,
  type TickerIpo, type TickerItem,
} from "../../supabase/functions/_shared/ticker";

/*
 * The site-wide live-updates ticker. Each line must be true today: an IPO's
 * status is re-derived from its dates (an issue that closed overnight never
 * reads "open"), movers come only from large companies, and a filing or
 * ex-date links to the stock's page when the company is one we track.
 */

const TODAY = "2026-09-11";
const ipo = (over: Partial<TickerIpo>): TickerIpo => ({
  slug: "x", name: "X Limited", status: "upcoming", open_date: null, close_date: null, listing_date: null,
  price_band_min: null, price_band_max: null, subscription_total: null, listing_gain_pct: null, ...over,
});

describe("ipoItems", () => {
  it("announces an open issue with its close date, band, GMP % and subscription", () => {
    const [item] = ipoItems([ipo({ slug: "rentomojo", name: "Rentomojo IPO", status: "upcoming", open_date: "2026-09-09", close_date: "2026-09-12", price_band_min: 95, price_band_max: 100, subscription_total: 4.712 })],
      new Map([["rentomojo", 18]]), TODAY);
    expect(item).toMatchObject({ kind: "ipo", tag: "IPO OPEN", href: "/ipo/rentomojo", tone: "up" });
    expect(item.text).toBe("Rentomojo IPO open · closes 12 Sept · ₹95-100 · GMP ₹18 (+18.0%) · subscribed 4.71x");
  });

  it("re-derives status from dates: a stale 'open' label past close reads as listing", () => {
    const [item] = ipoItems([ipo({ status: "open", open_date: "2026-09-05", close_date: "2026-09-09", listing_date: "2026-09-14" })], new Map(), TODAY);
    expect(item.tag).toBe("LISTING");
    expect(item.text).toContain("lists 14 Sept");
  });

  it("orders open issues ahead of listings, upcoming and recent listings, and drops the rest", () => {
    const items = ipoItems([
      ipo({ slug: "old", name: "Old", listing_date: "2026-07-01", listing_gain_pct: 5, status: "listed" }),
      ipo({ slug: "later", name: "Later", open_date: "2026-10-30" }),
      ipo({ slug: "soon", name: "Soon", open_date: "2026-09-15" }),
      ipo({ slug: "fresh", name: "Fresh", status: "listed", listing_date: "2026-09-10", listing_gain_pct: -4.2 }),
      ipo({ slug: "live", name: "Live", open_date: "2026-09-10", close_date: "2026-09-12" }),
    ], new Map(), TODAY);
    expect(items.map((i) => i.href)).toEqual(["/ipo/live", "/ipo/soon", "/ipo/fresh"]);
    expect(items[2]).toMatchObject({ tag: "LISTED", tone: "down", text: "Fresh listed -4.2% over issue price" });
  });
});

describe("moverItems", () => {
  it("takes the three biggest gainers and losers among large companies only", () => {
    const stocks = [
      { symbol: "A", price: 100, change_pct: 5, market_cap: 50000 },
      { symbol: "B", price: 100, change_pct: 9, market_cap: 5000 },
      { symbol: "C", price: 100, change_pct: 2, market_cap: 90000 },
      { symbol: "D", price: 100, change_pct: -3, market_cap: 30000 },
      { symbol: "E", price: 100, change_pct: 0, market_cap: 30000 },
    ];
    const items = moverItems(stocks);
    expect(items.map((i) => `${i.tag}:${i.href}`)).toEqual(["TOP GAINER:/stock/A", "TOP GAINER:/stock/C", "TOP LOSER:/stock/D"]);
    expect(items[0].text).toBe("A ₹100 +5.0%");
  });

  it("leaves out a stock whose quote stopped updating, however big its last move", () => {
    const items = moverItems([
      { symbol: "LIVE", price: 100, change_pct: 2, market_cap: 50000, updated_at: "2026-09-11T10:00:00Z" },
      { symbol: "DELISTED", price: 1110, change_pct: 12, market_cap: 50000, updated_at: "2026-08-01T10:00:00Z" },
    ]);
    expect(items.map((i) => i.href)).toEqual(["/stock/LIVE"]);
  });
});

describe("newsItems", () => {
  it("credits the publisher and opens the story off-site", () => {
    const [item] = newsItems([{ title: "Sensex ends higher", source: "Mint", url: "https://news.google.com/a", published_at: "2026-09-11T08:00:00Z" }]);
    expect(item).toEqual({ kind: "news", tag: "NEWS · Mint", text: "Sensex ends higher", href: "https://news.google.com/a", tone: "neutral", external: true });
  });
});

describe("symbolResolver", () => {
  const symbolOf = symbolResolver([
    { symbol: "INFY", name: "Infosys" },
    { symbol: "M&MFIN", name: "Mahindra & Mahindra Financial" },
    { symbol: "ITC", name: "ITC" },
  ]);

  it("matches NSE's filing name to a tracked symbol", () => {
    expect(symbolOf("Infosys Limited")).toBe("INFY");
    expect(symbolOf("Mahindra & Mahindra Financial Services Limited")).toBe("M&MFIN");
  });

  it("does not stretch a short name over a different company", () => {
    expect(symbolOf("ITC Hotels Limited")).toBeNull();
    expect(symbolOf("Infosys BPM Limited")).toBeNull();
  });
});

describe("exDateItems", () => {
  const symbolOf = symbolResolver([{ symbol: "IREDA", name: "Indian Renewable Energy Development Agency" }]);

  it("lists ex-dates in the next ten days, tracked companies first on the same day", () => {
    const items = exDateItems([
      { company: "Indo Thai Securities Limited", purpose: "DIVIDEND - RE 0.10 PER SHARE", ex_date: TODAY },
      { company: "Indian Renewable Energy Development Agency Limited", purpose: "DIVIDEND - RE 0.75 PER SHARE", ex_date: TODAY },
      { company: "Past Limited", purpose: "BONUS", ex_date: "2026-09-01" },
      { company: "Far Limited", purpose: "SPLIT", ex_date: "2026-12-01" },
    ], symbolOf, TODAY);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ tag: "EX-DATE TODAY", href: "/stock/IREDA", text: "Indian Renewable Energy Development Agency: DIVIDEND - RE 0.75 PER SHARE" });
    expect(items[1].href).toBeNull();
  });
});

describe("announcementItems", () => {
  it("keeps material filings and drops routine updates", () => {
    const items = announcementItems([
      { company: "Coforge Limited", subject: "General Updates", attachment_url: "https://nsearchives.nseindia.com/a.pdf", published_at: null },
      { company: "CESC Limited", subject: "Outcome of Board Meeting", attachment_url: "https://nsearchives.nseindia.com/b.pdf", published_at: null },
      { company: "X Limited", subject: "Financial Results", attachment_url: "javascript:alert(1)", published_at: null },
      { company: "Ratnaveer Limited", subject: "Alteration Of Capital and Fund Raising-XBRL", attachment_url: "https://nsearchives.nseindia.com/c.xml", published_at: null },
    ], () => null);
    expect(items.map((i) => i.text)).toEqual(["CESC: Outcome of Board Meeting", "Ratnaveer: Alteration Of Capital and Fund Raising"]);
    expect(items[0]).toMatchObject({ tag: "NSE FILING", href: "https://nsearchives.nseindia.com/b.pdf", external: true });
  });
});

describe("interleave", () => {
  it("takes one from each group in turn", () => {
    const line = (text: string): TickerItem => ({ kind: "news", tag: "", text, href: null, tone: "neutral", external: false });
    expect(interleave([[line("a1"), line("a2"), line("a3")], [line("b1")], [], [line("c1"), line("c2")]]).map((i) => i.text))
      .toEqual(["a1", "b1", "c1", "a2", "c2", "a3"]);
  });
});

describe("ipoItems - closing today", () => {
  it("says an issue closes today rather than giving today's date", () => {
    const [item] = ipoItems([ipo({ name: "Steamhouse India", open_date: "2026-09-09", close_date: TODAY })], new Map(), TODAY);
    expect(item.text).toBe("Steamhouse India IPO open · closes today");
  });
});

describe("globalItems", () => {
  it("writes each market's close and day change, linking to Market Pulse", () => {
    const items = globalItems([
      { ticker: "GSPC.INDX", name: "S&P 500", trade_date: "2026-09-09", close: 7600 },
      { ticker: "GSPC.INDX", name: "S&P 500", trade_date: "2026-09-10", close: 7676 },
      { ticker: "BTC-USD.CC", name: "Bitcoin", trade_date: "2026-09-10", close: 80000 },
    ]);
    expect(items).toEqual([{ kind: "global", tag: "GLOBAL", text: "S&P 500 7,676 +1.0%", href: "/market-pulse#global", tone: "up", external: false }]);
  });
});

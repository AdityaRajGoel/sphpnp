import { describe, it, expect } from "vitest";
import { listingPerformance, performanceBySlug, type EodBar } from "../../supabase/functions/_shared/ipo-listing";

const link = { symbol: "DEEPA", ipo_slug: "deepa-jewellers", issue_price: 177, listing_date: "2026-09-08" };
const bars: EodBar[] = [
  { symbol: "DEEPA", trade_date: "2026-09-11", open: 210, close: 215 },
  { symbol: "DEEPA", trade_date: "2026-09-08", open: 200, close: 190 },
  { symbol: "DEEPA", trade_date: "2026-09-09", open: 191, close: 205 },
  { symbol: "OTHER", trade_date: "2026-09-08", open: 50, close: 50 },
];

describe("listingPerformance", () => {
  it("takes the listing-day open as the listing price and the newest close as the price today", () => {
    const p = listingPerformance(link, bars)!;
    expect(p.listing_price).toBe(200);
    expect(p.listing_gain_pct).toBeCloseTo((200 / 177 - 1) * 100, 10);
    expect(p.listing_day_close).toBe(190);
    expect(p.latest_close).toBe(215);
    expect(p.latest_close_date).toBe("2026-09-11");
    expect(p.gain_since_issue_pct).toBeCloseTo((215 / 177 - 1) * 100, 10);
  });

  it("refuses without an issue price, a listing bar, or when the first bar is a later session", () => {
    expect(listingPerformance({ ...link, issue_price: null }, bars)).toBeNull();
    expect(listingPerformance({ ...link, symbol: "NONE" }, bars)).toBeNull();
    expect(listingPerformance({ ...link, listing_date: "2026-08-20" }, bars)).toBeNull();
  });
});

describe("performanceBySlug", () => {
  it("keys by catalogue slug and skips unlinked filings", () => {
    const map = performanceBySlug([link, { symbol: "805TACA29", ipo_slug: null, issue_price: null, listing_date: "2026-09-10" }], bars);
    expect([...map.keys()]).toEqual(["deepa-jewellers"]);
  });
});

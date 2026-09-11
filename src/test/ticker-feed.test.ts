import { describe, it, expect, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { withPromos, tickerHref, PROMOS, type TickerItem } from "@/lib/ticker-feed";

const live = (n: number): TickerItem[] =>
  Array.from({ length: n }, (_, i) => ({ kind: "news", tag: "NEWS", text: `n${i}`, href: null, tone: "neutral", external: true }));

describe("withPromos", () => {
  it("weaves a house line after every five live ones, cycling the list", () => {
    const out = withPromos(live(10));
    expect(out).toHaveLength(12);
    expect(out[5]).toBe(PROMOS[0]);
    expect(out[11]).toBe(PROMOS[1]);
  });

  it("still carries one promo on a short feed, and only promos on an empty one", () => {
    expect(withPromos(live(2)).map((i) => i.kind)).toEqual(["news", "news", "promo"]);
    expect(withPromos([])).toBe(PROMOS);
  });
});

describe("tickerHref", () => {
  it("opens site paths and https links only", () => {
    expect(tickerHref("/ipo/nse")).toBe("/ipo/nse");
    expect(tickerHref("https://nsearchives.nseindia.com/a.pdf")).toBe("https://nsearchives.nseindia.com/a.pdf");
    expect(tickerHref("//evil.example")).toBeNull();
    expect(tickerHref("javascript:alert(1)")).toBeNull();
    expect(tickerHref(null)).toBeNull();
  });
});

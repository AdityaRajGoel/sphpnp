import { describe, it, expect } from "vitest";
import { MAX_WATCHLIST, parseWatchlist } from "@/hooks/useWatchlist";

describe("parseWatchlist", () => {
  it("keeps well-formed items and normalises symbols", () => {
    expect(parseWatchlist(JSON.stringify([{ symbol: "tcs", name: "Tata Consultancy", addedAt: 5 }]))).toEqual([
      { symbol: "TCS", name: "Tata Consultancy", addedAt: 5 },
    ]);
  });

  it("drops malformed, hostile and duplicate entries", () => {
    const raw = JSON.stringify([
      null, 42, "TCS", { name: "no symbol" }, { symbol: "<img src=x onerror=alert(1)>" },
      { symbol: "../../etc" }, { symbol: "INFY" }, { symbol: "infy", name: "dupe" }, { symbol: "M&M", addedAt: "yesterday" },
    ]);
    expect(parseWatchlist(raw)).toEqual([
      { symbol: "INFY", name: "INFY", addedAt: 0 },
      { symbol: "M&M", name: "M&M", addedAt: 0 },
    ]);
  });

  it("survives broken JSON, non-arrays and oversized lists", () => {
    expect(parseWatchlist("{not json")).toEqual([]);
    expect(parseWatchlist(JSON.stringify({ symbol: "TCS" }))).toEqual([]);
    expect(parseWatchlist(null)).toEqual([]);
    const many = Array.from({ length: 80 }, (_, i) => ({ symbol: `S${i}` }));
    expect(parseWatchlist(JSON.stringify(many))).toHaveLength(MAX_WATCHLIST);
  });
});

import { describe, it, expect } from "vitest";
import {
  buildStockRow,
  groupRowsByShape,
  hasUsableMarketCap,
  type YahooQuoteLike,
} from "../../supabase/functions/_shared/screener-row";

const stock = { symbol: "MCDOWELL-N", name: "United Spirits", sector: "FMCG" };

// A quote with every field Yahoo normally returns for a live NSE equity.
const FULL_QUOTE: YahooQuoteLike = {
  regularMarketPrice: 1500,
  regularMarketChange: -12.5,
  regularMarketChangePercent: -0.83,
  trailingPE: 65.2,
  fiftyTwoWeekHigh: 1700,
  fiftyTwoWeekLow: 1100,
  regularMarketVolume: 123456,
  regularMarketDayHigh: 1520,
  regularMarketDayLow: 1490,
  regularMarketOpen: 1510,
  regularMarketPreviousClose: 1512.5,
  marketCap: 145000000000,
};

describe("buildStockRow", () => {
  it("carries every field through when Yahoo returns a complete quote", () => {
    const row = buildStockRow(stock, FULL_QUOTE);
    expect(row.price).toBe(1500);
    expect(row.change).toBe(-12.5);
    expect(row.change_pct).toBe(-0.83);
    expect(row.pe).toBe(65.2);
    expect(row.high_52).toBe(1700);
    expect(row.low_52).toBe(1100);
    expect(row.volume).toBe(123456);
    expect(row.day_high).toBe(1520);
    expect(row.day_low).toBe(1490);
    expect(row.open_price).toBe(1510);
    expect(row.prev_close).toBe(1512.5);
    expect(row.market_cap).toBe(14500); // crores
  });

  // THE DEFECT (MCDOWELL/ZOMATO): Yahoo's v7 quote occasionally comes back
  // missing sub-fields for an otherwise-live symbol. `?? 0` on each field
  // turned "Yahoo didn't tell us" into "the value is zero", which then
  // overwrote a real stored price/PE/day-range with 0 on the next upsert -
  // the page renders "-" for a stock that was trading fine.
  it("omits price rather than writing 0 when Yahoo's quote has no price field", () => {
    const row = buildStockRow(stock, { ...FULL_QUOTE, regularMarketPrice: undefined });
    expect(row).not.toHaveProperty("price");
  });

  it("omits pe rather than writing 0 when neither trailingPE nor forwardPE is usable", () => {
    const row = buildStockRow(stock, { ...FULL_QUOTE, trailingPE: undefined });
    expect(row).not.toHaveProperty("pe");
  });

  it("falls back from trailingPE to forwardPE when trailingPE is unusable", () => {
    const row = buildStockRow(stock, { ...FULL_QUOTE, trailingPE: undefined, forwardPE: 22.1 });
    expect(row.pe).toBe(22.1);
  });

  it("omits high_52/low_52/day_high/day_low/volume/prev_close individually when each is missing", () => {
    const fields = [
      "fiftyTwoWeekHigh",
      "fiftyTwoWeekLow",
      "regularMarketVolume",
      "regularMarketDayHigh",
      "regularMarketDayLow",
      "regularMarketPreviousClose",
    ] as const;
    const columns = ["high_52", "low_52", "volume", "day_high", "day_low", "prev_close"] as const;

    fields.forEach((field, i) => {
      const row = buildStockRow(stock, { ...FULL_QUOTE, [field]: undefined });
      expect(row).not.toHaveProperty(columns[i]);
      // Every OTHER column must still be present - one missing field must
      // not blank the whole row.
      expect(row).toHaveProperty("price");
    });
  });

  // fetch-screener-data's own v8 chart fallback explicitly uses 0 as its
  // "Yahoo gave us nothing here" sentinel (see regularMarketPrice ?? 0,
  // trailingPE: 0, etc. in that fallback). A quote reporting a real 0 is
  // therefore indistinguishable from "no data" for these fields - treat it
  // the same way hasUsableMarketCap already treats a zero/negative
  // marketCap: present but not usable.
  it("treats an explicit 0 the same as a missing field for price/pe/day-range columns", () => {
    const row = buildStockRow(stock, {
      ...FULL_QUOTE,
      regularMarketPrice: 0,
      trailingPE: 0,
      forwardPE: 0,
      fiftyTwoWeekHigh: 0,
      volume: 0,
      regularMarketVolume: 0,
    });
    expect(row).not.toHaveProperty("price");
    expect(row).not.toHaveProperty("pe");
    expect(row).not.toHaveProperty("high_52");
    expect(row).not.toHaveProperty("volume");
  });

  it("keeps a real negative change and change_pct (the stock traded down)", () => {
    const row = buildStockRow(stock, FULL_QUOTE);
    expect(row.change).toBe(-12.5);
    expect(row.change_pct).toBe(-0.83);
  });

  it("keeps a real negative PE (loss-making company) rather than discarding it", () => {
    const row = buildStockRow(stock, { ...FULL_QUOTE, trailingPE: -8.4 });
    expect(row.pe).toBe(-8.4);
  });

  it("omits change/change_pct when Yahoo's quote has no usable figure, without touching price", () => {
    const row = buildStockRow(stock, { ...FULL_QUOTE, regularMarketChange: undefined, regularMarketChangePercent: undefined });
    expect(row).not.toHaveProperty("change");
    expect(row).not.toHaveProperty("change_pct");
    expect(row.price).toBe(1500);
  });

  it("still omits market_cap via the pre-existing hasUsableMarketCap rule", () => {
    const row = buildStockRow(stock, { ...FULL_QUOTE, marketCap: undefined });
    expect(row).not.toHaveProperty("market_cap");
    expect(hasUsableMarketCap({ marketCap: undefined })).toBe(false);
  });
});

describe("groupRowsByShape", () => {
  it("puts rows with identical key sets in the same group", () => {
    const a = buildStockRow(stock, FULL_QUOTE);
    const b = buildStockRow({ ...stock, symbol: "OTHER" }, FULL_QUOTE);
    const groups = groupRowsByShape([a, b]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(2);
  });

  // The exact scenario this function exists to prevent: a batch upsert that
  // silently NULLs out a column present on some rows but not others.
  it("separates rows that omit a column from rows that carry it", () => {
    const complete = buildStockRow(stock, FULL_QUOTE);
    const partial = buildStockRow(
      { ...stock, symbol: "ZOMATO" },
      { ...FULL_QUOTE, regularMarketPrice: undefined },
    );
    const groups = groupRowsByShape([complete, partial]);
    expect(groups).toHaveLength(2);
    const sizes = groups.map((g) => g.length).sort();
    expect(sizes).toEqual([1, 1]);
  });
});

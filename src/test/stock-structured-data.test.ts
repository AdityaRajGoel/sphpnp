import { describe, it, expect } from "vitest";
import { stockDataset, stockFaqItems } from "@/lib/stock-structured-data";
import type { StockHeader } from "@/hooks/useStockFundamentals";

const header: StockHeader = {
  symbol: "RELIANCE", name: "Reliance Industries", sector: "Energy",
  price: 1244.9, change_pct: 0.08, market_cap: 1671666, updated_at: "2026-09-18T10:00:00Z",
  pe: 22.49, high_52: 1592.3, low_52: 1235.3, day_high: 1250, day_low: 1240, volume: 100, open_price: 1242, prev_close: 1243.9,
};

describe("stockFaqItems", () => {
  it("answers from the figures the page shows, each with its as-of date", () => {
    const items = stockFaqItems(header);
    const price = items.find((i) => i.question.includes("share price"))!;
    expect(price.answer).toContain("₹1,244.90");
    expect(price.answer).toMatch(/18 Sept? 2026/);
    expect(items.find((i) => i.question.includes("P/E"))!.answer).toContain("22.49");
    expect(items.find((i) => i.question.includes("market capitalisation"))!.answer).toContain("₹16.72 lakh crore");
  });

  it("asks nothing it cannot answer", () => {
    // A question about a P/E we do not have would either state a number nobody
    // measured or answer "not available"; neither belongs in quoted markup.
    const sparse = stockFaqItems({ ...header, pe: null, market_cap: null, high_52: null, low_52: null });
    expect(sparse.some((i) => i.question.includes("P/E"))).toBe(false);
    expect(sparse.some((i) => i.question.includes("52-week"))).toBe(false);
    expect(sparse.some((i) => i.question.includes("share price"))).toBe(true);
  });

  it("returns nothing at all without a header", () => {
    expect(stockFaqItems(null)).toEqual([]);
  });
});

describe("stockDataset", () => {
  it("describes the series, not a single number", () => {
    const ds = stockDataset(header)!;
    expect(ds["@type"]).toBe("Dataset");
    expect(ds.url).toBe("https://www.sphpnp.com/stock/RELIANCE");
    expect(ds.dateModified).toBe("2026-09-18");
    expect(ds.variableMeasured).toContain("Price to earnings ratio");
  });

  it("lists only the measures the page carries", () => {
    const ds = stockDataset({ ...header, pe: null, market_cap: null })!;
    expect(ds.variableMeasured).not.toContain("Price to earnings ratio");
    expect(ds.variableMeasured).not.toContain("Market capitalisation");
  });
});

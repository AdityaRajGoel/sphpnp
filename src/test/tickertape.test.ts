import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { nameSlug, nextData, parseTickertape, pickTickertapeStock, sitemapCandidates } from "../../supabase/functions/_shared/tickertape";

/*
 * Tickertape's RELIANCE page (its embedded render data, trimmed) and a search
 * for "M&M", captured 2026-09-11.
 */

const page = nextData(readFileSync("src/test/fixtures/tickertape/reli.html", "utf-8"))!;
const stock = parseTickertape(page)!;

describe("pickTickertapeStock", () => {
  it("takes the stock listed under exactly this ticker", () => {
    const search = JSON.parse(readFileSync("src/test/fixtures/tickertape/search-mm.json", "utf-8"));
    expect(pickTickertapeStock(search, "M&M")?.sid).toBe("MAHM");
    expect(pickTickertapeStock(search, "M&MFIN")?.sid).toBe("MMFS");
    expect(pickTickertapeStock(search, "NOPE")).toBeNull();
  });
});

describe("parseTickertape", () => {
  it("reads analyst coverage and the page link", () => {
    expect(stock).toMatchObject({ sid: "RELI", ticker: "RELIANCE", analysts: { total: 25, buy_pct: 100 }, url: "https://www.tickertape.in/stocks/reliance-industries-RELI" });
  });

  it("reads the holding split with mutual funds and insurers out of DII, oldest first", () => {
    expect(stock.holdings).toHaveLength(6);
    expect(stock.holdings[0]).toMatchObject({ date: "2025-03-31", promoter: 50.11, fii: 19.06, dii: 19.46, mutual_funds: 9.21, insurance: 8.99, other_dii: 1.25, retail: 7.4, others: 3.98 });
    const h = stock.holdings[0];
    expect(h.promoter! + h.fii! + h.dii! + h.retail! + h.others!).toBeCloseTo(100, 0);
  });

  it("reads the funds holding the most of the company", () => {
    expect(stock.top_funds[0]).toMatchObject({ name: "ICICI Pru Large Cap Fund", pct_of_company: 0.252, weight_in_fund: 5.59, url: "https://www.tickertape.in/mutualfunds/icici-pru-large-cap-fund-M_ICCBH" });
  });

  it("reads the scorecard tags and sector valuation", () => {
    expect(stock.scorecard.map((s) => `${s.name}:${s.tag}`)).toEqual(["Performance:Low", "Valuation:High", "Growth:Low", "Profitability:High", "Entry point:Good", "Red flags:Low"]);
    expect(stock.scorecard[1].tone).toBe("bad");
    expect(stock.sector.pe).toBeCloseTo(12.16, 2);
    expect(stock.beta).toBeCloseTo(1.02, 2);
  });

  it("has nothing to read from a page without render data", () => {
    expect(nextData("<html></html>")).toBeNull();
  });
});

/*
 * Tickertape's search API answers 403 from Supabase's servers (2026-09-11),
 * so a stock not in the resolved list is found through the stocks sitemap by
 * name, and confirmed by the ticker on the page itself.
 */
describe("sitemapCandidates", () => {
  const xml = readFileSync("src/test/fixtures/tickertape/stocks-sitemap.xml", "utf-8");

  it("slugs names the way Tickertape does", () => {
    expect(nameSlug("Mahindra & Mahindra Ltd")).toBe("mahindra-and-mahindra");
    expect(nameSlug("ITC HOTELS LIMITED")).toBe("itc-hotels");
  });

  it("puts the exact name first, then the shortest longer name", () => {
    expect(sitemapCandidates(xml, "Mahindra & Mahindra")[0]).toBe("/stocks/mahindra-and-mahindra-MAHM");
    expect(sitemapCandidates(xml, "Mahindra & Mahindra Financial")).toEqual(["/stocks/mahindra-and-mahindra-financial-services-MMFS"]);
    expect(sitemapCandidates(xml, "Larsen & Toubro")[0]).toBe("/stocks/larsen-and-toubro-LART");
  });

  it("finds nothing for a renamed company rather than guessing", () => {
    expect(sitemapCandidates(xml, "Eternal")).toEqual([]);
  });
});

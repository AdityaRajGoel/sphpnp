import { describe, expect, it } from "vitest";
import { mergeUniverse, sectorFor } from "../../supabase/functions/_shared/universe";

const curated = [
  { symbol: "HDFCBANK", yahoo: "HDFCBANK.NS", name: "HDFC Bank", sector: "Banking" },
  { symbol: "M&M", yahoo: "M&M.NS", name: "Mahindra & Mahindra", sector: "Auto" },
];

describe("sectorFor", () => {
  it("splits NSE's Financial Services into banks, insurers and NBFCs by name", () => {
    expect(sectorFor("Financial Services", "Karur Vysya Bank Ltd.")).toBe("Banking");
    expect(sectorFor("Financial Services", "Star Health and Allied Insurance Company Ltd.")).toBe("Insurance");
    expect(sectorFor("Financial Services", "Max Financial Services Ltd.")).toBe("NBFC");
  });

  it("maps the other NSE industries onto the screener's sectors, unknown ones to Diversified", () => {
    expect(sectorFor("Information Technology", "Mphasis Ltd.")).toBe("IT");
    expect(sectorFor("Power", "JSW Energy Ltd.")).toBe("Energy");
    expect(sectorFor("Realty", "Oberoi Realty Ltd.")).toBe("Infra");
    expect(sectorFor("Something New", "X Ltd.")).toBe("Diversified");
    expect(sectorFor(null, "X Ltd.")).toBe("Diversified");
  });
});

describe("mergeUniverse", () => {
  const constituents = [
    { symbol: "HDFCBANK", company: "HDFC Bank Ltd.", industry: "Financial Services" },
    { symbol: "MPHASIS", company: "Mphasis Ltd.", industry: "Information Technology" },
    { symbol: "BAJAJ-AUTO", company: "Bajaj Auto Limited", industry: "Automobile and Auto Components" },
    { symbol: "bad symbol!", company: "Junk", industry: "Power" },
  ];

  it("keeps curated rows as they are and adds the rest of the index once", () => {
    const u = mergeUniverse(curated, constituents);
    expect(u.find((s) => s.symbol === "HDFCBANK")).toEqual(curated[0]);
    expect(u.filter((s) => s.symbol === "HDFCBANK")).toHaveLength(1);
    expect(u.find((s) => s.symbol === "MPHASIS")).toEqual({ symbol: "MPHASIS", yahoo: "MPHASIS.NS", name: "Mphasis", sector: "IT" });
    expect(u.find((s) => s.symbol === "BAJAJ-AUTO")?.name).toBe("Bajaj Auto");
  });

  it("drops symbols NSE could never have issued", () => {
    expect(mergeUniverse(curated, constituents).some((s) => s.symbol.includes(" "))).toBe(false);
  });

  it("falls back to the curated list when the constituents are missing", () => {
    expect(mergeUniverse(curated, [])).toEqual(curated);
  });
});

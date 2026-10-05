import { describe, expect, it } from "vitest";
import { cleanFundName, median, normalizeCategory } from "@/lib/mutual-funds";

describe("normalizeCategory", () => {
  it("merges AMFI's old and new labels for the same SEBI category", () => {
    expect(normalizeCategory("Equity Scheme - Large Cap Fund")).toEqual({ group: "Equity", name: "Large Cap" });
    expect(normalizeCategory("Equity Schemes - Large Cap Fund")).toEqual({ group: "Equity", name: "Large Cap" });
    expect(normalizeCategory("Equity Schemes - ELSS- Tax Saver Fund")).toEqual({ group: "Equity", name: "ELSS (tax saver)" });
    expect(normalizeCategory("Equity Scheme - ELSS")).toEqual({ group: "Equity", name: "ELSS (tax saver)" });
  });

  it("does not read Large & Mid Cap as Large Cap or Mid Cap", () => {
    expect(normalizeCategory("Equity Scheme - Large & Mid Cap Fund").name).toBe("Large & Mid Cap");
  });

  it("files debt, hybrid, index, ETF, fund-of-funds and solution schemes", () => {
    expect(normalizeCategory("Income/Debt Oriented Schemes - Liquid Fund")).toEqual({ group: "Debt", name: "Liquid" });
    expect(normalizeCategory("Income/Debt Oriented Schemes - Ultra Short to Short Term Fund").name).toBe("Ultra Short Duration");
    expect(normalizeCategory("Income/Debt Oriented Schemes - 10-year Constant Maturity Gilt Fund").name).toBe("Gilt, 10-year constant maturity");
    expect(normalizeCategory("Hybrid Schemes - Balanced Advantage Fund/ Dynamic Asset Allocation")).toEqual({ group: "Hybrid", name: "Balanced Advantage" });
    expect(normalizeCategory("Other Scheme - Index Funds")).toEqual({ group: "Index funds & ETFs", name: "Index funds" });
    expect(normalizeCategory("Index Funds - Debt Funds").name).toBe("Debt index funds");
    expect(normalizeCategory("Exchange Traded Funds (ETFs) - Gold ETF").name).toBe("Gold ETFs");
    expect(normalizeCategory("Other Scheme - FoF Overseas")).toEqual({ group: "Fund of funds", name: "Overseas" });
    expect(normalizeCategory("Solution Oriented Schemes ** - Retirement Fund")).toEqual({ group: "Solution-oriented", name: "Retirement" });
  });

  it("puts what it does not recognise under Other", () => {
    expect(normalizeCategory("Something New - Odd Fund").group).toBe("Other");
  });
});

describe("cleanFundName", () => {
  it("drops the plan and option tail AMFI appends", () => {
    expect(cleanFundName("Axis Large Cap Fund - Direct Plan - Growth")).toBe("Axis Large Cap Fund");
    expect(cleanFundName("HDFC Large Cap Fund - Growth Option - Direct Plan")).toBe("HDFC Large Cap Fund");
    expect(cleanFundName("Parag Parikh Flexi Cap Fund-Direct Plan-Growth")).toBe("Parag Parikh Flexi Cap Fund");
  });
});

describe("median", () => {
  it("ignores missing values", () => {
    expect(median([3, null, 1, 2])).toBe(2);
    expect(median([null])).toBeNull();
  });
});

describe("cleanFundName casing", () => {
  // 268 AMFI scheme names arrive in capitals; they sat beside "Parag Parikh Flexi Cap Fund" in the same table.
  it.each([
    ["BANK OF INDIA FLEXI CAP FUND - DIRECT PLAN - GROWTH", "Bank of India Flexi Cap Fund"],
    ["SBI FLEXICAP FUND", "SBI Flexicap Fund"],
    ["ANGEL ONE GOLD ETF FOF", "Angel One Gold ETF FOF"],
    ["BANDHAN CRISIL IBX GILT APRIL 2026 INDEX FUND", "Bandhan CRISIL IBX Gilt April 2026 Index Fund"],
    ["ADITYA BIRLA SUN LIFE BAL BHAVISHYA YOJNA", "Aditya Birla Sun Life Bal Bhavishya Yojna"],
    ["BANDHAN CRISIL IBX 90:10 SDL PLUS GILT", "Bandhan CRISIL IBX 90:10 SDL Plus Gilt"],
    ["ICICI PRUDENTIAL PSU EQUITY FUND", "ICICI Prudential PSU Equity Fund"],
    ["ANGEL ONE NIFTY 1D RATE LIQUID ETF", "Angel One Nifty 1D Rate Liquid ETF"],
    ["UNIFI FLEXI CAP FUND", "Unifi Flexi Cap Fund"],
    ["360 ONE QUANT FUND", "360 One Quant Fund"],
  ])("%s -> %s", (raw, expected) => {
    expect(cleanFundName(raw)).toBe(expected);
  });

  it("leaves names that already have lower case alone", () => {
    expect(cleanFundName("Parag Parikh Flexi Cap Fund - Direct Plan - Growth")).toBe("Parag Parikh Flexi Cap Fund");
    expect(cleanFundName("HDFC Mid-Cap Opportunities Fund")).toBe("HDFC Mid-Cap Opportunities Fund");
  });
});

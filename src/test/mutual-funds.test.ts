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

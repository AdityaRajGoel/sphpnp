import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseContexts, HEADLINE_CONTEXT } from "../../supabase/functions/_shared/xbrl";

const xml = readFileSync("src/test/fixtures/xbrl/reliance-q3fy25-standalone.xml", "utf-8");

describe("parseContexts", () => {
  it("finds the headline current-quarter context", () => {
    const ctx = parseContexts(xml);
    expect(ctx.has(HEADLINE_CONTEXT)).toBe(true);
    expect(ctx.get("OneD")!.column).toBe("One");
  });

  it("labels the year-to-date column separately from the quarter", () => {
    const ctx = parseContexts(xml);
    expect(ctx.get("FourD")!.column).toBe("Four");
  });

  it("records the declared period even though it is not trusted for selection", () => {
    const ctx = parseContexts(xml);
    expect(ctx.get("OneD")!.startDate).toBe("2024-10-01");
    expect(ctx.get("OneD")!.endDate).toBe("2024-12-31");
  });

  it("marks instant contexts", () => {
    const ctx = parseContexts(xml);
    expect(ctx.get("OneI")!.isInstant).toBe(true);
  });

  // This is the entire reason parseContexts exists: OneD (the quarter) and
  // FourD (the nine-month year-to-date) declare the SAME period in this
  // filing. If the declared period were trusted for selection, the two
  // contexts would be indistinguishable and a refactor could plausibly pick
  // FourD's figure for a quarterly headline, overstating it roughly threefold.
  // Only the id prefix ("One" vs "Four") disambiguates them.
  it("pins the trap: OneD and FourD declare an identical period despite holding different figures", () => {
    const ctx = parseContexts(xml);
    const oneD = ctx.get("OneD")!;
    const fourD = ctx.get("FourD")!;
    expect(fourD.startDate).toBe(oneD.startDate);
    expect(fourD.endDate).toBe(oneD.endDate);
  });

  // `\bid="` treats the ':' in `xml:id` as a word boundary, so a namespaced
  // id attribute would be read as THE id. The context would then be filed
  // under a name no fact references, and every figure in the filing would
  // come back null with nothing logged — a whole filing lost silently.
  it("does not mistake a namespaced xml:id for the context id", () => {
    const inlineXml = `
      <xbrli:context xml:id="GhostContext" id="OneD">
        <xbrli:period><xbrli:startDate>2024-10-01</xbrli:startDate><xbrli:endDate>2024-12-31</xbrli:endDate></xbrli:period>
      </xbrli:context>
    `;
    const ctx = parseContexts(inlineXml);
    expect(ctx.has("OneD")).toBe(true);
    expect(ctx.has("GhostContext")).toBe(false);
  });

  it("tolerates a context tag with extra attributes in any order", () => {
    const inlineXml = `
      <xbrli:context xml:lang="en-IN" id="OneD">
        <xbrli:entity><xbrli:identifier scheme="http://www.nseindia.com/NSESymbol">TEST</xbrli:identifier></xbrli:entity>
        <xbrli:period><xbrli:startDate>2024-10-01</xbrli:startDate><xbrli:endDate>2024-12-31</xbrli:endDate></xbrli:period>
      </xbrli:context>
    `;
    const ctx = parseContexts(inlineXml);
    expect(ctx.has("OneD")).toBe(true);
    expect(ctx.get("OneD")!.startDate).toBe("2024-10-01");
    expect(ctx.get("OneD")!.endDate).toBe("2024-12-31");
  });
});

import { parseIncomeStatement } from "../../supabase/functions/_shared/xbrl";

describe("parseIncomeStatement", () => {
  it("reads the current quarter, not the year to date", () => {
    const s = parseIncomeStatement(xml)!;
    // The FourD year-to-date value is 3966450000000. Returning that would mean
    // the parser trusted the declared period instead of the column prefix.
    expect(s.revenue).toBe(1282600000000);
  });

  it("extracts the rest of the headline figures", () => {
    const s = parseIncomeStatement(xml)!;
    expect(s.otherIncome).toBe(32140000000);
    expect(s.totalIncome).toBe(1314740000000);
    expect(s.totalExpenses).toBe(1198770000000);
    expect(s.profitBeforeTax).toBe(115970000000);
    expect(s.profitAfterTax).toBe(87210000000);
    expect(s.basicEps).toBe(6.44);
    expect(s.dilutedEps).toBe(6.44);
  });

  it("takes the quarter's EPS, not the year to date", () => {
    // FourD carries 17.77 for the nine months. 6.44 is the quarter.
    expect(parseIncomeStatement(xml)!.basicEps).toBe(6.44);
  });

  // These two ship straight to a stock page but had no assertion at all, so a
  // tag rename or a column slip would have surfaced as a plausible-looking
  // number rather than a test failure. 0.03 is the quarter; FourD carries 0.02,
  // so this also pins the column, not just the tag name.
  it("reads the debt ratios from the quarter column", () => {
    const s = parseIncomeStatement(xml)!;
    expect(s.debtEquityRatio).toBe(0);
    expect(s.debtServiceCoverageRatio).toBe(0.03);
  });

  it("reports the period end from the headline context", () => {
    expect(parseIncomeStatement(xml)!.periodEnd).toBe("2024-12-31");
  });

  it("returns null when the headline context is absent", () => {
    expect(parseIncomeStatement("<xbrli:xbrl></xbrli:xbrl>")).toBeNull();
  });

  it("ignores segment breakdowns that share the column prefix", () => {
    const s = parseIncomeStatement(xml)!;
    // SegmentRevenueFromOperations under OneD is 1341330000000; picking it up
    // would mean matching on tag substring rather than exact tag name.
    expect(s.revenue).not.toBe(1341330000000);
  });
});

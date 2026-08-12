import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseContexts, HEADLINE_CONTEXT } from "../../supabase/functions/_shared/xbrl";

const xml = readFileSync("src/test/fixtures/xbrl/reliance-q3fy25-standalone.xml", "utf-8");
// Both of these declare ONLY dimensional contexts (OneReportableSegmentRevenue01D
// and friends) and omit the plain `OneD` / `FourD` declarations, while every
// headline fact still carries contextRef="OneD". See the fixtures README.
const bankXml = readFileSync("src/test/fixtures/xbrl/hdfcbank-q2fy24-standalone.xml", "utf-8");
const webXml = readFileSync("src/test/fixtures/xbrl/tataelxsi-q3fy23-standalone.xml", "utf-8");

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

  it("returns null when the document carries no headline figures at all", () => {
    expect(parseIncomeStatement("<xbrli:xbrl></xbrli:xbrl>")).toBeNull();
  });

  // A context that is declared but holds none of the figures we read is not a
  // filing we can store. Writing an all-null income row would mark the filing
  // "parsed" and hide the gap forever.
  it("returns null when the headline context is declared but empty", () => {
    const empty = `
      <xbrli:xbrl><xbrli:context id="OneD">
        <xbrli:period><xbrli:startDate>2024-10-01</xbrli:startDate><xbrli:endDate>2024-12-31</xbrli:endDate></xbrli:period>
      </xbrli:context></xbrli:xbrl>
    `;
    expect(parseIncomeStatement(empty)).toBeNull();
  });
});

/**
 * NSE publishes a large minority of filings whose instance declares only the
 * DIMENSIONAL contexts and silently omits the plain `OneD` / `FourD`
 * declarations - while every headline fact still carries contextRef="OneD".
 * That is invalid XBRL on NSE's side, but the figures are present, unambiguous
 * and correctly scoped, so they are readable.
 *
 * Requiring the DECLARATION rejected 27 filings across 9 symbols with
 * "no OneD headline context" - every banking filing, every NBFC filing and the
 * `_WEB` Ind-AS variants - and turned the hourly workflow red. Presence of a
 * declaration is not what makes a fact readable; the contextRef is.
 */
describe("parseIncomeStatement on filings that omit the context declaration", () => {
  it("reads an Ind-AS _WEB filing that never declares OneD", () => {
    const s = parseIncomeStatement(webXml)!;
    expect(s).not.toBeNull();
    // FourD carries the nine-month 23068027000. Reading that would mean the
    // relaxed guard had also relaxed the column.
    expect(s.revenue).toBe(8177431000);
    expect(s.otherIncome).toBe(191348000);
    expect(s.totalIncome).toBe(8368779000);
    expect(s.totalExpenses).toBe(5967808000);
    expect(s.profitBeforeTax).toBe(2400971000);
    expect(s.profitAfterTax).toBe(1946786000);
    expect(s.basicEps).toBe(31.26);
  });

  it("leaves the period end null when there is no declaration to read it from", () => {
    // The sync stores the registry's toDate, which is authoritative, so an
    // absent document period costs nothing - but it must not be invented.
    expect(parseIncomeStatement(webXml)!.periodEnd).toBeNull();
  });
});

/**
 * Banks file under the BANKING taxonomy, which names the same line items
 * differently. Before these tags were mapped the relaxed guard above would have
 * let a bank filing through carrying only `Income` and `OtherIncome` - a row
 * marked "parsed" with revenue, profit and EPS all null, which is worse than a
 * visible failure because nothing ever revisits it.
 */
describe("parseIncomeStatement on banking filings", () => {
  it("maps the banking tag set onto the same headline figures", () => {
    const s = parseIncomeStatement(bankXml)!;
    expect(s).not.toBeNull();
    // InterestEarned is the bank's revenue from operations.
    expect(s.revenue).toBe(676983900000);
    expect(s.otherIncome).toBe(107078400000);
    expect(s.totalIncome).toBe(784062300000);
    expect(s.profitBeforeTax).toBe(197900500000);
    expect(s.profitAfterTax).toBe(159761100000);
    expect(s.basicEps).toBe(21.13);
    expect(s.dilutedEps).toBe(21.02);
  });

  it("keeps the reported identity: interest earned + other income = total income", () => {
    const s = parseIncomeStatement(bankXml)!;
    expect(s.revenue! + s.otherIncome!).toBe(s.totalIncome);
  });

  it("leaves total expenses null rather than storing a figure that excludes provisions", () => {
    // The only bank-side candidate is ExpenditureExcludingProvisionsAndContingencies.
    // Storing it as "total expenses" would break the Income - Expenses = PBT
    // identity that holds for every Ind-AS row in the same column.
    expect(parseIncomeStatement(bankXml)!.totalExpenses).toBeNull();
  });

  it("does not let a banking tag override a present Ind-AS tag", () => {
    // Ind-AS is tried first, so a filing carrying both cannot be hijacked.
    expect(parseIncomeStatement(xml)!.revenue).toBe(1282600000000);
  });

  it("ignores segment breakdowns that share the column prefix", () => {
    const s = parseIncomeStatement(xml)!;
    // SegmentRevenueFromOperations under OneD is 1341330000000; picking it up
    // would mean matching on tag substring rather than exact tag name.
    expect(s.revenue).not.toBe(1341330000000);
  });
});

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

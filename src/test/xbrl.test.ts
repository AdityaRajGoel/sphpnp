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
});

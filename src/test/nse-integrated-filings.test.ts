import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { latestRevisions, parseIntegratedFilings } from "../../supabase/functions/_shared/nse";

/*
 * NSE's corporates-financial-results endpoint stops at the December 2024 quarter
 * (verified for RELIANCE on 2026-09-20: 130 entries, newest filed 16-Jan-2025).
 * Results filed since then live under the Integrated Filing regime, which the
 * fixture below is a real response from. Its XBRL uses the same in-capmkt tags
 * the existing parser already reads, so only the registry lookup changes.
 */
const payload = JSON.parse(readFileSync("src/test/fixtures/nse/integrated-filing-results-reliance.json", "utf-8"));

describe("parseIntegratedFilings", () => {
  const rows = parseIntegratedFilings("RELIANCE", payload);

  it("keeps the financial filings and drops governance ones", () => {
    expect(rows.length).toBe(12);
    expect(rows.every((r) => r.xbrlUrl.endsWith(".xml"))).toBe(true);
  });

  it("reads the quarter end, basis and audit status", () => {
    const june = rows.find((r) => r.toDate === "2026-06-30" && r.isConsolidated)!;
    expect(june).toMatchObject({ symbol: "RELIANCE", period: "Quarterly", isAudited: false, fromDate: "2026-04-01" });
    expect(june.filingDate?.slice(0, 10)).toBe("2026-07-17");
  });

  it("covers the quarters the old endpoint no longer serves", () => {
    expect(rows.some((r) => r.toDate > "2025-01-01")).toBe(true);
  });

  it("returns nothing for an empty or malformed payload", () => {
    expect(parseIntegratedFilings("X", { data: [] })).toEqual([]);
    expect(parseIntegratedFilings("X", null)).toEqual([]);
  });
});

describe("latestRevisions", () => {
  const f = (xbrlUrl: string, filingDate: string, isConsolidated = true) => ({
    symbol: "ADANIGREEN", period: "Quarterly", fromDate: "2026-01-01", toDate: "2026-03-31",
    isConsolidated, isAudited: true, xbrlUrl, filingDate,
  });

  it("keeps only the latest revision of a quarter per basis", () => {
    // Three revisions of one quarter as NSE lists them; the older links 404.
    const rows = latestRevisions([
      f("a.xml", "2026-04-24T04:16:57.000Z"),
      f("c.xml", "2026-04-24T04:33:39.000Z"),
      f("b.xml", "2026-04-24T04:25:07.000Z"),
      f("s.xml", "2026-04-24T04:10:00.000Z", false),
    ]);
    expect(rows.map((r) => r.xbrlUrl).sort()).toEqual(["c.xml", "s.xml"]);
  });

  it("prefers a dated filing over an undated one", () => {
    expect(latestRevisions([f("dated.xml", "2026-04-24T04:16:57.000Z"), f("undated.xml", "")]).map((r) => r.xbrlUrl)).toEqual(["dated.xml"]);
    expect(latestRevisions([f("undated.xml", ""), f("dated.xml", "2026-04-24T04:16:57.000Z")]).map((r) => r.xbrlUrl)).toEqual(["dated.xml"]);
  });
});

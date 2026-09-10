import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseAmfiNavAll } from "../../supabase/functions/_shared/amfi";

/*
 * AMFI's NAVAll.txt parser.
 *
 * Written against a real defect: the previous parser read the NAV from a fixed
 * column index. AMFI later inserted `Plan` and `Option` columns, which pushed
 * NAV from index 4 to index 6, so every row parsed as NaN and was skipped. The
 * job caught the resulting error into a report field and still returned 200, so
 * the daily workflow reported success while mutual fund NAVs sat frozen for
 * weeks.
 *
 * Hence the rule these tests pin: columns are resolved by HEADER NAME, never by
 * position, so inserting a column cannot silently move the data again.
 */

const fixture = (name: string) => readFileSync(`src/test/fixtures/amfi/${name}`, "utf-8");

describe("parseAmfiNavAll", () => {
  it("reads the current 8-column format", () => {
    const { rows, headerFound } = parseAmfiNavAll(fixture("navall-8col.txt"));

    expect(headerFound).toBe(true);
    expect(rows.length).toBeGreaterThan(0);

    const ppfc = rows.find((r) => r.scheme_code === "122639")!;
    expect(ppfc.nav).toBeCloseTo(89.3946, 4);
    expect(ppfc.nav_date).toBe("2026-09-09");
    expect(ppfc.scheme_name).toBe("Parag Parikh Flexi Cap Fund");
    expect(ppfc.plan).toBe("Direct Plan");
  });

  it("still reads the older 6-column format", () => {
    // The point of resolving by header is that both shapes work. If this ever
    // fails, positional assumptions have crept back in.
    const { rows, headerFound } = parseAmfiNavAll(fixture("navall-6col.txt"));

    expect(headerFound).toBe(true);
    const ppfc = rows.find((r) => r.scheme_code === "122639")!;
    expect(ppfc.nav).toBeCloseTo(89.3946, 4);
    expect(ppfc.nav_date).toBe("2026-09-09");
  });

  it("would survive another column being inserted", () => {
    const shifted = fixture("navall-8col.txt")
      .replace("Scheme Code;", "Scheme Code;Some New Column;")
      .replace(/^(\d+);/gm, "$1;filler;");

    const { rows } = parseAmfiNavAll(shifted);
    const ppfc = rows.find((r) => r.scheme_code === "122639")!;
    expect(ppfc.nav, "a new column must not move the NAV").toBeCloseTo(89.3946, 4);
  });

  it("skips the fund-house and scheme-type heading lines", () => {
    const { rows } = parseAmfiNavAll(fixture("navall-8col.txt"));
    for (const row of rows) {
      expect(row.scheme_code).toMatch(/^\d+$/);
      expect(Number.isFinite(row.nav)).toBe(true);
    }
  });

  it("reports no header rather than guessing, when the file is unrecognisable", () => {
    // Failing closed matters here: returning zero rows from a 200 response is
    // exactly how the previous defect hid. The caller needs to tell "AMFI
    // published nothing" apart from "we no longer understand the file".
    const { rows, headerFound } = parseAmfiNavAll("total garbage\nno header here\n");
    expect(headerFound).toBe(false);
    expect(rows).toEqual([]);
  });

  it("drops rows whose NAV is not a number", () => {
    const withDash = fixture("navall-8col.txt").replace(";89.3946;", ";N.A.;");
    const { rows } = parseAmfiNavAll(withDash);
    expect(rows.find((r) => r.scheme_code === "122639")).toBeUndefined();
    expect(rows.length, "one bad row must not discard the rest").toBeGreaterThan(0);
  });
});

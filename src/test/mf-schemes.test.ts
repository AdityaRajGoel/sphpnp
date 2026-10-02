import { describe, expect, it } from "vitest";
import { amfiDate, anchorWindow, latestOnOrBefore, toScheme } from "../../supabase/functions/_shared/mf-schemes";

const row = (o: Partial<Parameters<typeof toScheme>[0]>) => ({
  scheme_code: "1", isin_growth: "INF1", isin_reinvest: null, scheme_name: "X Fund - Direct Plan - Growth",
  plan: "Direct Plan", option: "Growth", nav: 10, nav_date: "2026-10-01", amc: "X Mutual Fund", category: "Equity Scheme - Large Cap Fund", ...o,
});

describe("toScheme", () => {
  it("keeps open-ended growth schemes, naming the plan", () => {
    expect(toScheme(row({}))).toMatchObject({ scheme_code: "1", plan: "direct", amc: "X Mutual Fund", category: "Equity Scheme - Large Cap Fund", nav: 10 });
    expect(toScheme(row({ plan: "Regular Plan", scheme_name: "X Fund - Regular - Growth" }))?.plan).toBe("regular");
  });

  it("reads the plan and option from the name when AMFI leaves those columns blank", () => {
    expect(toScheme(row({ plan: null, option: null, scheme_name: "Y Flexi Cap Fund - Direct Plan - Growth Option" }))?.plan).toBe("direct");
  });

  it("drops IDCW and dividend options, and schemes outside an open-ended heading", () => {
    expect(toScheme(row({ option: "IDCW", scheme_name: "X Fund - Direct - IDCW" }))).toBeNull();
    expect(toScheme(row({ option: null, scheme_name: "X Fund - Direct Plan - Dividend Payout" }))).toBeNull();
    expect(toScheme(row({ category: null }))).toBeNull();
  });
});

describe("anchorWindow", () => {
  it("ends the given number of days back and spans four days, to cover weekends and holidays", () => {
    expect(anchorWindow("2026-10-02", "1y")).toEqual({ from: "2025-09-29", to: "2025-10-02" });
  });
});

describe("latestOnOrBefore", () => {
  it("takes each scheme's last NAV on or before the anchor date", () => {
    const rows = [
      { scheme_code: "1", nav: 9, nav_date: "2025-09-30" },
      { scheme_code: "1", nav: 9.5, nav_date: "2025-10-01" },
      { scheme_code: "1", nav: 9.9, nav_date: "2025-10-03" },
      { scheme_code: "2", nav: 20, nav_date: "2025-09-29" },
    ];
    expect(Object.fromEntries(latestOnOrBefore(rows, "2025-10-02"))).toEqual({ "1": 9.5, "2": 20 });
  });
});

describe("amfiDate", () => {
  // en-GB writes September as "Sept" in current ICU, which AMFI rejects:
  // every history request for a September anchor came back unreadable.
  it("writes AMFI's three-letter months, September included", () => {
    expect(amfiDate("2025-09-29")).toBe("29-Sep-2025");
    expect(amfiDate("2026-01-05")).toBe("05-Jan-2026");
  });
});

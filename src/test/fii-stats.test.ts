import { describe, expect, it } from "vitest";
import { fiiStatsUrl, parseFiiStats, weekdaysBetween } from "../../supabase/functions/_shared/fii-stats";

// Rows as SheetJS reads NSE's files: 2018 gives numbers, 2020 on gives strings,
// and from 2023 per-index sub-rows sit under each top-level row.
const y2018 = [
  ["FII DERIVATIVES STATISTICS FOR 02-Jan-2018"],
  [null, "BUY", null, "SELL", null, "OPEN INTEREST AT THE END OF THE DAY"],
  ["INDEX FUTURES", 12672, 1072.9683, 25205, 2103.2341, 167645, 13461.1314],
  ["INDEX OPTIONS", 586709, 52735.8227, 570075, 51190.877, 686764, 55446.4665],
  ["STOCK FUTURES", 129084, 9595.6776, 135754, 10011.2891, 929183, 68150.8927],
  ["STOCK OPTIONS", 79685, 6015.4393, 79372, 5997.2949, 48141, 3671.2184],
  ["Notes:"],
];
const y2026 = [
  ["INDEX FUTURES", "20766", "3182.56", "48070", "7138.42", "369384", "55553.47"],
  ["BANKNIFTY FUTURES", "7170", "1180.65", "5259", "864.95", "57027", "9376.25"],
  ["NIFTY FUTURES", "12815", "1874.22", "41964", "6135.83", "288100", "42214.80"],
  ["", "", "", "", "", "", ""],
  ["INDEX OPTIONS", "7087520", "1046348.91", "7054949", "1041335.24", "3335400", "494456.86"],
];

describe("parseFiiStats", () => {
  it("reads the four top-level rows of a 2018 file, rounded to paise", () => {
    const rows = parseFiiStats(y2018, "2018-01-02");
    expect(rows.map((r) => r.instrument)).toEqual(["INDEX FUTURES", "INDEX OPTIONS", "STOCK FUTURES", "STOCK OPTIONS"]);
    expect(rows[0]).toEqual({ trade_date: "2018-01-02", instrument: "INDEX FUTURES", buy_contracts: 12672, buy_cr: 1072.97, sell_contracts: 25205, sell_cr: 2103.23, oi_contracts: 167645, oi_cr: 13461.13 });
  });

  it("ignores per-index sub-rows in a 2026 file, so nothing is counted twice", () => {
    const rows = parseFiiStats(y2026, "2026-10-01");
    expect(rows.map((r) => r.instrument)).toEqual(["INDEX FUTURES", "INDEX OPTIONS"]);
    expect(rows[0].oi_contracts).toBe(369384);
  });

  it("returns nothing for a sheet that is not the file", () => {
    expect(parseFiiStats([["<html>Access Denied</html>"]], "2026-10-01")).toEqual([]);
    expect(parseFiiStats([["INDEX FUTURES", "abc", "1", "1", "1", "1", "1"]], "2026-10-01")).toEqual([]);
  });
});

describe("archive dates", () => {
  it("builds NSE's DD-Mon-YYYY file name", () => {
    expect(fiiStatsUrl("2018-01-02")).toBe("https://nsearchives.nseindia.com/content/fo/fii_stats_02-Jan-2018.xls");
  });
  it("lists weekdays only", () => {
    expect(weekdaysBetween("2026-10-02", "2026-10-06")).toEqual(["2026-10-02", "2026-10-05", "2026-10-06"]);
  });
});

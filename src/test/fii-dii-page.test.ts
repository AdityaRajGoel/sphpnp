import { describe, expect, it } from "vitest";
import { fiiIndexLongShare, monthlyTotals, netOver, streak, toSessions } from "@/lib/fii-dii";

const rec = (date: string, category: string, buy: number, sell: number) => ({ activity_date: date, category, buy_cr: buy, sell_cr: sell });
// The stored figures for 30 Sep and 1 Oct 2026, plus an F&O row that must be ignored.
const rows = [
  rec("2026-10-01", "fii_cash", 12260.26, 21744.48), rec("2026-10-01", "dii_cash", 25420.04, 15378.2),
  rec("2026-10-01", "fii_fno", 1092127.42, 1088137.86),
  rec("2026-09-30", "fii_cash", 14967.82, 25116.23), rec("2026-09-30", "dii_cash", 24413.76, 13142.03),
  rec("2026-08-29", "fii_cash", 100, 50),
];

describe("toSessions", () => {
  it("pairs FII and DII cash per day, newest first, with net = buy - sell", () => {
    const s = toSessions(rows);
    expect(s.map((x) => x.date)).toEqual(["2026-10-01", "2026-09-30", "2026-08-29"]);
    expect(s[0].fii!.net).toBeCloseTo(-9484.22);
    expect(s[0].dii!.net).toBeCloseTo(10041.84);
    expect(s[2].dii).toBeNull();
  });
});

describe("summaries", () => {
  const s = toSessions(rows);
  it("sums the latest sessions and groups by month", () => {
    expect(netOver(s, 2).fii).toBeCloseTo(-9484.22 - 10148.41);
    expect(monthlyTotals(s).map((m) => [m.month, m.sessions])).toEqual([["2026-10", 1], ["2026-09", 1], ["2026-08", 1]]);
  });
  it("counts a selling streak as negative and stops at a gap in the sign", () => {
    expect(streak(s, "fii")).toBe(-2);
    expect(streak(s, "dii")).toBe(2);
  });
});

describe("fiiIndexLongShare", () => {
  it("takes FII rows only, oldest first", () => {
    const r = fiiIndexLongShare([
      { trade_date: "2026-10-01", client_type: "FII", fut_idx_long: 30, fut_idx_short: 70 },
      { trade_date: "2026-09-30", client_type: "FII", fut_idx_long: 50, fut_idx_short: 50 },
      { trade_date: "2026-10-01", client_type: "Client", fut_idx_long: 90, fut_idx_short: 10 },
    ]);
    expect(r.map((x) => [x.date, x.longPct])).toEqual([["2026-09-30", 50], ["2026-10-01", 30]]);
  });
});

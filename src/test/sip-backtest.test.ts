import { describe, it, expect } from "vitest";
import { cleanNavs, rollingSipReturns, runSip, toIsoDate, xirr, type NavPoint } from "@/lib/sip-backtest";

/** Daily NAVs growing at a constant annual rate, weekdays only. */
function growing(from: string, to: string, annual: number, base = 10): NavPoint[] {
  const out: NavPoint[] = [];
  const t0 = Date.parse(`${from}T00:00:00Z`);
  for (let t = t0; t <= Date.parse(`${to}T00:00:00Z`); t += 86_400_000) {
    const d = new Date(t);
    if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue;
    out.push({ date: d.toISOString().slice(0, 10), nav: base * Math.pow(1 + annual, (t - t0) / (365 * 86_400_000)) });
  }
  return out;
}

describe("NAV cleaning", () => {
  it("reads mfapi.in dates, drops bad NAVs and sorts ascending", () => {
    expect(toIsoDate("11-09-2026")).toBe("2026-09-11");
    expect(cleanNavs([{ date: "11-09-2026", nav: "110.261" }, { date: "10-09-2026", nav: "0" }, { date: "09-09-2026", nav: "109" }])).toEqual([
      { date: "2026-09-09", nav: 109 },
      { date: "2026-09-11", nav: 110.261 },
    ]);
  });
});

describe("xirr", () => {
  it("recovers a known annual rate", () => {
    expect(xirr([{ date: "2025-01-01", amount: -100 }, { date: "2026-01-01", amount: 110 }])).toBeCloseTo(10, 1);
  });

  it("refuses flows with no sign change", () => {
    expect(xirr([{ date: "2025-01-01", amount: -100 }, { date: "2026-01-01", amount: -1 }])).toBeNull();
  });
});

describe("runSip", () => {
  const navs = growing("2020-01-01", "2025-01-10", 0.12);

  it("buys monthly at the first NAV on or after each due date", () => {
    const r = runSip(navs, 5000, "2020-02-01", 12)!;
    expect(r.instalments).toHaveLength(12);
    expect(r.invested).toBe(60_000);
    // 1 Feb 2020 was a Saturday: the first instalment buys on Monday 3 Feb.
    expect(r.instalments[0].date).toBe("2020-02-03");
  });

  it("returns close to the fund's own growth rate as XIRR", () => {
    const r = runSip(navs, 5000, "2020-01-01", 60)!;
    expect(r.xirrPct!).toBeGreaterThan(11);
    expect(r.xirrPct!).toBeLessThan(13);
    expect(r.value).toBeGreaterThan(r.invested);
  });

  it("stops at the end of the history and refuses an empty run", () => {
    expect(runSip(navs, 5000, "2024-10-01", 24)!.instalments.length).toBeLessThan(24);
    expect(runSip(navs, 5000, "2030-01-01", 12)).toBeNull();
  });
});

describe("rollingSipReturns", () => {
  it("gives one XIRR per start year that fits the window", () => {
    const r = rollingSipReturns(growing("2020-01-01", "2025-01-10", 0.1), 3);
    // A 3-year SIP from Jan 2022 ends 1 Jan 2025, inside history running to 10 Jan 2025.
    expect(r.map((x) => x.startYear)).toEqual([2020, 2021, 2022]);
    expect(r[0].xirrPct).toBeGreaterThan(9);
  });
});

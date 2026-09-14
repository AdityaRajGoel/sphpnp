import { describe, it, expect } from "vitest";
import { expiryCalendar, isTradingDay, previousTradingDay, tradingDaysBetween, type Holiday } from "@/lib/market-holidays";
import { classifyRegime, rateOfChange, ratioSeries, simpleAverage } from "@/lib/macro-regime";

describe("trading days", () => {
  it("skips weekends and exchange holidays, per exchange", () => {
    expect(isTradingDay("2026-09-12")).toBe(false); // Saturday
    expect(isTradingDay("2026-09-14", "NSE")).toBe(false); // Ganesh Chaturthi
    expect(isTradingDay("2026-09-14", "MCX")).toBe(true);
    expect(previousTradingDay("2026-09-14")).toBe("2026-09-11");
    expect(tradingDaysBetween("2026-09-11", "2026-09-18")).toBe(4);
  });
});

describe("expiryCalendar", () => {
  const sept = expiryCalendar("2026-09-01", 30);

  it("puts NSE on Tuesdays and BSE on Thursdays, the last of the month as monthly", () => {
    const nse = sept.filter((e) => e.exchange === "NSE");
    expect(nse.map((e) => e.date)).toEqual(["2026-09-01", "2026-09-08", "2026-09-15", "2026-09-22", "2026-09-29"]);
    expect(nse.find((e) => e.date === "2026-09-29")!.kind).toBe("monthly");
    expect(sept.filter((e) => e.exchange === "BSE" && e.kind === "monthly").map((e) => e.date)).toEqual(["2026-09-24"]);
  });

  it("moves an expiry on a holiday to the previous trading day", () => {
    const holidays: Holiday[] = [{ date: "2026-09-15", name: "Test", exchanges: ["NSE"] }];
    const shifted = expiryCalendar("2026-09-10", 10, holidays).find((e) => e.scheduled === "2026-09-15")!;
    expect(shifted.date).toBe("2026-09-14");
    expect(shifted.shifted).toBe(true);
  });

  it("names the contracts each expiry settles", () => {
    expect(sept.find((e) => e.exchange === "NSE" && e.kind === "weekly")!.contracts).toBe("Nifty 50");
  });
});

describe("macro regime helpers", () => {
  it("computes rate of change and averages, refusing short history", () => {
    expect(rateOfChange([100, 110], 1)).toBeCloseTo(10, 10);
    expect(rateOfChange([100], 1)).toBeNull();
    expect(simpleAverage([1, 2, 3, 4], 2)).toBe(3.5);
    expect(ratioSeries([{ date: "a", close: 10 }, { date: "b", close: 12 }], [{ date: "b", close: 4 }])).toEqual([3]);
  });

  const up = Array.from({ length: 60 }, (_, i) => 100 + i);
  const flat = Array.from({ length: 60 }, () => 100);

  it("reads calm, trending, rupee-strong inputs as risk-on", () => {
    const r = classifyRegime({ indiaVix: [12], nifty: up, niftyVsFmcg: up, usdInr: Array.from({ length: 30 }, (_, i) => 85 - i * 0.05), brent: flat, sp500: up, breadthAbove200: 70 });
    expect(r.verdict).toBe("Risk-on");
    expect(r.signals.find((s) => s.id === "oil")!.lean).toBe("neutral");
  });

  it("will not call a regime from fewer than four known inputs", () => {
    expect(classifyRegime({ indiaVix: [25], nifty: [], niftyVsFmcg: [], usdInr: [], brent: [], sp500: [] }).verdict).toBe("Unknown");
  });
});

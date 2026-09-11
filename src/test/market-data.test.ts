import { describe, it, expect, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { valuationStats, indexOrder, fpiEquityNet, net, longShare, crore, lakhs, type FpiRow } from "@/lib/market-data";

describe("valuationStats", () => {
  const history = (last: number) => [...Array.from({ length: 40 }, (_, i) => 18 + (i % 5) * 0.5), last];

  it("reads a P/E far above its own history as expensive", () => {
    const s = valuationStats(history(26))!;
    expect(s.zone).toBe("expensive");
    expect(s.percentile).toBe(100);
    expect(s.current).toBe(26);
  });

  it("reads a middling value as fair and a low one as cheap", () => {
    expect(valuationStats(history(19))!.zone).toBe("fair");
    expect(valuationStats(history(14))!.zone).toBe("cheap");
  });

  it("inverts for dividend yield: a high yield is the cheap end", () => {
    expect(valuationStats(history(26), true)!.zone).toBe("cheap");
  });

  it("needs a real history", () => {
    expect(valuationStats([20, 21, 22])).toBeNull();
  });
});

describe("indexOrder", () => {
  it("puts broad indices first in size order, sectors after", () => {
    expect(["NIFTY BANK", "NIFTY 500", "NIFTY 50", "NIFTY IT", "Nifty Next 50"].sort(indexOrder)).toEqual(["NIFTY 50", "Nifty Next 50", "NIFTY 500", "NIFTY BANK", "NIFTY IT"]);
  });
});

describe("fpiEquityNet", () => {
  it("takes the equity sub-total per day, oldest first", () => {
    const row = (d: string, category: string, route: string, net_cr: number): FpiRow => ({ report_date: d, section: "cash", category, route, net_cr, buy_cr: null, sell_cr: null, net_usd_mn: null, buy_contracts: null, sell_contracts: null, oi_contracts: null, oi_cr: null });
    expect(fpiEquityNet([row("2026-09-11", "Equity", "Sub-total", -226.08), row("2026-09-10", "Equity", "Sub-total", 500), row("2026-09-11", "Equity", "Stock Exchange", -227.13)]))
      .toEqual([{ date: "2026-09-10", net_cr: 500 }, { date: "2026-09-11", net_cr: -226.08 }]);
  });
});

describe("position helpers", () => {
  it("nets and shares long positions", () => {
    expect(net(286829, 55858)).toBe(230971);
    expect(longShare(75, 25)).toBe(75);
    expect(longShare(0, 0)).toBeNull();
  });

  it("writes crore and lakh contracts short", () => {
    expect(crore(12479.2)).toBe("12,479 Cr");
    expect(crore(250000)).toBe("2.50L Cr");
    expect(lakhs(3460539)).toBe("34.6 L");
  });
});

import { summariseGlobal } from "@/lib/market-data";

describe("summariseGlobal", () => {
  const bars = [
    { ticker: "A", trade_date: "2025-09-10", close: 100 },
    { ticker: "A", trade_date: "2026-08-10", close: 110 },
    { ticker: "A", trade_date: "2026-09-09", close: 120 },
    { ticker: "A", trade_date: "2026-09-10", close: 126 },
    { ticker: "B", trade_date: "2026-09-10", close: 5 },
  ];

  it("reads the last close with day, month and year changes", () => {
    const s = summariseGlobal(bars, "A")!;
    expect(s).toMatchObject({ close: 126, date: "2026-09-10" });
    expect(s.day).toBeCloseTo(5, 5);
    expect(s.month).toBeCloseTo((126 / 110 - 1) * 100, 5);
    expect(s.year).toBeCloseTo(26, 5);
  });

  it("has no change without an earlier close, and nothing for an unknown ticker", () => {
    expect(summariseGlobal(bars, "B")).toMatchObject({ day: null, month: null, year: null });
    expect(summariseGlobal(bars, "Z")).toBeNull();
  });
});

import { buildUpCounts, fpiFortnightTotals, oiChangePct, pctChange, sectorFlowsFor, type FoSnapshot, type FpiSector } from "@/lib/market-data";

describe("F&O snapshot helpers", () => {
  const snap = (symbol: string, build_up: FoSnapshot["build_up"], fut_oi: number | null, fut_oi_change: number | null): FoSnapshot => ({
    trade_date: "2026-09-10", symbol, expiry: "2026-09-29", spot: 100, pcr: 1, max_pain: 100, call_wall: 110, put_wall: 90,
    total_call_oi: 1, total_put_oi: 1, fut_close: 101, fut_prev_close: 100, fut_oi, fut_oi_change, build_up, lot_size: 500,
  });

  it("reads the OI change against the day before's open interest", () => {
    // 1,100 today after +100: 100 / 1,000 = 10%.
    expect(oiChangePct(snap("A", "long_buildup", 1100, 100))).toBeCloseTo(10);
    expect(oiChangePct(snap("A", "long_buildup", 100, 100))).toBeNull(); // nothing open the day before
    expect(oiChangePct(snap("A", "long_buildup", null, 100))).toBeNull();
  });

  it("counts underlyings in each build-up", () => {
    const counts = buildUpCounts([snap("A", "long_buildup", 1, 0), snap("B", "long_buildup", 1, 0), snap("C", "short_covering", 1, 0), snap("D", null, 1, 0)]);
    expect(counts).toEqual({ long_buildup: 2, short_buildup: 0, short_covering: 1, long_unwinding: 0, neutral: 0 });
  });

  it("gives no percentage change from a missing or zero base", () => {
    expect(pctChange(110, 100)).toBeCloseTo(10);
    expect(pctChange(110, 0)).toBeNull();
    expect(pctChange(null, 100)).toBeNull();
  });
});

describe("FPI sector helpers", () => {
  const row = (fortnight_end: string, sector: string, equity_net_cr: number | null): FpiSector => ({
    fortnight_end, sector, equity_net_cr, debt_net_cr: 0, other_net_cr: 0, total_net_cr: equity_net_cr,
    equity_net_usd_mn: null, total_net_usd_mn: null, equity_auc_cr: 1000, total_auc_cr: 1000, total_auc_usd_mn: null,
  });
  const rows = [
    row("2026-08-31", "Power", -500), row("2026-08-31", "Healthcare", 2431), row("2026-08-31", "Total", 1931), row("2026-08-31", "Realty", null),
    row("2026-08-15", "Power", 100), row("2026-08-15", "Total", 100),
  ];

  it("ranks one fortnight's sectors by net buying, leaving out the total and blanks", () => {
    expect(sectorFlowsFor(rows, "2026-08-31").map((r) => r.sector)).toEqual(["Healthcare", "Power"]);
  });

  it("reads the all-sector total per fortnight, oldest first", () => {
    expect(fpiFortnightTotals(rows)).toEqual([{ fortnight: "2026-08-15", equity: 100, total: 100 }, { fortnight: "2026-08-31", equity: 1931, total: 1931 }]);
  });
});

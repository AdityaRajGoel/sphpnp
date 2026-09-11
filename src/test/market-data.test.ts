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

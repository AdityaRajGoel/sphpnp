import { describe, it, expect, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { insiderSummary, shortRupees, webHref, type InsiderTrade } from "@/lib/stock-disclosures";

const trade = (over: Partial<InsiderTrade>): InsiderTrade => ({
  disclosure_id: "x", person: "P", category: null, transaction: "buy", mode: null, quantity: null, value: null,
  traded_to: null, disclosed_at: "2026-09-01T00:00:00Z", xbrl_url: null, ...over,
});

describe("insiderSummary", () => {
  const now = Date.parse("2026-09-11T00:00:00Z");

  it("totals the year's market buying and selling, leaving pledges out", () => {
    const s = insiderSummary([
      trade({ transaction: "buy", value: 5_00_000 }),
      trade({ transaction: "sell", value: 2_00_000 }),
      trade({ transaction: "sell", value: 1_00_000 }),
      trade({ transaction: "pledge", value: 9_99_99_999 }),
      trade({ transaction: "buy", value: 1_00_00_000, disclosed_at: "2025-01-01T00:00:00Z" }),
    ], now);
    expect(s).toEqual({ buys: 1, sells: 2, boughtValue: 500000, soldValue: 300000, net: 200000 });
  });
});

describe("shortRupees", () => {
  it("writes rupees in crore, lakh or plain", () => {
    expect(shortRupees(4_30_00_000)).toBe("₹4.3 Cr");
    expect(shortRupees(12_50_000)).toBe("₹12.5 L");
    expect(shortRupees(8500)).toBe("₹8,500");
    expect(shortRupees(-3_00_000)).toBe("-₹3.0 L");
  });
});

describe("webHref", () => {
  it("links web URLs only", () => {
    expect(webHref("https://www.bseindia.com/x.pdf")).toBe("https://www.bseindia.com/x.pdf");
    expect(webHref("javascript:alert(1)")).toBeUndefined();
    expect(webHref(null)).toBeUndefined();
  });
});

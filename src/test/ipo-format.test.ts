import { describe, it, expect, vi } from "vitest";

// These are pure formatters, but they live in a module that also exports
// `getIpos`, which imports the real Supabase client. That client kicks off an
// async session bootstrap on import that jsdom's storage stub can't satisfy
// (see banner-message.test.tsx for the same fix) — mocked out here so this
// file never touches a real client for functions that need no network at all.
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { formatGmp, formatGmpPercent, formatListingGain, formatLotSize, formatMinInvestment, formatRegistrar, formatSubscription, gmpPercent, sectionTableHasHeader } from "@/lib/ipo";

/*
 * Formatting helpers for the IPO surfaces. The one rule every one of these
 * enforces: an absent figure renders as an explicit word ("Not disclosed",
 * "Not yet quoted"), never as 0, an empty string, or a raw internal token.
 */

describe("formatLotSize", () => {
  it("says 'Not disclosed' rather than 0 or blank when the source never published it", () => {
    expect(formatLotSize(null)).toBe("Not disclosed");
  });
  it("formats a known lot size with Indian grouping", () => {
    expect(formatLotSize(1000)).toBe("1,000");
  });
});

describe("formatRegistrar", () => {
  it("says 'Not disclosed' rather than blank", () => {
    expect(formatRegistrar(null)).toBe("Not disclosed");
  });
  it("passes through a known registrar", () => {
    expect(formatRegistrar("Link Intime")).toBe("Link Intime");
  });
});

describe("formatGmp", () => {
  it("says 'Not yet quoted' for a null GMP, not ₹0", () => {
    expect(formatGmp(null)).toBe("Not yet quoted");
  });
  it("formats a real GMP as rupees", () => {
    expect(formatGmp(45)).toContain("45");
  });

  it("keeps a median GMP's paise, so it agrees with its percentage", () => {
    expect(formatGmp(139.5)).toBe("₹139.50");
    expect(formatGmp(140)).toBe("₹140");
  });
});

describe("formatListingGain", () => {
  it("returns null (not a fabricated 0%) when there is no listing gain yet", () => {
    expect(formatListingGain(null)).toBeNull();
  });
  it("signs a positive gain explicitly", () => {
    expect(formatListingGain(12.34)).toBe("+12.3%");
  });
  it("does not double-sign a negative gain", () => {
    expect(formatListingGain(-5)).toBe("-5.0%");
  });
});

describe("formatMinInvestment", () => {
  const base = { min_investment: 14973, min_investment_lots: 1, min_investment_shares: 161, min_investment_category: "Retail" };

  it("states the amount with the lots and shares it buys", () => {
    expect(formatMinInvestment(base)).toEqual({ amount: "₹14,973", basis: "1 lot · 161 shares" });
  });

  it("pluralises lots, as an SME issue's two-lot minimum needs", () => {
    expect(formatMinInvestment({ ...base, min_investment: 212000, min_investment_lots: 2, min_investment_shares: 4000 }))
      .toEqual({ amount: "₹2,12,000", basis: "2 lots · 4,000 shares" });
  });

  it("is absent, not computed, when the issue page did not publish it", () => {
    expect(formatMinInvestment({ ...base, min_investment: null })).toBeNull();
  });
});

describe("sectionTableHasHeader", () => {
  it("treats a multi-column grid's first row as its header", () => {
    expect(sectionTableHasHeader([["Application", "Lots", "Shares", "Amount"], ["Retail (Min)", "1", "161", "₹14,973"]])).toBe(true);
  });

  it("treats a two-column label/value table as having no header", () => {
    expect(sectionTableHasHeader([["Face Value", "₹ 10 per share"], ["Lot Size", "161 Shares"]])).toBe(false);
  });
});

describe("gmpPercent", () => {
  it("is GMP over the upper price band - the price a cut-off applicant pays", () => {
    // LCC Projects: GMP 48 on a 139-146 band.
    expect(gmpPercent({ gmp: 48, price_band_max: 146 })).toBeCloseTo(32.88, 2);
  });

  it("is negative when the grey market is below the issue price", () => {
    expect(gmpPercent({ gmp: -5, price_band_max: 100 })).toBe(-5);
  });

  it("is absent without both figures, never computed against a zero price", () => {
    expect(gmpPercent({ gmp: null, price_band_max: 146 })).toBeNull();
    expect(gmpPercent({ gmp: 48, price_band_max: null })).toBeNull();
    expect(gmpPercent({ gmp: 48, price_band_max: 0 })).toBeNull();
  });
});

describe("formatGmpPercent", () => {
  it("signs the figure to one decimal", () => {
    expect(formatGmpPercent(32.876)).toBe("+32.9%");
    expect(formatGmpPercent(-5)).toBe("-5.0%");
    expect(formatGmpPercent(0)).toBe("0.0%");
    expect(formatGmpPercent(null)).toBeNull();
  });
});

describe("formatSubscription", () => {
  it("writes a multiple the way the market quotes it", () => {
    expect(formatSubscription(4.71)).toBe("4.71x");
    expect(formatSubscription(459.2)).toBe("459.20x");
    expect(formatSubscription(null)).toBeNull();
  });
});

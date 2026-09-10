import { describe, it, expect, vi } from "vitest";

// These are pure formatters, but they live in a module that also exports
// `getIpos`, which imports the real Supabase client. That client kicks off an
// async session bootstrap on import that jsdom's storage stub can't satisfy
// (see banner-message.test.tsx for the same fix) — mocked out here so this
// file never touches a real client for functions that need no network at all.
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { fieldSourceLabel, formatGmp, formatListingGain, formatLotSize, formatRegistrar, formatSourceList } from "@/lib/ipo";

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

describe("formatSourceList", () => {
  it("turns the internal '+'-joined key into a readable, deduplicated list", () => {
    expect(formatSourceList("ipowatch+investorgain+ipowatch")).toBe("IPO Watch, InvestorGain");
  });
  it("labels a single source", () => {
    expect(formatSourceList("chittorgarh")).toBe("Chittorgarh");
  });
  it("falls back to the raw token for anything unrecognised, rather than dropping it", () => {
    expect(formatSourceList("mystery-source")).toBe("mystery-source");
  });
});

describe("fieldSourceLabel", () => {
  it("returns null when field_sources is null", () => {
    expect(fieldSourceLabel(null, "lot_size")).toBeNull();
  });
  it("returns null when the field has no recorded source", () => {
    expect(fieldSourceLabel({ price_band_min: "chittorgarh" }, "lot_size")).toBeNull();
  });
  it("labels the source that supplied the field", () => {
    expect(fieldSourceLabel({ lot_size: "investorgain" }, "lot_size")).toBe("InvestorGain");
  });
});

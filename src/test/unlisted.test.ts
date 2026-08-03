import { describe, it, expect } from "vitest";
import { unlistedMatchKey, isQuoteStale, QUOTE_STALE_AFTER_DAYS } from "@/lib/unlisted";

/**
 * These pin the contract shared with supabase/functions/sync-unlisted-quotes,
 * which carries its own copy of the key function because Deno cannot import
 * from src/. If the two drift the join returns nothing, silently, so the real
 * names below are taken from live fetches of both dealers.
 */
describe("unlistedMatchKey", () => {
  it("collapses the same company written three ways onto one key", () => {
    const keys = new Set([
      unlistedMatchKey("NSE India Limited Unlisted Shares"),
      unlistedMatchKey("NSE India Unlisted Shares"),
      unlistedMatchKey("NSE India Ltd"),
    ]);
    expect(keys.size).toBe(1);
  });

  it("strips parenthetical aliases so MSEI matches across dealers", () => {
    expect(unlistedMatchKey("Metropolitan Stock Exchange (MSEI) Unlisted Shares")).toBe(
      unlistedMatchKey("Metropolitan Stock Exchange Unlisted Shares"),
    );
  });

  it("normalises ampersand entities", () => {
    expect(unlistedMatchKey("NCDEX (National Commodity &amp; Derivatives Exchange) Limited")).toBe(
      unlistedMatchKey("NCDEX Limited"),
    );
  });

  it("does not collapse two genuinely different companies", () => {
    expect(unlistedMatchKey("GH2 Solar Limited")).not.toBe(
      unlistedMatchKey("Onix Renewable Limited"),
    );
  });

  it("cannot resolve an abbreviation, and is expected not to", () => {
    // Documented limit rather than a bug: matching these would require a
    // company alias table. Leaving them unmatched keeps a wrong price off
    // the page, which is the failure direction we want.
    expect(unlistedMatchKey("CSK Unlisted Shares")).not.toBe(
      unlistedMatchKey("Chennai Super Kings Unlisted Shares"),
    );
  });
});

describe("isQuoteStale", () => {
  const now = Date.parse("2026-08-03T12:00:00Z");

  it("treats a quote collected today as current", () => {
    expect(isQuoteStale("2026-08-03T08:00:00Z", now)).toBe(false);
  });

  it("treats a quote older than the window as stale", () => {
    const old = new Date(now - (QUOTE_STALE_AFTER_DAYS + 1) * 86_400_000).toISOString();
    expect(isQuoteStale(old, now)).toBe(true);
  });

  it("treats an undateable quote as stale rather than current", () => {
    expect(isQuoteStale("not-a-date", now)).toBe(true);
  });
});

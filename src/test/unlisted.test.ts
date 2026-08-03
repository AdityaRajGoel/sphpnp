import { describe, it, expect } from "vitest";
import { isQuoteStale, QUOTE_STALE_AFTER_DAYS } from "@/lib/unlisted";

/**
 * The comparison block shows other dealers' indicative rates. The one rule that
 * has to hold is that nothing undated or old is presented as current, so that
 * is what these cover.
 */
describe("isQuoteStale", () => {
  const now = Date.parse("2026-08-03T12:00:00Z");

  it("treats a quote collected today as current", () => {
    expect(isQuoteStale("2026-08-03T08:00:00Z", now)).toBe(false);
  });

  it("treats a quote just inside the window as current", () => {
    const edge = new Date(now - (QUOTE_STALE_AFTER_DAYS * 86_400_000 - 60_000)).toISOString();
    expect(isQuoteStale(edge, now)).toBe(false);
  });

  it("treats a quote past the window as stale", () => {
    const old = new Date(now - (QUOTE_STALE_AFTER_DAYS + 1) * 86_400_000).toISOString();
    expect(isQuoteStale(old, now)).toBe(true);
  });

  it("treats an undateable quote as stale rather than current", () => {
    // Failing closed matters here: a quote we cannot date is precisely the
    // thing that must not appear as though it were today's price.
    expect(isQuoteStale("not-a-date", now)).toBe(true);
  });

  it("treats an empty timestamp as stale", () => {
    expect(isQuoteStale("", now)).toBe(true);
  });
});

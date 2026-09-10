import { describe, it, expect } from "vitest";
import {
  istDateKey,
  isSameIstTradingDay,
  shouldServeCachedReport,
} from "../../supabase/functions/_shared/report-cache";

/*
 * Guards for ai-stock-analysis' daily report cache.
 *
 * Extracted from the edge function for the same reason screener-row.ts and
 * ipo-parse.ts were: the function calls Deno.serve() at module scope, so it
 * cannot be imported into a Node test runner. The date-boundary and
 * cache-decision logic is where the bugs would live, and it is pure.
 *
 * The requirement: one AI report per symbol per Indian trading day (IST
 * calendar date), no TTL, no price-drift recompute, and chat mode must never
 * be served from this cache.
 */

describe("istDateKey", () => {
  it("resolves a plain daytime UTC instant to the same IST calendar date", () => {
    // 10:00 UTC on 9 Sep 2026 -> 15:30 IST on 9 Sep 2026.
    expect(istDateKey("2026-09-09T10:00:00.000Z")).toBe("2026-09-09");
  });

  it("resolves a UTC instant just after midnight to the PREVIOUS day's late-IST-evening", () => {
    // 00:00 UTC on 9 Sep 2026 -> 05:30 IST on 9 Sep 2026 (still the same
    // date, just the earliest possible IST moment for that UTC date).
    expect(istDateKey("2026-09-09T00:00:00.000Z")).toBe("2026-09-09");
  });

  it("rolls the IST date forward for a UTC instant in the 18:30-23:59 UTC band", () => {
    // 20:00 UTC on 8 Sep 2026 -> 01:30 IST on 9 Sep 2026 - the UTC date (8th)
    // and the IST date (9th) disagree here. This is the core boundary the
    // whole feature exists to get right.
    expect(istDateKey("2026-09-08T20:00:00.000Z")).toBe("2026-09-09");
  });

  it("resolves the UTC-vs-IST disagreement window (00:00-05:30 IST) to the correct IST day", () => {
    // 23:00 UTC on 8 Sep 2026 -> 04:30 IST on 9 Sep 2026. The UTC calendar
    // date here is still the 8th, but IST has already rolled to the 9th -
    // using the UTC date would wrongly treat a report generated in the
    // Indian pre-market as belonging to the prior trading day.
    expect(istDateKey("2026-09-08T23:00:00.000Z")).toBe("2026-09-09");
  });
});

describe("isSameIstTradingDay", () => {
  it("is true for two instants on the same IST calendar day", () => {
    expect(
      isSameIstTradingDay("2026-09-09T04:00:00.000Z", "2026-09-09T15:00:00.000Z"),
    ).toBe(true);
  });

  it("is false when the cached report was created on the previous IST day", () => {
    expect(
      isSameIstTradingDay("2026-09-08T10:00:00.000Z", "2026-09-09T10:00:00.000Z"),
    ).toBe(false);
  });

  it("treats a report generated at 23:45 UTC (IST pre-market) as the NEXT IST day, not the UTC day", () => {
    // Report created 2026-09-08T23:45:00Z = 2026-09-09 05:15 IST. "Now" a few
    // minutes later at 2026-09-09T00:10:00Z = 2026-09-09 05:40 IST. Same IST
    // trading day even though the UTC dates (8th vs 9th) differ.
    expect(
      isSameIstTradingDay("2026-09-08T23:45:00.000Z", "2026-09-09T00:10:00.000Z"),
    ).toBe(true);
  });
});

describe("shouldServeCachedReport", () => {
  const today = "2026-09-09T10:00:00.000Z";

  it("serves the cache when a report already exists for today's IST trading day", () => {
    expect(
      shouldServeCachedReport({
        isChat: false,
        cachedCreatedAt: "2026-09-09T04:15:00.000Z",
        now: today,
      }),
    ).toBe(true);
  });

  it("regenerates when the cached report is from a previous IST trading day", () => {
    expect(
      shouldServeCachedReport({
        isChat: false,
        cachedCreatedAt: "2026-09-08T10:00:00.000Z",
        now: today,
      }),
    ).toBe(false);
  });

  it("regenerates when there is no cached report at all", () => {
    expect(
      shouldServeCachedReport({ isChat: false, cachedCreatedAt: null, now: today }),
    ).toBe(false);
    expect(
      shouldServeCachedReport({ isChat: false, cachedCreatedAt: undefined, now: today }),
    ).toBe(false);
  });

  it("never serves the cache in chat mode, even with a same-day report", () => {
    expect(
      shouldServeCachedReport({
        isChat: true,
        cachedCreatedAt: "2026-09-09T04:15:00.000Z",
        now: today,
      }),
    ).toBe(false);
  });

  it("does not regenerate mid-day purely due to price drift (no drift parameter exists)", () => {
    // The old TTL+drift design invalidated a fresh cache row when the live
    // price moved >2% from the cached price. The daily-report contract has
    // no such signal at all - a same-day report is always served regardless
    // of how far price has moved since it was generated.
    expect(
      shouldServeCachedReport({
        isChat: false,
        cachedCreatedAt: "2026-09-09T04:15:00.000Z",
        now: "2026-09-09T18:00:00.000Z", // 23:30 IST, still 9 Sep in IST
      }),
    ).toBe(true);
  });
});

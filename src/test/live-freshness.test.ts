import { describe, it, expect, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { isMarketHours, snapshotIsShowable, LIVE_SNAPSHOT_MAX_AGE_MS } from "@/hooks/useScreenerStocks";
import { isStale, STALE_AFTER_MS } from "@/hooks/useLiveMarket";

/** An instant given as IST wall-clock time. */
const ist = (isoLocal: string) => new Date(Date.parse(`${isoLocal}Z`) - 5.5 * 3_600_000);

describe("isMarketHours", () => {
  it("is open between 09:15 and 15:30 IST on a trading day only", () => {
    expect(isMarketHours(ist("2026-09-15T10:00:00"))).toBe(true);
    expect(isMarketHours(ist("2026-09-15T09:10:00"))).toBe(false);
    expect(isMarketHours(ist("2026-09-15T15:45:00"))).toBe(false);
    expect(isMarketHours(ist("2026-09-13T11:00:00"))).toBe(false); // Sunday
    expect(isMarketHours(ist("2026-09-14T11:00:00"))).toBe(false); // Ganesh Chaturthi
  });
});

describe("snapshotIsShowable", () => {
  const during = ist("2026-09-15T11:00:00");

  it("refuses a snapshot older than the live limit during the session", () => {
    expect(snapshotIsShowable(new Date(during.getTime() - LIVE_SNAPSHOT_MAX_AGE_MS - 1000).toISOString(), during)).toBe(false);
    expect(snapshotIsShowable(new Date(during.getTime() - 60_000).toISOString(), during)).toBe(true);
  });

  it("accepts the last close outside the session, and nothing unparseable", () => {
    const evening = ist("2026-09-15T20:00:00");
    expect(snapshotIsShowable(ist("2026-09-15T15:31:00").toISOString(), evening)).toBe(true);
    expect(snapshotIsShowable(null, evening)).toBe(false);
    expect(snapshotIsShowable("not a date", evening)).toBe(false);
  });
});

describe("isStale", () => {
  const now = Date.parse("2026-09-15T06:00:00Z");

  it("uses a shorter window while the market is open", () => {
    const twoMinutesAgo = new Date(now - 120_000).toISOString();
    expect(isStale(twoMinutesAgo, true, now)).toBe(true);
    expect(isStale(twoMinutesAgo, false, now)).toBe(false);
    expect(isStale(new Date(now - STALE_AFTER_MS.closed - 1).toISOString(), false, now)).toBe(true);
  });

  it("treats a missing or broken timestamp as stale", () => {
    expect(isStale(null, false, now)).toBe(true);
    expect(isStale("garbage", true, now)).toBe(true);
  });
});

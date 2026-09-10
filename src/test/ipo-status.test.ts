import { describe, it, expect } from "vitest";
import { deriveIpoStatus, istDate, advanceStatus } from "../../supabase/functions/_shared/ipo-status";

/*
 * An IPO's lifecycle is fixed by its calendar: it opens on open_date, stops
 * taking bids after close_date and lists on listing_date. A source's status
 * LABEL is a weaker signal - Chittorgarh publishes the year's whole catalogue
 * with dates but no label at all, and once IPO Watch and InvestorGain drop an
 * issue after it lists, nothing labels it. That left 70 of 113 stored IPOs
 * reading "upcoming" weeks after they listed, some from July and April.
 */

const dates = (open_date: string | null, close_date: string | null, listing_date: string | null = null) =>
  ({ open_date, close_date, listing_date });

describe("deriveIpoStatus", () => {
  const today = "2026-09-10";

  it("marks an issue listed once its listing date arrives, whatever the label says", () => {
    expect(deriveIpoStatus(dates("2026-07-30", "2026-08-03", "2026-08-06"), "upcoming", today)).toBe("listed");
    expect(deriveIpoStatus(dates("2026-09-04", "2026-09-08", "2026-09-10"), "upcoming", today)).toBe("listed");
  });

  it("marks an issue closed between bidding ending and listing", () => {
    expect(deriveIpoStatus(dates("2026-09-04", "2026-09-08", "2026-09-11"), "upcoming", today)).toBe("closed");
  });

  it("marks an issue open from its open date through its close date inclusive", () => {
    expect(deriveIpoStatus(dates("2026-09-10", "2026-09-15"), "upcoming", today)).toBe("open");
    expect(deriveIpoStatus(dates("2026-09-08", "2026-09-10"), "upcoming", today)).toBe("open");
  });

  it("keeps a future issue upcoming", () => {
    expect(deriveIpoStatus(dates("2026-09-11", "2026-09-16"), "upcoming", today)).toBe("upcoming");
  });

  it("treats a long-closed issue with no recorded listing date as listed", () => {
    // SEBI's T+3 timeline lists an issue three working days after it closes.
    // A week past close with no listing date means the source never recorded
    // one, not that the issue is still waiting.
    expect(deriveIpoStatus(dates("2026-04-01", "2026-04-03"), "upcoming", today)).toBe("listed");
    expect(deriveIpoStatus(dates("2026-09-01", "2026-09-03"), "upcoming", today)).toBe("closed");
  });

  it("lets a label that is further along win, since the lifecycle only moves forward", () => {
    // Listing date not yet published, but a GMP site already reports it listed.
    expect(deriveIpoStatus(dates("2026-09-04", "2026-09-08"), "listed", today)).toBe("listed");
  });

  it("never lets a stale label drag a dated issue backwards", () => {
    expect(deriveIpoStatus(dates("2026-09-01", "2026-09-03", "2026-09-08"), "open", today)).toBe("listed");
  });

  it("falls back to the label when there are no dates at all", () => {
    expect(deriveIpoStatus(dates(null, null), "open", today)).toBe("open");
    expect(deriveIpoStatus(dates(null, null), "upcoming", today)).toBe("upcoming");
  });
});

describe("advanceStatus", () => {
  it("returns whichever status is further along the lifecycle", () => {
    expect(advanceStatus("upcoming", "open")).toBe("open");
    expect(advanceStatus("listed", "closed")).toBe("listed");
  });
});

describe("istDate", () => {
  it("uses the Indian calendar date, not UTC", () => {
    // 20:00 UTC on the 10th is already 01:30 on the 11th in India, and an issue
    // opening on the 11th is open for an Indian visitor at that moment.
    expect(istDate(new Date("2026-09-10T20:00:00Z"))).toBe("2026-09-11");
    expect(istDate(new Date("2026-09-10T10:00:00Z"))).toBe("2026-09-10");
  });
});

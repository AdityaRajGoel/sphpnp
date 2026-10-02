import { describe, expect, it } from "vitest";
import { nseMarketStatus } from "../../supabase/functions/_shared/market-holidays";

/* fetch-stock-prices decided "open" from weekday and clock alone, so on
 * Gandhi Jayanti (Fri 2 Oct 2026) the site said "Market Open" all day. */
const at = (istIso: string) => new Date(`${istIso}+05:30`);

describe("nseMarketStatus", () => {
  it("is closed on an exchange holiday that falls on a weekday, naming it, and opens next on the next trading day", () => {
    const s = nseMarketStatus(at("2026-10-02T11:00:00"));
    expect(s.isOpen).toBe(false);
    expect(s.statusText).toBe("Market Holiday");
    expect(s.holiday).toBe("Mahatma Gandhi Jayanti");
    expect(s.lastTradingDate).toBe("2026-10-01");
    expect(s.nextMarketOpenISO).toBe(at("2026-10-05T09:15:00").toISOString());
  });

  it("is open between 09:15 and 15:30 on a trading day, with today's close", () => {
    const s = nseMarketStatus(at("2026-10-01T10:00:00"));
    expect(s).toMatchObject({ isOpen: true, statusText: "Market Open", lastTradingDate: "2026-10-01", nextMarketOpenISO: null });
    expect(s.marketCloseISO).toBe(at("2026-10-01T15:30:00").toISOString());
  });

  it("is pre-market before 09:15, with the previous session as the last trading date", () => {
    const s = nseMarketStatus(at("2026-10-05T08:00:00"));
    expect(s).toMatchObject({ isOpen: false, statusText: "Pre-Market", lastTradingDate: "2026-10-01" });
    expect(s.nextMarketOpenISO).toBe(at("2026-10-05T09:15:00").toISOString());
  });

  it("is after hours past 15:30, opening next on the following trading day", () => {
    const s = nseMarketStatus(at("2026-10-19T16:00:00")); // Mon; Tue 20 Oct is Dussehra
    expect(s).toMatchObject({ isOpen: false, statusText: "After Hours", lastTradingDate: "2026-10-19" });
    expect(s.nextMarketOpenISO).toBe(at("2026-10-21T09:15:00").toISOString());
  });

  it("is closed at the weekend", () => {
    expect(nseMarketStatus(at("2026-10-03T11:00:00"))).toMatchObject({ isOpen: false, statusText: "Market Closed", lastTradingDate: "2026-10-01" });
  });
});

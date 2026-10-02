import { describe, expect, it } from "vitest";
import { dailyQuote } from "../../supabase/functions/_shared/yahoo-daily-quote";

const ist = (iso: string) => Math.floor(Date.parse(`${iso}+05:30`) / 1000);

/* HDFCBANK.NS, interval=1d&range=5d, as Yahoo answered on Gandhi Jayanti (2 Oct
 * 2026): a trailing bar for the holiday with null prices. With range=2d its
 * chartPreviousClose was 1 Oct's own close, so every stock read +0.00% and the
 * homepage counted 20 advances, 0 declines. */
const holiday = {
  meta: { regularMarketPrice: 721.2, chartPreviousClose: 719.05, regularMarketTime: ist("2026-10-01T15:15:00") },
  timestamp: ["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"].map((d) => ist(`${d}T09:15:00`)),
  indicators: { quote: [{
    close: [719.05, 722.7, 708.7, 721.2, null],
    open: [715, 720, 721, 710, null], high: [721, 725, 723, 722.4, null], low: [712, 718, 706, 709.5, null],
    volume: [21675579, 42755901, 39365496, 37389857, null],
  }] },
};

describe("dailyQuote", () => {
  it("compares the last session with the one before it, skipping the holiday's empty bar", () => {
    const q = dailyQuote(holiday)!;
    expect(q.price).toBe(721.2);
    expect(q.prevClose).toBe(708.7);
    expect(q.changePercent).toBeCloseTo(1.764, 2);
    expect(q).toMatchObject({ open: 710, high: 722.4, low: 709.5, volume: 37389857 });
  });

  it("during a session, compares the live price with the previous session's close", () => {
    const live = {
      meta: { regularMarketPrice: 730, regularMarketTime: ist("2026-10-05T11:00:00") },
      timestamp: [ist("2026-10-01T09:15:00"), ist("2026-10-05T09:15:00")],
      indicators: { quote: [{ close: [721.2, 729.5], open: [710, 722], high: [722.4, 731], low: [709.5, 721], volume: [1, 2] }] },
    };
    const q = dailyQuote(live)!;
    expect(q.prevClose).toBe(721.2);
    expect(q.change).toBeCloseTo(8.8);
  });

  it("is null without a price or an earlier session", () => {
    expect(dailyQuote({ meta: {}, timestamp: [], indicators: { quote: [{ close: [] }] } })).toBeNull();
  });
});

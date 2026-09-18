import { describe, it, expect } from "vitest";
import { exchangeCloseRow } from "../../supabase/functions/_shared/screener-row";

/*
 * When Yahoo gives nothing usable for a listed stock, its screener row used to
 * freeze: ITC Hotels sat at its 3 August price for six weeks and IndiGrid showed
 * Rs 140 against an NSE close of Rs 173. NSE's own daily close fills the gap.
 */
describe("exchangeCloseRow", () => {
  const bar = { symbol: "INDIGRID", trade_date: "2026-09-17", prev_close: 172.1, open: 172.5, high: 174, low: 171.9, close: 173.38, volume: 1_234_567 };

  it("builds the day's quote from the exchange close", () => {
    const row = exchangeCloseRow(bar);
    expect(row).toMatchObject({ symbol: "INDIGRID", price: 173.38, prev_close: 172.1, open_price: 172.5, day_high: 174, day_low: 171.9, volume: 1_234_567 });
    expect(row!.change as number).toBeCloseTo(1.28, 6);
    expect(row!.change_pct as number).toBeCloseTo((1.28 / 172.1) * 100, 6);
  });

  it("leaves the change unset without a previous close, rather than inventing one", () => {
    const row = exchangeCloseRow({ ...bar, prev_close: null })!;
    expect("change" in row).toBe(false);
    expect("change_pct" in row).toBe(false);
  });

  it("refuses a bar with no usable close", () => {
    expect(exchangeCloseRow({ ...bar, close: 0 })).toBeNull();
    expect(exchangeCloseRow({ ...bar, close: null })).toBeNull();
  });
});

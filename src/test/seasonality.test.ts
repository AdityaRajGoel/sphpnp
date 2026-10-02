import { describe, it, expect } from "vitest";
import { monthlyReturns } from "@/lib/seasonality";

const c = (trade_date: string, close: number) => ({ trade_date, close });

describe("monthly returns", () => {
  it("measures each month's last close against the previous month's, and marks the latest month as to-date", () => {
    const rows = monthlyReturns([
      c("2024-09-27", 100), c("2024-09-30", 110),
      c("2024-10-15", 90), c("2024-10-31", 99),
      c("2024-11-05", 108.9),
    ]);
    expect(rows).toEqual([
      { year: 2024, month: 9, pct: expect.closeTo(-10, 6), toDate: false },
      { year: 2024, month: 10, pct: expect.closeTo(10, 6), toDate: true },
    ]);
  });

  it("sorts its input and skips the first month, which has nothing to compare with", () => {
    expect(monthlyReturns([c("2025-02-28", 120), c("2025-01-31", 100)])).toEqual([
      { year: 2025, month: 1, pct: expect.closeTo(20, 6), toDate: true },
    ]);
    expect(monthlyReturns([c("2025-01-31", 100)])).toEqual([]);
    expect(monthlyReturns([])).toEqual([]);
  });

  it("ignores rows without a usable close", () => {
    expect(monthlyReturns([c("2025-01-31", 100), c("2025-02-10", 0), c("2025-02-27", 105)])).toEqual([
      { year: 2025, month: 1, pct: expect.closeTo(5, 6), toDate: true },
    ]);
  });
});

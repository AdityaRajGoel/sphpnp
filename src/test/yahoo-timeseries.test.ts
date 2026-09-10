import { describe, it, expect } from "vitest";
import { parseTimeseriesBalance } from "../../supabase/functions/_shared/yahoo";

/*
 * Yahoo's fundamentals-timeseries payload.
 *
 * Needed because quoteSummary's balanceSheetHistoryQuarterly has been gutted
 * upstream: it still returns one object per quarter, but each carries only
 * `maxAge` and `endDate` — every financial figure is stripped. That is why
 * fundamentals_balance held 664 rows with total_equity null in every one, and
 * why no stock on the site could display a ROE.
 *
 * The fixture below is the real shape, captured from the deployed function
 * (this machine is rate-limited by Yahoo), not invented:
 *
 *   result[i] = { meta: { type: ["quarterlyStockholdersEquity"] },
 *                 timestamp: [...],
 *                 quarterlyStockholdersEquity: [
 *                   { asOfDate, periodType, currencyCode,
 *                     reportedValue: { raw, fmt } } ] }
 */

const series = (type: string, rows: { date: string; raw: number | null }[]) => ({
  meta: { symbol: ["TECHM.NS"], type: [type] },
  timestamp: rows.map(() => 1743379200),
  [type]: rows.map((r) => ({
    dataId: 23215,
    asOfDate: r.date,
    periodType: "3M",
    currencyCode: "INR",
    ...(r.raw === null ? {} : { reportedValue: { raw: r.raw, fmt: "x" } }),
  })),
});

const payload = (...entries: unknown[]) => ({ timeseries: { result: entries } });

describe("parseTimeseriesBalance", () => {
  it("reads equity and assets onto the same period", () => {
    const rows = parseTimeseriesBalance(
      payload(
        series("quarterlyStockholdersEquity", [{ date: "2026-03-31", raw: 273615000000 }]),
        series("quarterlyTotalAssets", [{ date: "2026-03-31", raw: 500000000000 }]),
      ),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].periodEnd).toBe("2026-03-31");
    expect(rows[0].totalEquity).toBe(273615000000);
    expect(rows[0].totalAssets).toBe(500000000000);
  });

  it("keeps periods separate", () => {
    const rows = parseTimeseriesBalance(
      payload(
        series("quarterlyStockholdersEquity", [
          { date: "2026-03-31", raw: 2 },
          { date: "2025-12-31", raw: 1 },
        ]),
      ),
    );

    expect(rows.map((r) => r.periodEnd).sort()).toEqual(["2025-12-31", "2026-03-31"]);
  });

  it("leaves a series Yahoo did not return as null, not zero", () => {
    // Absent is not zero. computeRatios treats null as "cannot compute"; a 0
    // equity would make it divide by zero and a 0 debt would assert that a
    // company carries none.
    const rows = parseTimeseriesBalance(
      payload(series("quarterlyStockholdersEquity", [{ date: "2026-03-31", raw: 100 }])),
    );

    expect(rows[0].totalEquity).toBe(100);
    expect(rows[0].totalAssets).toBeNull();
    expect(rows[0].totalDebt).toBeNull();
    expect(rows[0].currentAssets).toBeNull();
  });

  it("skips an observation with no reported value", () => {
    const rows = parseTimeseriesBalance(
      payload(series("quarterlyStockholdersEquity", [{ date: "2026-03-31", raw: null }])),
    );
    expect(rows).toEqual([]);
  });

  it("ignores a period with no date rather than dating it today", () => {
    const rows = parseTimeseriesBalance(
      payload({
        meta: { type: ["quarterlyStockholdersEquity"] },
        quarterlyStockholdersEquity: [{ reportedValue: { raw: 5 } }],
      }),
    );
    expect(rows).toEqual([]);
  });

  it("returns nothing, and says nothing, for an empty or malformed payload", () => {
    // Distinguishable from a good parse by the caller: zero rows here means
    // Yahoo gave us nothing, which must be reported rather than written as a
    // row of nulls — that is exactly how the gutted module hid for weeks.
    expect(parseTimeseriesBalance({ timeseries: { result: [] } })).toEqual([]);
    expect(parseTimeseriesBalance({})).toEqual([]);
    expect(parseTimeseriesBalance(null)).toEqual([]);
  });
});

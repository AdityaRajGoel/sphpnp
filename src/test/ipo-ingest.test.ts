import { describe, it, expect } from "vitest";
import {
  sanitizeInvestorGainRows,
  sanitizeChittorgarhRows,
} from "../../supabase/functions/_shared/ipo-ingest";

/*
 * Guards for the JSON payload the ipo-browser-sync GitHub Actions workflow
 * POSTs to sync-ipos: rows already parsed by parseInvestorGain/parseChittorgarh
 * in a real browser, but still external input that crossed a network hop this
 * function does not control. The rules under test are the ones that keep a
 * malformed row from either corrupting the catalogue or taking down the whole
 * batch - never trust external data, even data this repo produced itself in a
 * different process.
 */

describe("sanitizeInvestorGainRows", () => {
  const validRow = {
    slug: "example-co",
    name: "Example Co",
    board: "mainboard",
    status: "open",
    gmp: 45,
    lot_size: 100,
    issue_size_crore: 250.5,
  };

  it("keeps a well-formed row unchanged", () => {
    expect(sanitizeInvestorGainRows([validRow])).toEqual([validRow]);
  });

  it("returns an empty array for non-array input", () => {
    expect(sanitizeInvestorGainRows(null)).toEqual([]);
    expect(sanitizeInvestorGainRows(undefined)).toEqual([]);
    expect(sanitizeInvestorGainRows("not an array")).toEqual([]);
    expect(sanitizeInvestorGainRows({ slug: "x" })).toEqual([]);
  });

  it("drops a row missing slug or name", () => {
    expect(sanitizeInvestorGainRows([{ ...validRow, slug: "" }])).toEqual([]);
    expect(sanitizeInvestorGainRows([{ ...validRow, name: undefined }])).toEqual([]);
  });

  it("drops a row with an unrecognised board or status", () => {
    // Silently defaulting an unknown board to "mainboard" is exactly the
    // fixed-column-order mistake documented on IpoWatchGmpRow in
    // ipo-parse.ts - an SME issue would be misfiled instead of dropped.
    expect(sanitizeInvestorGainRows([{ ...validRow, board: "nse" }])).toEqual([]);
    expect(sanitizeInvestorGainRows([{ ...validRow, status: "delisted" }])).toEqual([]);
  });

  it("drops non-object entries from the array without throwing", () => {
    expect(sanitizeInvestorGainRows([null, 42, "row", validRow])).toEqual([validRow]);
  });

  it("coerces a non-finite numeric field to null instead of passing it through", () => {
    const result = sanitizeInvestorGainRows([
      { ...validRow, gmp: Number.NaN, lot_size: "100", issue_size_crore: undefined },
    ]);
    expect(result).toEqual([{ ...validRow, gmp: null, lot_size: null, issue_size_crore: null }]);
  });
});

describe("sanitizeChittorgarhRows", () => {
  const validRow = {
    slug: "example-co",
    name: "Example Co",
    board: "sme",
    price_band_min: 90,
    price_band_max: 96,
    open_date: "2026-09-17",
    close_date: "2026-09-21",
    listing_date: "2026-09-26",
    issue_size_crore: 47.28,
    detail_url: "https://www.chittorgarh.com/ipo/example-co-ipo/2101/",
  };

  it("keeps a well-formed row unchanged", () => {
    expect(sanitizeChittorgarhRows([validRow])).toEqual([validRow]);
  });

  it("refuses a detail link that is not a Chittorgarh issue page", () => {
    // sync-ipo-details fetches this URL, so the payload must not be able to
    // point it anywhere else.
    for (const url of ["https://evil.example/ipo/x/1/", "http://www.chittorgarh.com/ipo/x/1/", "javascript:alert(1)"]) {
      expect(sanitizeChittorgarhRows([{ ...validRow, detail_url: url }])[0].detail_url).toBeNull();
    }
  });

  it("returns an empty array for non-array input", () => {
    expect(sanitizeChittorgarhRows(null)).toEqual([]);
    expect(sanitizeChittorgarhRows({})).toEqual([]);
  });

  it("drops a row missing slug or name, or with an unrecognised board", () => {
    expect(sanitizeChittorgarhRows([{ ...validRow, slug: null }])).toEqual([]);
    expect(sanitizeChittorgarhRows([{ ...validRow, board: "bse" }])).toEqual([]);
  });

  it("nulls out a malformed date instead of dropping the whole row", () => {
    // Chittorgarh is the primary source for issue facts (FIELD_PRECEDENCE in
    // ipo-reconcile.ts) - a stray bad field should cost that one field, not
    // the row's identity, price band, and every other date.
    const result = sanitizeChittorgarhRows([{ ...validRow, open_date: "17-Sep-2026" }]);
    expect(result).toEqual([{ ...validRow, open_date: null }]);
  });

  it("nulls out non-finite numeric fields", () => {
    const result = sanitizeChittorgarhRows([
      { ...validRow, price_band_min: "90", price_band_max: Number.NaN },
    ]);
    expect(result[0].price_band_min).toBeNull();
    expect(result[0].price_band_max).toBeNull();
  });
});

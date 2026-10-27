import { describe, it, expect } from "vitest";
import { parseChittorgarhApi, parseInvestorGainApi } from "../../supabase/functions/_shared/ipo-parse";

/*
 * Guards for the JSON behind InvestorGain's and Chittorgarh's IPO tables
 * (webnodejs.<site>.com), which sync-ipos reads directly instead of rendering
 * the pages in a browser. Rows are trimmed copies of the live responses of
 * 27 Oct 2026.
 */

const investorGainRow = {
  "~ipo_status1": "U",
  "~ipo_category1": "SME",
  Name: '<a href="/gmp/maxwell-engineering-solutions-ipo/2370/">Maxwell Engineering Solutions</a> <span class="badge">NSE SME</span><span class="badge">U</span>',
  GMP: '&#8377;<b>14</b> (8.86%)<br><small><b>0 ↓ / 0 ↑</b></small>',
  "Price (₹)": "158",
  "IPO Size": "&#8377;57.64 Cr",
  Lot: "800",
  "~Srt_Open": "2026-10-30",
  "~Srt_Close": "2026-11-03",
  "~ipo_name": "Maxwell Engineering Solutions",
};

describe("parseInvestorGainApi", () => {
  it("reads one row's identity, GMP, lot, size and dates", () => {
    const { rows, tablesMatched } = parseInvestorGainApi({ reportTableData: [investorGainRow] });

    expect(tablesMatched).toBe(1);
    expect(rows).toEqual([{
      slug: "maxwell-engineering-solutions",
      name: "Maxwell Engineering Solutions",
      board: "sme",
      status: "upcoming",
      gmp: 14,
      lot_size: 800,
      issue_size_crore: 57.64,
      price_band_max: 158,
      open_date: "2026-10-30",
      close_date: "2026-11-03",
    }]);
  });

  it("does not read the rupee entity's digits as the issue size", () => {
    // "&#8377;57.64 Cr": the first number in the raw text is 8377.
    const { rows } = parseInvestorGainApi({ reportTableData: [investorGainRow] });
    expect(rows[0].issue_size_crore).toBe(57.64);
  });

  it("treats an unquoted GMP as unknown, not zero", () => {
    const row = { ...investorGainRow, GMP: "&#8377;<b>--</b> (0.00%)" };
    expect(parseInvestorGainApi({ reportTableData: [row] }).rows[0].gmp).toBeNull();
  });

  it("maps the codes past the subscription window to closed and IPO to mainboard", () => {
    const rows = ["C", "CT", "LP", "LN"].map((code) => ({ ...investorGainRow, "~ipo_status1": code, "~ipo_category1": "IPO" }));
    const parsed = parseInvestorGainApi({ reportTableData: rows }).rows;
    // Same name four times collapses to one row; its status and board are what matter.
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({ status: "closed", board: "mainboard" });
  });

  it("reports no table when the response has no rows array", () => {
    expect(parseInvestorGainApi({ msg: 0 })).toEqual({ rows: [], tablesMatched: 0 });
  });
});

describe("parseChittorgarhApi", () => {
  const row = {
    Company: '<a href="https://www.chittorgarh.com/ipo/bombay-coated-and-special-steels-ipo/2671/" title="x">Bombay Coated &amp; Special Steels Ltd.</a> ',
    "Opening Date": "29-Oct-2026",
    "Closing Date": "02-Nov-2026",
    "Listing Date": "",
    "Issue Price (Rs.)": "78.00 to 82.00",
    "Issue Amount (Rs.cr.)": "183.06",
  };

  it("reads the price band, dates, size and the issue page link", () => {
    const { rows } = parseChittorgarhApi({ reportTableData: [row] }, "mainboard");

    expect(rows).toEqual([{
      slug: "bombay-coated-special-steels",
      name: "Bombay Coated & Special Steels",
      board: "mainboard",
      price_band_min: 78,
      price_band_max: 82,
      open_date: "2026-10-29",
      close_date: "2026-11-02",
      listing_date: null,
      issue_size_crore: 183.06,
      detail_url: "https://www.chittorgarh.com/ipo/bombay-coated-and-special-steels-ipo/2671/",
    }]);
  });

  it("follows only Chittorgarh's own issue pages", () => {
    const foreign = { ...row, Company: '<a href="https://evil.example/ipo/x/1/">Foreign Co Ltd.</a>' };
    expect(parseChittorgarhApi({ reportTableData: [foreign] }, "sme").rows[0].detail_url).toBeNull();
  });
});

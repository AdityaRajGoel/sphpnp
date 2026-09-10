import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseChittorgarhDetail, parseIndianDate, parseCroreAmount } from "../../supabase/functions/_shared/ipo-detail";
import { parseChittorgarh } from "../../supabase/functions/_shared/ipo-parse";

/*
 * Chittorgarh's per-issue page, captured 2026-09-10 for three issues: an
 * upcoming mainboard issue with an offer for sale (Jindal Supreme), a live
 * mainboard issue with anchor investors (Rentomojo) and an upcoming SME issue
 * (Axiom Gas Engineering).
 *
 * The list pages the IPO sync already reads carry a lot size and a price band
 * but no minimum investment - and lot x price is not the minimum: an SME
 * application must be at least two lots, so Axiom's minimum is Rs 2,12,000,
 * twice what one lot at the upper band would say. The rule under test is that
 * the minimum comes from the row the issue page publishes, never from
 * arithmetic.
 */

const page = (name: string) => readFileSync(`src/test/fixtures/ipo/chittorgarh-detail-${name}.html`, "utf-8");

describe("parseIndianDate", () => {
  it("reads Chittorgarh's weekday dates", () => {
    expect(parseIndianDate("Wed, Sep 16, 2026")).toBe("2026-09-16");
    expect(parseIndianDate("Fri, Sep 25, 2026 T")).toBe("2026-09-25");
    expect(parseIndianDate("not a date")).toBeNull();
  });
});

describe("parseCroreAmount", () => {
  it("reads the rupee-crore figure out of a share-count cell", () => {
    expect(parseCroreAmount("1,34,28,000 shares (agg. up to ₹ 125 Cr)")).toBe(125);
    expect(parseCroreAmount("3,10,80,978 shares (agg. up to ₹1,256 Cr)")).toBe(1256);
    expect(parseCroreAmount("4,02,82,620 shares")).toBeNull();
  });
});

describe("parseChittorgarhDetail - minimum investment", () => {
  it("takes a mainboard issue's retail minimum as published", () => {
    const d = parseChittorgarhDetail(page("jindal-supreme"));
    expect(d.facts.min_investment).toEqual({ category: "Retail", lots: 1, shares: 161, amount: 14973 });
  });

  it("takes an SME issue's two-lot minimum rather than one lot at the upper band", () => {
    const d = parseChittorgarhDetail(page("axiom-sme"));
    expect(d.facts.min_investment).toEqual({ category: "Individual investors (IND)", lots: 2, shares: 4000, amount: 212000 });
  });
});

describe("parseChittorgarhDetail - issue facts", () => {
  const d = parseChittorgarhDetail(page("jindal-supreme"));

  it("reads the issue structure", () => {
    expect(d.facts).toMatchObject({
      face_value: 10,
      issue_type: "Bookbuilding IPO",
      sale_type: "Fresh capital cum OFS",
      listing_exchanges: "BSE, NSE",
      issue_size_crore: 125,
      fresh_issue_crore: 100,
      ofs_crore: 25,
    });
  });

  it("reads the timetable", () => {
    expect(d.facts).toMatchObject({
      open_date: "2026-09-16",
      close_date: "2026-09-18",
      allotment_date: "2026-09-21",
      refund_date: "2026-09-22",
      credit_date: "2026-09-22",
      listing_date: "2026-09-23",
    });
  });

  it("reads the registrar and lead managers without the site's own links", () => {
    expect(d.facts.registrar).toBe("Bigshare Services Pvt.Ltd.");
    expect(d.facts.lead_managers).toEqual(["Sarthi Capital Advisors Pvt.Ltd."]);
  });

  it("lists every lead manager of a syndicated issue", () => {
    expect(parseChittorgarhDetail(page("rentomojo")).facts.lead_managers).toEqual([
      "Motilal Oswal Investment Advisors Ltd.", "Axis Capital Ltd.", "IIFL Capital Services Ltd.",
    ]);
  });

  it("reads promoter holding before and after the issue", () => {
    expect(d.facts).toMatchObject({ promoter_holding_pre: 100, promoter_holding_post: 73.68 });
  });
});

describe("parseChittorgarhDetail - every section", () => {
  it("keeps each section of the page with its tables and text", () => {
    const d = parseChittorgarhDetail(page("rentomojo"));
    const titles = d.sections.map((s) => s.title);
    for (const expected of [
      "IPO Details", "IPO Timetable (Tentative)", "Issue Reservation", "IPO Lot Size", "IPO Anchor Investors",
      "About Rentomojo Ltd.", "Company Financials (Restated)", "IPO Objects of the Issue",
      "Key Performance Indicator (KPI)", "IPO Valuation", "Shareholding Structure",
      "Offer For Sale - Selling Shareholders", "IPO Registrar", "IPO Lead Manager(s)",
    ]) expect(titles).toContain(expected);
    // The site's FAQ and message board are boilerplate, not facts about the issue.
    expect(titles.some((t) => /FAQ|Message Board/i.test(t))).toBe(false);
  });

  it("keeps a table's rows as the page prints them", () => {
    const fin = parseChittorgarhDetail(page("jindal-supreme")).sections.find((s) => s.title.startsWith("Company Financials"))!;
    expect(fin.tables[0][0]).toEqual(["Period Ended", "30 Jun 2026", "31 Mar 2026", "31 Mar 2025", "31 Mar 2024"]);
    expect(fin.tables[0].find((row) => row[0] === "Profit After Tax")).toEqual(["Profit After Tax", "8.28", "22.53", "24.27", "12.87"]);
  });

  it("folds the untitled continuation table into the section above it", () => {
    const details = parseChittorgarhDetail(page("jindal-supreme")).sections.find((s) => s.title === "IPO Details")!;
    const labels = details.tables.flat().map((row) => row[0]);
    expect(labels).toContain("Face Value");
    expect(labels).toContain("Fresh Issue");
  });

  it("ignores the site's menu headings that come before the issue's own sections", () => {
    const menu = "<h2>IPO Insights</h2><ul><li>Current IPOs</li></ul><h2>Stock Broker Reviews</h2><p>Zerodha</p><h2>About Chittorgarh City</h2><p>Fort</p>";
    const titles = parseChittorgarhDetail(menu + page("jindal-supreme")).sections.map((s) => s.title);
    expect(titles[0]).toBe("IPO Details");
    expect(titles).not.toContain("Stock Broker Reviews");
  });

  it("drops the site's navigation links from text sections", () => {
    const leads = parseChittorgarhDetail(page("rentomojo")).sections.find((s) => s.title === "IPO Lead Manager(s)")!;
    expect(leads.lines.some((l) => /Reports|Performance/.test(l))).toBe(false);
  });
});

describe("parseChittorgarh detail links", () => {
  it("keeps each list row's link to its issue page", () => {
    const html = readFileSync("src/test/fixtures/ipo/chittorgarh-mainboard.html", "utf-8");
    const jindal = parseChittorgarh(html, "mainboard").rows.find((r) => r.slug.startsWith("jindal-supreme"))!;
    expect(jindal.detail_url).toBe("https://www.chittorgarh.com/ipo/jindal-supreme-ipo/2803/");
  });
});

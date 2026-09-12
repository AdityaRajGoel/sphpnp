import { describe, it, expect } from "vitest";
import { compareInfographic, deriveSectionInfographic, parseAmount } from "@/lib/ipo-infographics";
import type { Ipo } from "@/lib/ipo";

// Every table below is copied verbatim from what sync-ipo-details stored for a
// live issue (manika-plastech, read 2026-09-12), so the guards are exercised
// against the real shapes rather than an idealized version of them.

const reservation = [
  ["Investor Category", "Shares", "% of Total Issue", "Max Allottees"],
  ["QIB", "1,45,93,023", "50.00%", "NA"],
  ["- Anchor Investor", "87,55,813", "30.00%", "NA"],
  ["- QIB (Ex. Anchor)", "58,37,210", "20.00%", "NA"],
  ["NII (HNI)", "43,77,907", "15.00%", "NA"],
  ["- bNII > ₹10L", "29,18,605", "10.00%", "599"],
  ["- sNII < ₹10L", "14,59,302", "5.00%", "299"],
  ["Retail", "1,02,15,116", "35.00%", "29,353"],
  ["Total", "2,91,86,046", "100.00%", ""],
];

const financials = [
  ["Period Ended", "30 Jun 2026", "31 Mar 2026", "31 Mar 2025", "31 Mar 2024"],
  ["Assets", "317.00", "323.69", "320.99", "252.93"],
  ["Total Income", "162.71", "437.26", "412.59", "368.76"],
  ["Profit After Tax", "13.07", "22.40", "19.33", "11.53"],
  ["EBITDA", "24.38", "58.14", "45.30", "30.86"],
  ["NET Worth", "156.78", "147.62", "125.17", "107.99"],
  ["Reserves and Surplus", "136.97", "127.69", "105.29", "88.05"],
  ["Total Borrowing", "92.46", "88.19", "97.45", "93.06"],
  ["Amount in ₹ Crore"],
];

const kpi = [
  ["KPI", "Jun 30, 2026", "Mar 31, 2026"],
  ["ROE", "8.34%", "15.18%"],
  ["Debt/Equity", "0.59", "0.60"],
  ["PAT Margin", "8.03%", "5.12%"],
  ["NAV", "16.50", "15.54"],
];

const shareholding = [
  ["Category", "Pre IPO", "Post IPO"],
  ["Promoter and Promoter Group", "100%", "74.95%"],
  ["Public", "", "25.05%"],
  ["Total", "100%", "100%"],
];

const objects = [
  ["#", "Issue Objects", "Est Amt (₹ Cr.)"],
  ["1", "Funding the capital expenditure towards purchase of plant and machinery", "54.93"],
  ["2", "Repayment and/or pre-payment of certain borrowings", "15.00"],
  ["3", "General Corporate Purposes", ""],
  ["", "Total", "69.93"],
];

const lotSize = [
  ["Application", "Lots", "Shares", "Amount"],
  ["Retail (Min)", "1", "348", "₹14,964"],
  ["Retail (Max)", "13", "4524", "₹1,94,532"],
  ["S-HNI (Min)", "14", "4872", "₹2,09,496"],
];

const section = (title: string, table: string[][]) => ({ title, tables: [table] });

describe("parseAmount", () => {
  it("reads Indian digit grouping, rupees and percent signs", () => {
    expect(parseAmount("2,91,86,046")).toBe(29186046);
    expect(parseAmount("₹1,94,532")).toBe(194532);
    expect(parseAmount("8.34%")).toBe(8.34);
    expect(parseAmount("-5.20")).toBe(-5.2);
  });

  it("rejects the cells that are not figures", () => {
    // "NA" and "" are what the page prints where a figure does not exist; a
    // parser that turned either into 0 would draw a bar claiming it does.
    for (const cell of ["NA", "", "—", "-", undefined]) expect(parseAmount(cell)).toBeNull();
  });
});

describe("deriveSectionInfographic", () => {
  it("charts the issue reservation without double-counting the indented breakdown", () => {
    const chart = deriveSectionInfographic(section("Issue Reservation", reservation));

    expect(chart?.kind).toBe("share");
    // QIB/NII/Retail only: the "- Anchor Investor" rows are a split of QIB and
    // the Total row is the whole, so including either would exceed 100%.
    expect(chart?.groups[0].bars.map((bar) => bar.label)).toEqual(["QIB", "NII (HNI)", "Retail"]);
    expect(chart?.groups[0].bars.reduce((sum, bar) => sum + bar.value, 0)).toBe(100);
  });

  it("refuses a share chart whose segments do not make up the whole", () => {
    const broken = reservation.map((row) => (row[0] === "Retail" ? [row[0], row[1], "5.00%", row[3]] : row));

    expect(deriveSectionInfographic(section("Issue Reservation", broken))).toBeNull();
  });

  it("charts financial lines oldest-first and only the chosen metrics", () => {
    const chart = deriveSectionInfographic(section("Company Financials (Restated Consolidated)", financials));

    expect(chart?.kind).toBe("magnitude");
    expect(chart?.groups.map((group) => group.label)).toEqual(["Total Income", "Profit After Tax", "EBITDA", "NET Worth"]);
    expect(chart?.groups[0].bars.map((bar) => bar.label)).toEqual(["31 Mar 2024", "31 Mar 2025", "31 Mar 2026", "30 Jun 2026"]);
    expect(chart?.groups[0].bars[0].display).toBe("368.76");
    // The page's own unit line, read rather than assumed.
    expect(chart?.caption).toContain("₹ crore");
  });

  it("keeps the KPI table's ratios and rupee figures out of the percentage bars", () => {
    const chart = deriveSectionInfographic(section("Key Performance Indicator (KPI)", kpi));

    expect(chart?.groups.map((group) => group.label)).toEqual(["ROE", "PAT Margin"]);
  });

  it("charts pre- and post-issue holding as separate wholes", () => {
    const chart = deriveSectionInfographic(section("Shareholding Structure", shareholding));

    expect(chart?.kind).toBe("share");
    expect(chart?.groups.map((group) => group.label)).toEqual(["Pre IPO", "Post IPO"]);
    expect(chart?.groups[1].bars.map((bar) => bar.label)).toEqual(["Promoter and Promoter Group", "Public"]);
  });

  it("drops the total row and the object with no published amount", () => {
    const chart = deriveSectionInfographic(section("IPO Objects of the Issue", objects));

    expect(chart?.groups[0].bars.map((bar) => bar.value)).toEqual([54.93, 15]);
    expect(chart?.caption).toContain("₹ Cr.");
  });

  it("charts what each application category costs", () => {
    const chart = deriveSectionInfographic(section("IPO Lot Size", lotSize));

    expect(chart?.groups[0].bars[0].display).toBe("₹14,964");
    expect(chart?.groups[0].bars).toHaveLength(3);
  });

  it("returns null for sections it has no honest chart for", () => {
    // The overwhelming majority: registrar, lead managers, anchor investors,
    // contact details. These render as the table alone, as they always have.
    expect(deriveSectionInfographic(section("IPO Registrar", []))).toBeNull();
    expect(deriveSectionInfographic({ title: "IPO Anchor Investors", tables: [[["Bid Date", "12 Sep 2026"]]] })).toBeNull();
    expect(deriveSectionInfographic(section("Company Financials", [["Amount in ₹ Crore"]]))).toBeNull();
  });
});

describe("part periods", () => {
  it("marks the stub column beside full years and says so in the caption", () => {
    // "30 Jun 2026" is three months of trading; the years around it are
    // twelve. Undrawn distinctions like this are how a chart lies while every
    // number in it is correct.
    const chart = deriveSectionInfographic({ title: "Company Financials", tables: [financials] });
    const income = chart!.groups[0].bars;

    expect(income.filter((bar) => bar.partial).map((bar) => bar.label)).toEqual(["30 Jun 2026"]);
    expect(chart?.caption).toContain("part period");
  });

  it("marks nothing when every column is the same kind of period", () => {
    const annualOnly = financials.map((row) => (row[0] === "Period Ended" ? ["Period Ended", "31 Mar 2026", "31 Mar 2025", "31 Mar 2024"] : row.slice(0, 4)));

    const chart = deriveSectionInfographic({ title: "Company Financials", tables: [annualOnly] });

    expect(chart!.groups.flatMap((group) => group.bars).some((bar) => bar.partial)).toBe(false);
    expect(chart?.caption).not.toContain("part period");
  });

  it("marks the KPI table's stub column too, whatever the date format", () => {
    // The KPI table writes "Jun 30, 2026" where the financials table writes
    // "30 Jun 2026" - same period, two formats, one rule.
    const chart = deriveSectionInfographic({ title: "Key Performance Indicator (KPI)", tables: [kpi] });

    expect(chart!.groups[0].bars.filter((bar) => bar.partial).map((bar) => bar.label)).toEqual(["Jun 30, 2026"]);
  });
});

describe("compareInfographic", () => {
  // The compare dialog's own fixture shape, copied from ipo-filters.test.ts so
  // the two stay independent.
  const makeIpo = (overrides: Partial<Ipo>): Ipo => ({
    id: overrides.slug ?? "id",
    slug: "acme",
    name: "Acme Industries",
    board: "mainboard",
    type: "Mainboard",
    status: "open",
    price_band_min: 100,
    price_band_max: 110,
    price: "₹100–110",
    lot_size: 100,
    issue_size_crore: 500,
    size: "₹500 Cr",
    open_date: "2026-09-10",
    close_date: "2026-09-12",
    date: "10 Sep 2026 – 12 Sep 2026",
    allotment_date: null,
    listing_date: "2026-09-17",
    registrar: null,
    rhp_url: null,
    drhp_url: null,
    subscription_qib: null,
    subscription_nii: null,
    subscription_retail: null,
    listing_price: null,
    listing_gain_pct: null,
    source: "chittorgarh",
    source_url: null,
    data_as_of: "2026-09-10T00:00:00Z",
    gmp: 50,
    est_listing_price: null,
    gmp_history: [],
    field_sources: null,
    detail_url: null, min_investment: null, min_investment_lots: null, min_investment_shares: null,
    min_investment_category: null, face_value: null, issue_type: null, sale_type: null, listing_exchanges: null,
    fresh_issue_crore: null, ofs_crore: null, refund_date: null, credit_date: null, lead_managers: null,
    promoter_holding_pre: null, promoter_holding_post: null, details: null, details_source: null, details_fetched_at: null,
    subscription_total: null, subscription_employee: null, subscription_categories: null, subscription_as_of: null,
    documents: null, news: null, news_fetched_at: null,
    ...overrides,
  });

  it("charts only the measures where at least two issues have a figure", () => {
    const chart = compareInfographic([
      makeIpo({ slug: "a", name: "Alpha", gmp: 22, price_band_max: 110, subscription_total: 4.1, min_investment: 15000 }),
      makeIpo({ slug: "b", name: "Beta", gmp: -5, price_band_max: 100, subscription_total: 1.2, min_investment: 28000 }),
    ]);

    expect(chart?.groups.map((group) => group.label)).toEqual(["GMP %", "Subscribed", "Min. investment"]);
    // A negative GMP keeps its sign so the bar can be drawn the other colour.
    expect(chart?.groups[0].bars[1].value).toBeCloseTo(-5);
  });

  it("leaves an issue with no figure out of that row rather than drawing it as zero", () => {
    // An issue that has not opened has no subscription. Zero would say nobody
    // applied, which is a different and false statement.
    const chart = compareInfographic([
      makeIpo({ slug: "a", name: "Alpha", subscription_total: 4.1, min_investment: 15000 }),
      makeIpo({ slug: "b", name: "Beta", subscription_total: 1.2, min_investment: null }),
      makeIpo({ slug: "c", name: "Gamma", status: "upcoming", subscription_total: null, min_investment: 20000 }),
    ]);

    expect(chart?.groups.find((group) => group.label === "Subscribed")?.bars.map((bar) => bar.label)).toEqual(["Alpha", "Beta"]);
    // Min. investment survives with Alpha and Gamma; Beta has none.
    expect(chart?.groups.find((group) => group.label === "Min. investment")?.bars.map((bar) => bar.label)).toEqual(["Alpha", "Gamma"]);
  });

  it("draws nothing for a single selection", () => {
    expect(compareInfographic([makeIpo({ slug: "a" })])).toBeNull();
  });
});

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fortnightlyReportLinks, parseFpiDaily, parseFpiSectorFortnightly, parseMospi, withYoy, parseNseEventCalendar, parseBseResultsCalendar } from "../../supabase/functions/_shared/market-extra";

const text = (name: string) => readFileSync(`src/test/fixtures/nse-market/${name}`, "utf-8");
const json = (name: string) => JSON.parse(text(name));

describe("parseFpiDaily", () => {
  const rows = parseFpiDaily(text("nsdl_latest.html"));

  it("reads cash flows by category and route, carrying the spanned category down", () => {
    expect(rows.find((r) => r.section === "cash" && r.category === "Equity" && r.route === "Stock Exchange")).toMatchObject({
      report_date: "2026-09-11", buy_cr: 12479.22, sell_cr: 12706.35, net_cr: -227.13, net_usd_mn: -23.85,
    });
    expect(rows.find((r) => r.category === "Equity" && r.route === "Sub-total")?.net_cr).toBe(-226.08);
    expect(rows.find((r) => r.category === "Debt-VRR" && r.route === "Primary market & others")?.net_cr).toBe(799.87);
    expect(rows.find((r) => r.category === "Total")).toMatchObject({ route: "Total", net_cr: -500.63 });
    expect(rows.filter((r) => r.category === "AIFs").map((r) => r.route)).toEqual(["Stock Exchange", "Primary market & others", "Sub-total"]);
  });

  it("reads derivatives by product", () => {
    expect(rows.find((r) => r.section === "derivatives" && r.category === "Index Futures")).toMatchObject({
      buy_contracts: 8086, buy_cr: 1272.56, sell_contracts: 13761, oi_contracts: 362634, oi_cr: 56936.38,
    });
  });
});

describe("parseFpiSectorFortnightly", () => {
  // NSDL's report for Aug 31, 2026: custody on Aug 15, net flows for Aug 1-15
  // and Aug 16-31, custody on Aug 31 - in rupees and dollars, by asset class.
  const page = text("nsdl-fpi-sector-2026-08-31.html");
  const rows = parseFpiSectorFortnightly(page);

  it("gives each sector two fortnights, pairing net flows with the custody figure the fortnight ends on", () => {
    expect(rows.find((r) => r.sector === "Automobile and Auto Components" && r.fortnight_end === "2026-08-15")).toEqual({
      fortnight_end: "2026-08-15", sector: "Automobile and Auto Components",
      equity_net_cr: 4405, debt_net_cr: -12, other_net_cr: 0, total_net_cr: 4393,
      equity_net_usd_mn: 462, total_net_usd_mn: 461,
      equity_auc_cr: 557414, total_auc_cr: 557804, total_auc_usd_mn: 58454,
    });
    expect(rows.find((r) => r.sector === "Automobile and Auto Components" && r.fortnight_end === "2026-08-31")).toMatchObject({
      equity_net_cr: -1299, debt_net_cr: -3, total_net_cr: -1302, equity_net_usd_mn: -136, equity_auc_cr: 548262, total_auc_cr: 548620, total_auc_usd_mn: 57476,
    });
  });

  it("reads all 24 sectors and the grand total, unescaping names", () => {
    const sectors = new Set(rows.map((r) => r.sector));
    expect(sectors.size).toBe(25);
    expect(sectors.has("Metals & Mining")).toBe(true);
    expect(sectors.has("Total")).toBe(true);
    expect(rows).toHaveLength(50);
    expect(rows.find((r) => r.sector === "Total" && r.fortnight_end === "2026-08-15")?.equity_auc_cr).toBe(7086402);
  });

  it("reads nothing from a page without the sector table", () => {
    expect(parseFpiSectorFortnightly("<table><tr><td>x</td></tr></table>")).toEqual([]);
  });

  it("lists the report pages the selection form offers, and nothing else", () => {
    const links = fortnightlyReportLinks(page);
    expect(links[0]).toEqual({ date: "2026-08-31", url: "https://www.fpi.nsdl.co.in/web/StaticReports/Fortnightly_Sector_wise_FII_Investment_Data/FIIInvestSector_Aug312026.html" });
    expect(links.map((l) => l.date)).toContain("2026-06-30");
    expect(links.every((l) => l.url.startsWith("https://www.fpi.nsdl.co.in/web/StaticReports/"))).toBe(true);
    expect(links).toHaveLength(6);
  });
});

describe("parseMospi", () => {
  it("keeps the headline CPI, IIP and WPI series", () => {
    const cpi = parseMospi(json("mospi_cpi.json"), "cpi");
    expect(cpi.every((r) => r.series === "CPI (Combined)")).toBe(true);
    const iip = parseMospi(json("mospi_iip.json"), "iip");
    expect(iip[0]).toEqual({ series: "IIP (General)", period: "2026-03-01", value: 173.2, change_pct: 4.1, source: "mospi" });
    const wpi = parseMospi(json("mospi_wpi.json"), "wpi");
    expect(wpi[0]).toMatchObject({ series: "WPI (All commodities)", period: "2026-04-01", value: 167 });
  });

  it("derives year-on-year change where the source gives only the index", () => {
    const rows = withYoy([
      { series: "WPI", period: "2025-04-01", value: 160, change_pct: null, source: "mospi" },
      { series: "WPI", period: "2026-04-01", value: 168, change_pct: null, source: "mospi" },
    ]);
    expect(rows[1].change_pct).toBe(5);
  });
});

describe("calendars", () => {
  it("reads NSE board meetings and BSE results dates", () => {
    expect(parseNseEventCalendar(json("event_calendar.json"))[0]).toMatchObject({ symbol: "RMC", event_date: "2026-09-12", purpose: "Other business matters", source: "nse" });
    const bse = parseBseResultsCalendar(json("bse_results_calendar.json"), new Map([["517330", "CMI"]]));
    expect(bse[0]).toMatchObject({ symbol: "CMI", company: "CMI Ltd", event_date: "2026-09-11", source: "bse" });
    expect(bse[1].symbol).toBeNull();
  });
});

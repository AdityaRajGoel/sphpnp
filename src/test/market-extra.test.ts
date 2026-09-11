import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseFpiDaily, parseMospi, withYoy, parseNseEventCalendar, parseBseResultsCalendar } from "../../supabase/functions/_shared/market-extra";

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

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  num, isoDate, csvRows, parseIndexCloseAll, parseParticipantOi, parseNseBhavdataFull, parseBseBhavcopy, parsePledges,
  parseDeals, parseNseIpos, priceRange, parseWeek52, parseMovers, parseConstituents, parseLotSizes, parseFoBan, parseAsm,
  parseGsm, weekdaysBack, ddmmyyyy, yyyymmdd,
} from "../../supabase/functions/_shared/market-files";

/* NSE and BSE files and market JSON, captured 2026-09-11 (src/test/fixtures/nse-market). */

const text = (name: string) => readFileSync(`src/test/fixtures/nse-market/${name}`, "utf-8");
const json = (name: string) => JSON.parse(text(name));

describe("value readers", () => {
  it("reads the number forms the exchanges print", () => {
    expect(num(".2")).toBe(0.2);
    expect(num("-.44")).toBe(-0.44);
    expect(num("(227.13)")).toBe(-227.13);
    expect(num("12,479.22")).toBe(12479.22);
    expect(num("2.1386919E7")).toBe(21386919);
    expect(num("    45.04")).toBe(45.04);
    expect(num("-")).toBeNull();
  });

  it("reads the date forms the exchanges print", () => {
    expect(isoDate("10-09-2026")).toBe("2026-09-10");
    expect(isoDate("10-SEP-2026")).toBe("2026-09-10");
    expect(isoDate("Sep 10, 2026")).toBe("2026-09-10");
    expect(isoDate("11 Sep 2026")).toBe("2026-09-11");
    expect(isoDate("2026-09-10")).toBe("2026-09-10");
  });

  it("splits CSV honouring quotes", () => {
    expect(csvRows('"a, b",c\n"d ""e""",f')).toEqual([["a, b", "c"], ['d "e"', "f"]]);
  });

  it("names archive files by date and lists weekdays back", () => {
    expect(ddmmyyyy("2026-09-10")).toBe("10092026");
    expect(yyyymmdd("2026-09-10")).toBe("20260910");
    expect(weekdaysBack("2026-09-14", 3)).toEqual(["2026-09-14", "2026-09-11", "2026-09-10"]);
  });
});

describe("parseIndexCloseAll", () => {
  it("reads each index's close with its P/E, P/B and dividend yield", () => {
    const rows = parseIndexCloseAll(text("ind_close_all.csv"));
    expect(rows.length).toBeGreaterThan(50);
    expect(rows[0]).toEqual({
      index_name: "Nifty 50", trade_date: "2026-09-10", open: 23446.6, high: 23494.95, low: 23380.1, close: 23477.8,
      change_pct: 0.2, volume: 253250004, turnover_cr: 19852.15, pe: 19.85, pb: 2.84, div_yield: 1.21,
    });
  });
});

describe("parseParticipantOi", () => {
  it("dates the file from its title and reads each participant's positions", () => {
    const rows = parseParticipantOi(text("participant_oi.csv"));
    expect(rows.map((r) => r.client_type)).toEqual(["Client", "DII", "FII", "Pro", "Total"]);
    expect(rows[0]).toMatchObject({ trade_date: "2026-09-10", fut_idx_long: 286829, fut_idx_short: 55858, fut_stk_short: 214728, total_short: 9624565 });
  });
});

describe("daily prices", () => {
  it("reads NSE's full bhavcopy with delivery", () => {
    const rows = parseNseBhavdataFull(text("nse_bhavdata_full.csv"));
    expect(rows.find((r) => r.symbol === "INFY")).toMatchObject({ exchange: "NSE", series: "EQ", trade_date: "2026-09-10", open: 1039.6, close: 1036.5, volume: 8998529, deliv_pct: 58.35 });
  });

  it("reads BSE's bhavcopy for tracked scrips under their NSE symbol", () => {
    const rows = parseBseBhavcopy(text("bse_bhavcopy.csv"), new Map([["500002", "ABB"], ["500325", "RELIANCE"]]));
    expect(rows.map((r) => r.symbol).sort()).toEqual(["ABB", "RELIANCE"]);
    expect(rows.find((r) => r.symbol === "ABB")).toMatchObject({ exchange: "BSE", trade_date: "2026-09-10", close: 7330, prev_close: 7393.3 });
  });
});

describe("parsePledges", () => {
  it("reads promoter holding and the share of it pledged", () => {
    const row = parsePledges(json("pledge.json")).find((r) => r.company === "20 Microns Limited")!;
    expect(row).toMatchObject({ shp_date: "2026-06-30", promoter_pct: 45.04, pledged_shares: 1600437, pledged_pct_of_total: 4.54 });
    expect(row.pledged_pct_of_promoter).toBeCloseTo((1600437 / 15893364) * 100, 5);
  });
});

describe("parseDeals", () => {
  it("keys each deal by its fields and reads its side", () => {
    const bulk = parseDeals(json("deals_bulk.json"), "bulk");
    expect(bulk[0]).toMatchObject({ trade_date: "2026-09-04", kind: "bulk", symbol: "AARADHYA", client: "NARESH KUMAR BANSAL", side: "sell", quantity: 350400, price: 105.05 });
    expect(new Set(bulk.map((d) => d.deal_key)).size).toBe(bulk.length);
    expect(parseDeals(json("deals_short.json"), "short")[0]).toMatchObject({ kind: "short", symbol: "ADANIENT", quantity: 311, side: "sell" });
  });
});

describe("parseNseIpos", () => {
  const ipos = parseNseIpos(json("ipo_current.json"), json("ipo_upcoming.json"), json("ipo_past.json"), "2026-09-11");

  it("reads the exchange's price band and subscription so far", () => {
    expect(ipos.find((i) => i.symbol === "MPIMANIPAL")).toMatchObject({
      company: "Manipal Payment and Identity Solutions Limited", status: "open", issue_start: "2026-09-09", issue_end: "2026-09-11",
      price_band_min: 322, price_band_max: 339,
    });
    expect(ipos.find((i) => i.symbol === "MPIMANIPAL")!.subscription_times).toBeCloseTo(0.872, 3);
  });

  it("reads past issues and ranges", () => {
    expect(ipos.find((i) => i.symbol === "GLASSWALL")).toMatchObject({ status: "closed", price_band_max: 182 });
    expect(priceRange("Rs.40 to Rs.43")).toEqual([40, 43]);
    expect(priceRange("-")).toEqual([null, null]);
  });
});

describe("other NSE lists", () => {
  it("reads adjusted 52-week levels", () => {
    const rows = parseWeek52(text("wk52.csv"));
    expect(rows[0].as_of).toBe("2026-09-11");
    expect(rows.find((r) => r.symbol === "RELIANCE")?.adj_high).toBeGreaterThan(0);
  });

  it("reads movers by value and by volume", () => {
    expect(parseMovers(json("movers_value.json"), "value").movers[0]).toMatchObject({ symbol: "PINELABS", price: 198.85, change_pct: 14.83 });
    expect(parseMovers(json("movers_volume.json"), "volume").movers[0]).toMatchObject({ symbol: "KIRLOSIND", volume: 639315 });
  });

  it("reads an index's constituents", () => {
    const rows = parseConstituents(text("constituents_nifty50.csv"), "NIFTY 50");
    expect(rows).toHaveLength(50);
    expect(rows[0]).toMatchObject({ index_name: "NIFTY 50", symbol: "ADANIENT", industry: "Metals & Mining" });
  });

  it("reads the nearest month's F&O lot size", () => {
    const lots = parseLotSizes(text("fo_mktlots.csv"));
    expect(lots.find((l) => l.symbol === "NIFTY")?.lot_size).toBe(65);
    expect(lots.find((l) => l.symbol === "SYMBOL")).toBeUndefined();
  });

  it("reads the F&O ban list and ASM/GSM stages", () => {
    const ban = parseFoBan(text("fo_secban.csv"));
    expect(ban.map((b) => b.symbol)).toEqual(["BANDHANBNK", "INOXWIND", "KAYNES", "MANAPPURAM", "SAIL"]);
    expect(ban[0]).toMatchObject({ flag: "fo_ban", as_of: "2026-09-11" });
    const asm = parseAsm(json("asm.json"));
    expect(asm.some((a) => a.flag === "asm_long" && a.stage === "Stage I")).toBe(true);
    expect(asm.some((a) => a.flag === "asm_short")).toBe(true);
    expect(parseGsm(json("gsm.json"))[0]).toMatchObject({ flag: "gsm", symbol: "AGSTRA" });
  });
});

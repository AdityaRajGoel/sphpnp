import { describe, it, expect, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import type { MetricRow } from "@/lib/screener-metrics";
import type { FundamentalsSummary } from "@/lib/screener-fundamentals";
import { median, sectorPeers } from "@/lib/stock-peers";
import { buildChecklist, tally } from "@/lib/stock-checklist";
import { csvCell, statementFileName, statementToCsv } from "@/lib/statement-csv";

const row = (symbol: string, sector: string, market_cap: number, pe: number, f: Partial<FundamentalsSummary> = {}): MetricRow => ({
  symbol,
  quote: { symbol, name: symbol, sector, price: 100, change_pct: 0, volume: 0, pe, market_cap, high_52: 120, low_52: 80 },
  fundamentals: {
    symbol, source: "screener_in", roe: null, roce: null, opm: null, sales_growth_yoy: null, profit_growth_yoy: null,
    debt_to_equity: null, pb: null, dividend_yield: null, eps_ttm: null, latest_quarter: null, ...f,
  } as FundamentalsSummary,
  risk: null,
  scores: null,
  factors: null,
});

describe("sectorPeers", () => {
  const universe = new Map<string, MetricRow>();
  for (let i = 0; i < 10; i++) universe.set(`IT${i}`, row(`IT${i}`, "IT", 10_000 - i * 1000, i === 3 ? -5 : 20 + i));
  universe.set("BANK", row("BANK", "Banks", 99_999, 12));

  it("keeps the stock in view even when it is the smallest in its sector", () => {
    const peers = sectorPeers(universe, "it9", 5)!;
    expect(peers.rows.map((r) => r.symbol)).toEqual(["IT0", "IT1", "IT2", "IT3", "IT9"]);
    expect(peers.size).toBe(10);
    expect(peers.rows.some((r) => r.symbol === "BANK")).toBe(false);
  });

  it("takes the P/E median over profitable companies only", () => {
    // P/Es 20,21,22,24..29 without the loss-maker -> median of 9 values is 25.
    expect(sectorPeers(universe, "IT0")!.median.pe).toBe(25);
  });

  it("returns nothing for a stock alone in its sector or unknown", () => {
    expect(sectorPeers(universe, "BANK")).toBeNull();
    expect(sectorPeers(universe, "NOPE")).toBeNull();
    expect(median([null, 3, 1])).toBe(2);
  });
});

describe("buildChecklist", () => {
  it("judges each figure against its stated lines and skips what is missing", () => {
    const items = buildChecklist(row("X", "IT", 1, 10, { roe: 22, debt_to_equity: 2, opm: 10 }), 25);
    const byId = Object.fromEntries(items.map((i) => [i.id, i.verdict]));
    expect(byId).toEqual({ roe: "pass", opm: "neutral", de: "fail", pe_vs_sector: "pass" });
    expect(tally(items)).toEqual({ pass: 2, neutral: 1, fail: 1 });
    expect(items.find((i) => i.id === "de")!.detail).toMatch(/fail above 1.5/);
  });

  it("does not judge a loss-maker's P/E or run without a sector median", () => {
    expect(buildChecklist(row("X", "IT", 1, -4), 25).some((i) => i.id === "pe_vs_sector")).toBe(false);
    expect(buildChecklist(row("X", "IT", 1, 10), null).some((i) => i.id === "pe_vs_sector")).toBe(false);
    expect(buildChecklist(undefined)).toEqual([]);
  });
});

describe("statement CSV", () => {
  it("quotes cells and defuses spreadsheet formulas", () => {
    expect(csvCell('Sales, "net"')).toBe('"Sales, ""net"""');
    expect(csvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell(-12.5)).toBe("-12.5");
    expect(csvCell(null)).toBe("");
  });

  it("lays a grid out oldest period first with blank cells for gaps", () => {
    const csv = statementToCsv({
      statement: "yoy_results", periods: ["Mar 2024", "Mar 2025"], period_ends: [null, null],
      rows: [{ label: "Sales", values: [100, 120] }, { label: "OPM %", values: [null, 18] }],
      verified: true, fetched_at: "2025-01-01",
    });
    expect(csv.split("\r\n")).toEqual(["Line item (Rs crore),Mar 2024,Mar 2025", "Sales,100,120", "OPM %,,18"]);
    expect(statementFileName("m&m", "yoy_results")).toBe("M&M-yoy_results.csv");
    expect(statementFileName("../x", "a/b")).toBe("X-ab.csv");
  });
});

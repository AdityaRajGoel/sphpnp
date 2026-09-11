import { supabase } from "@/integrations/supabase/client";

/**
 * The screener's fundamentals columns (stock_fundamentals_summary), built daily
 * from stored statements by build-screener-fundamentals. Every figure may be
 * null: a stock whose source does not report it shows a dash, never a zero.
 */
export type FundamentalsSummary = {
  symbol: string;
  source: "indianapi" | "screener_in" | "google_finance";
  roe: number | null;
  roce: number | null;
  opm: number | null;
  sales_growth_yoy: number | null;
  profit_growth_yoy: number | null;
  debt_to_equity: number | null;
  pb: number | null;
  dividend_yield: number | null;
  eps_ttm: number | null;
  latest_quarter: string | null;
};

export type FundamentalsKey = Exclude<keyof FundamentalsSummary, "symbol" | "source" | "latest_quarter">;

export const FUNDAMENTAL_COLUMNS: { key: FundamentalsKey; label: string; title: string; kind: "pct" | "ratio" | "rupees" }[] = [
  { key: "roe", label: "ROE", title: "Return on equity, latest fiscal year", kind: "pct" },
  { key: "roce", label: "ROCE", title: "Return on capital employed, latest fiscal year", kind: "pct" },
  { key: "opm", label: "OPM", title: "Operating margin, latest quarter", kind: "pct" },
  { key: "sales_growth_yoy", label: "Sales YoY", title: "Latest quarter's revenue against the same quarter a year earlier", kind: "pct" },
  { key: "profit_growth_yoy", label: "Profit YoY", title: "Latest quarter's net profit against the same quarter a year earlier", kind: "pct" },
  { key: "debt_to_equity", label: "D/E", title: "Borrowings over shareholders' equity, latest fiscal year", kind: "ratio" },
  { key: "pb", label: "P/B", title: "Price to book value", kind: "ratio" },
  { key: "dividend_yield", label: "Div. yield", title: "Dividend yield, trailing twelve months", kind: "pct" },
  { key: "eps_ttm", label: "EPS (TTM)", title: "Earnings per share, trailing twelve months", kind: "rupees" },
];

export const SOURCE_LABEL: Record<FundamentalsSummary["source"], string> = {
  indianapi: "IndianAPI",
  screener_in: "screener.in",
  google_finance: "Google Finance",
};

export function formatFundamental(value: number | null, kind: "pct" | "ratio" | "rupees"): string {
  if (value === null || !Number.isFinite(value)) return "—";
  if (kind === "pct") return `${value.toFixed(1)}%`;
  if (kind === "rupees") return `₹${value.toFixed(2)}`;
  return value.toFixed(2);
}

/** Growth and returns read as good or bad at a glance; ratios carry no colour. */
export const toneOf = (key: FundamentalsKey, value: number | null): "up" | "down" | null =>
  value === null || !["sales_growth_yoy", "profit_growth_yoy", "roe", "roce"].includes(key) ? null : value >= 0 ? "up" : "down";

/** Sort by one column; stocks without the figure go last in either direction. */
export function sortByFundamental<T extends { symbol: string }>(
  rows: T[],
  summaries: Map<string, FundamentalsSummary>,
  key: FundamentalsKey,
  dir: "asc" | "desc",
): T[] {
  const value = (row: T) => summaries.get(row.symbol)?.[key] ?? null;
  return [...rows].sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    if (va === null && vb === null) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    return dir === "asc" ? va - vb : vb - va;
  });
}

export type FundamentalScreen = { id: string; name: string; desc: string; test: (s: FundamentalsSummary) => boolean };

/** Ready-made fundamental screens. A stock missing a figure a screen needs does not pass it. */
export const FUNDAMENTAL_SCREENS: FundamentalScreen[] = [
  { id: "quality", name: "Quality", desc: "ROE above 15%, D/E below 0.5", test: (s) => s.roe !== null && s.roe > 15 && s.debt_to_equity !== null && s.debt_to_equity < 0.5 },
  { id: "growth", name: "Growth", desc: "Sales and profit up 20%+ YoY", test: (s) => (s.sales_growth_yoy ?? -Infinity) >= 20 && (s.profit_growth_yoy ?? -Infinity) >= 20 },
  { id: "dividend", name: "Dividend", desc: "Yield above 2%", test: (s) => (s.dividend_yield ?? 0) > 2 },
  { id: "debt_free", name: "Low debt", desc: "D/E below 0.1", test: (s) => s.debt_to_equity !== null && s.debt_to_equity < 0.1 },
];

export async function getFundamentalsSummaries(): Promise<Map<string, FundamentalsSummary>> {
  const { data, error } = await (supabase.from("stock_fundamentals_summary" as never) as ReturnType<typeof supabase.from>)
    .select("symbol,source,roe,roce,opm,sales_growth_yoy,profit_growth_yoy,debt_to_equity,pb,dividend_yield,eps_ttm,latest_quarter")
    .limit(1000);
  if (error) throw new Error(error.message);
  return new Map(((data ?? []) as unknown as FundamentalsSummary[]).map((row) => [row.symbol, row]));
}

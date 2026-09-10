// Parsers for SerpApi's Google Finance engine (engine=google_finance, q=SYMBOL:NSE).
//
// The fallback for stocks IndianAPI cannot cover: it returned no key metrics
// for M&M, no NSE code to verify for DIVISLAB, and it rate-limits. One search
// returns key stats plus quarterly and annual income statement, balance sheet
// and cash flow. Metered at 250 searches a month on the free plan, so the sync
// spends it only on those gaps (see sync-google-finance).
//
// Amounts arrive in rupees and are stored in crore, the unit IndianAPI's
// statements use, so the page renders both the same way. Percentages, per-share
// figures, ratios and share counts keep their own units.
//
// Pure: no fetch, no Deno APIs.

import type { Statement } from "./indianapi.ts";

export type GoogleFinanceKind =
  | "gf_income_quarterly" | "gf_income_annual"
  | "gf_balance_quarterly" | "gf_balance_annual"
  | "gf_cashflow_quarterly" | "gf_cashflow_annual";

export type KeyStats = {
  pe: number | null;
  eps: number | null;
  dividend_yield_pct: number | null;
  market_cap_crore: number | null;
  high_52: number | null;
  low_52: number | null;
  shares_outstanding: number | null;
  employees: number | null;
  price: number | null;
  as_of: string | null;
};

const CRORE = 1e7;
const SCALE: Record<string, number> = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** "3.78T" -> 3.78e12, "₹3,839.90" -> 3839.9, "1.06%" -> 1.06, "—" -> null. */
export function parseScaledNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const match = /(-?[\d,]*\.?\d+)\s*([KMBT])?/i.exec(value.replace(/[₹$\s]/g, ""));
  if (!match) return null;
  const n = Number(match[1].replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  const scale = match[2] ? SCALE[match[2].toUpperCase()] : 1;
  // Keep decimal noise out of scaled figures: 3.78 * 1e12 is 3780000000000.0005.
  return match[2] ? Math.round(n * scale) : n;
}

export type Check = { ok: true } | { ok: false; reason: string };

/** Google resolves a query to one listing and names it; it must be the NSE listing of this symbol. */
export function verifyGoogleFinance(response: unknown, symbol: string): Check {
  const summary = isRecord(response) && isRecord(response.summary) ? response.summary : null;
  const stock = typeof summary?.stock === "string" ? summary.stock.toUpperCase() : "";
  const exchange = typeof summary?.exchange === "string" ? summary.exchange.toUpperCase() : "";
  if (!stock) return { ok: false, reason: "response names no stock" };
  if (exchange !== "NSE") return { ok: false, reason: `resolved to ${stock} on ${exchange || "an unknown exchange"}, not NSE` };
  return stock === symbol.toUpperCase() ? { ok: true } : { ok: false, reason: `resolved to ${stock}, not ${symbol.toUpperCase()}` };
}

export function parseKeyStats(response: unknown): KeyStats {
  const graph = isRecord(response) && isRecord(response.knowledge_graph) ? response.knowledge_graph : {};
  const stats = isRecord(graph.key_stats) && Array.isArray(graph.key_stats.stats) ? graph.key_stats.stats.filter(isRecord) : [];
  const stat = (label: string) => parseScaledNumber(stats.find((s) => s.label === label)?.value);
  const summary = isRecord(response) && isRecord(response.summary) ? response.summary : {};
  const marketCap = stat("Mkt. cap");
  return {
    pe: stat("P/E ratio"),
    eps: stat("EPS"),
    dividend_yield_pct: stat("Dividend"),
    market_cap_crore: marketCap === null ? null : Math.round(marketCap / CRORE),
    high_52: stat("52-wk high"),
    low_52: stat("52-wk low"),
    shares_outstanding: stat("Shares outstanding"),
    employees: stat("No. of employees"),
    price: parseScaledNumber(summary.extracted_price),
    as_of: typeof summary.date === "string" ? summary.date : null,
  };
}

const MONTH: Record<string, string> = {
  Jan: "01-31", Feb: "02-28", Mar: "03-31", Apr: "04-30", May: "05-31", Jun: "06-30",
  Jul: "07-31", Aug: "08-31", Sep: "09-30", Oct: "10-31", Nov: "11-30", Dec: "12-31",
};

/** "Jun 2026" -> "2026-06-30"; an annual "2026" is Indian fiscal year 2026, ending 31 March. */
function periodEnd(date: string, annual: boolean): string | null {
  if (annual) return /^\d{4}$/.test(date) ? `${date}-03-31` : null;
  const match = /^([A-Z][a-z]{2})\s+(\d{4})$/.exec(date);
  if (!match || !MONTH[match[1]]) return null;
  // February's last day in a leap year.
  const year = Number(match[2]);
  const day = match[1] === "Feb" && year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? "02-29" : MONTH[match[1]];
  return `${year}-${day}`;
}

/** Lines whose figures are not rupee amounts, and so are not converted to crore. */
const PERCENT_LINE = /(rate|margin|return on|Return on)/i;
const UNCONVERTED_LINE = /(per share|Earnings per share|Price to book|Shares outstanding|Book value per share)/i;

const STATEMENTS: Record<string, "income" | "balance" | "cashflow"> = {
  "Income statement": "income",
  "Balance sheet": "balance",
  "Cash flow": "cashflow",
};

/**
 * Each statement as two grids - quarterly and annual - in the same shape as
 * IndianAPI's, oldest period first. Lines Google reports for no period at all
 * are dropped rather than rendered as a row of dashes.
 */
export function financialGrids(response: unknown): Partial<Record<GoogleFinanceKind, Statement>> {
  const financials = isRecord(response) && Array.isArray(response.financials) ? response.financials.filter(isRecord) : [];
  const grids: Partial<Record<GoogleFinanceKind, Statement>> = {};

  for (const statement of financials) {
    const name = STATEMENTS[String(statement.title)];
    if (!name) continue;
    const results = Array.isArray(statement.results) ? statement.results.filter(isRecord) : [];

    for (const annual of [false, true]) {
      const periods = results
        .filter((r) => r.period_type === (annual ? "Annual" : "Quarterly") && typeof r.date === "string")
        .map((r) => ({ label: String(r.date), end: periodEnd(String(r.date), annual), table: Array.isArray(r.table) ? r.table.filter(isRecord) : [] }))
        .filter((p): p is { label: string; end: string; table: Record<string, unknown>[] } => p.end !== null)
        .sort((a, b) => a.end.localeCompare(b.end));
      if (periods.length === 0) continue;

      const lineTitles: string[] = [];
      for (const p of periods) for (const line of p.table) {
        const title = String(line.title ?? "");
        if (title && !lineTitles.includes(title)) lineTitles.push(title);
      }

      const rows = lineTitles.map((title) => {
        const percent = PERCENT_LINE.test(title);
        const unconverted = percent || UNCONVERTED_LINE.test(title);
        const values = periods.map((p) => {
          const raw = parseScaledNumber(p.table.find((line) => line.title === title)?.value);
          if (raw === null) return null;
          return unconverted ? raw : Math.round((raw / CRORE) * 100) / 100;
        });
        return { label: percent && !title.endsWith("%") ? `${title} %` : title, values };
      }).filter((row) => row.values.some((v) => v !== null));

      grids[`gf_${name}_${annual ? "annual" : "quarterly"}` as GoogleFinanceKind] = {
        periods: periods.map((p) => (annual ? `FY${p.label}` : p.label)),
        period_ends: periods.map((p) => p.end),
        rows,
      };
    }
  }
  return grids;
}

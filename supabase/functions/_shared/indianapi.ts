// Parsers for IndianAPI (stock.indianapi.in) responses.
//
// Why this source: the stock pages were built on NSE's XBRL registry, which
// stopped returning anything newer than Dec 2024 for every symbol, and on
// Yahoo, which reached only 33 of 246 symbols and had gutted its balance sheet.
// IndianAPI returns the statements in Screener.in's layout, current to the
// latest quarter, banks included.
//
// Pure functions only - no fetch, no Deno APIs - so the Deno sync and the
// vitest suite share them. Units are passed through untouched: statement
// figures arrive in crore and percentages as percentages, and they are stored
// that way.

export const STATEMENT_KINDS = ["quarter_results", "yoy_results", "balancesheet", "cashflow", "ratios"] as const;
export type StatementKind = (typeof STATEMENT_KINDS)[number];

/** One statement as a grid: a column per period, a row per line item. */
export type Statement = {
  /** Upstream's labels in chronological order - "Jun 2023" ... "Jun 2026", with "TTM" last when present. */
  periods: string[];
  /** Each period's last calendar day as YYYY-MM-DD, or null for TTM. */
  period_ends: (string | null)[];
  rows: { label: string; values: (number | null)[] }[];
};

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** A number from upstream's mix of numbers and numeric strings; anything else is absent, never zero. */
export function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || value.trim() === "") return null;
  const n = Number(value.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** "Jun 2026" -> "2026-06-30". TTM and anything unreadable -> null. */
export function parsePeriodLabel(label: string): string | null {
  const match = /^([A-Za-z]{3})\s+(\d{4})$/.exec(label.trim());
  if (!match) return null;
  const month = MONTHS[match[1].toLowerCase()];
  if (!month) return null;
  const year = Number(match[2]);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

/**
 * A /historical_stats response - `{ "Sales": { "Jun 2023": 231132, ... }, ... }`
 * - as an aligned grid. Null when the response is not a statement at all (an
 * error object, an empty body), so the caller can tell "no data" from "zero".
 */
export function parseStatement(raw: unknown): Statement | null {
  if (!isRecord(raw)) return null;
  const series = Object.entries(raw).filter((entry): entry is [string, Record<string, unknown>] => isRecord(entry[1]));
  if (series.length === 0) return null;

  const labels = new Set<string>();
  for (const [, values] of series) for (const period of Object.keys(values)) labels.add(period);
  if (labels.size === 0) return null;

  // Chronological, TTM last. Upstream's own key order is chronological too, but
  // a row missing an early period would otherwise reorder the union.
  const periods = [...labels].sort((a, b) => {
    const da = parsePeriodLabel(a);
    const db = parsePeriodLabel(b);
    if (da === db) return 0;
    if (da === null) return 1;
    if (db === null) return -1;
    return da < db ? -1 : 1;
  });

  return {
    periods,
    period_ends: periods.map(parsePeriodLabel),
    rows: series.map(([label, values]) => ({ label, values: periods.map((p) => toNumber(values[p])) })),
  };
}

/** A row's value for one period, by label. */
function valueAt(statement: Statement, label: string, periodEnd: string): number | null {
  const column = statement.period_ends.indexOf(periodEnd);
  const row = statement.rows.find((r) => r.label === label);
  return column === -1 || !row ? null : row.values[column];
}

/**
 * keyMetrics' groups with every value a number or null. A few upstream keys
 * carry stray punctuation ("inventoryTurnoverTrailing12Month)"); keys are
 * reduced to letters and digits so they can be addressed reliably.
 */
export function flattenKeyMetrics(raw: unknown): Record<string, Record<string, number | null>> {
  const out: Record<string, Record<string, number | null>> = {};
  if (!isRecord(raw)) return out;
  for (const [group, items] of Object.entries(raw)) {
    if (!Array.isArray(items)) continue;
    const metrics: Record<string, number | null> = {};
    for (const item of items) {
      if (!isRecord(item) || typeof item.key !== "string") continue;
      const key = item.key.replace(/[^A-Za-z0-9]/g, "");
      if (key) metrics[key] = toNumber(item.value);
    }
    out[group] = metrics;
  }
  return out;
}

export type MovingAverage = { days: number; nse: number | null; bse: number | null };

export function parseTechnicals(raw: unknown): MovingAverage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(isRecord)
    .map((row) => ({ days: toNumber(row.days), nse: toNumber(row.nsePrice), bse: toNumber(row.bsePrice) }))
    .filter((row): row is MovingAverage => row.days !== null)
    .sort((a, b) => a.days - b.days);
}

export type HolderSeries = { category: string; points: { date: string; pct: number }[] };

export function parseShareholding(raw: unknown): HolderSeries[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isRecord).map((row) => ({
    category: String(row.displayName ?? row.categoryName ?? "").trim(),
    points: (Array.isArray(row.categories) ? row.categories : [])
      .filter(isRecord)
      .map((p) => ({ date: String(p.holdingDate ?? ""), pct: toNumber(p.percentage) }))
      .filter((p): p is { date: string; pct: number } => /^\d{4}-\d{2}-\d{2}$/.test(p.date) && p.pct !== null)
      .sort((a, b) => a.date.localeCompare(b.date)),
  })).filter((series) => series.category && series.points.length > 0);
}

export type Check = { ok: true } | { ok: false; reason: string };

/**
 * Whether a /stock response is about the symbol that was asked for.
 *
 * /stock?name= is a search, not a lookup. Its answer names its own NSE code,
 * and nothing is stored unless that code is the symbol requested - another
 * company's financials under this ticker would be worse than none.
 */
export function verifyIdentity(stock: unknown, symbol: string): Check {
  const profile = isRecord(stock) && isRecord(stock.companyProfile) ? stock.companyProfile : null;
  const code = profile && typeof profile.exchangeCodeNse === "string" ? profile.exchangeCodeNse.trim() : "";
  if (!code) return { ok: false, reason: "response carries no NSE code" };
  return code.toUpperCase() === symbol.toUpperCase()
    ? { ok: true }
    : { ok: false, reason: `resolved to ${code}, not ${symbol.toUpperCase()}` };
}

/**
 * Statements up to this far apart on one quarter's revenue are taken as the
 * same company. The two endpoints use different definitions - /stock's
 * TotalRevenue can include items Screener's Sales excludes - and ran 1-2%
 * apart for RELIANCE. A different company differs by multiples, not percent.
 */
const REVENUE_TOLERANCE = 0.25;

/**
 * The second opinion when revenue is defined differently - GODFRYPHLP's
 * TotalRevenue includes excise duty, 3x Screener's Sales. EPS is per share, so
 * it is specific to one company, and for the same company the two endpoints
 * agree to the paisa (RELIANCE: 15.48 and 15.48). Profit was tried first and
 * rejected: HDFC Bank's and Reliance's quarterly profits are within 3%.
 * EVERY shared quarter must agree, because one can coincide by chance.
 */
const EPS_TOLERANCE = 0.05;

/**
 * /historical_stats carries no identity of its own - it is a name search like
 * /stock - so its quarterly revenue is checked against the verified /stock
 * response's own quarterly statements. `verified: false` means the two share
 * no quarter to compare, which is reported rather than treated as a failure.
 */
export function crossCheckRevenue(stock: unknown, quarters: Statement): { ok: true; verified: boolean } | { ok: false; reason: string } {
  const financials = isRecord(stock) && Array.isArray(stock.financials) ? stock.financials.filter(isRecord) : [];
  const topLine = quarters.rows[0];
  if (!topLine) return { ok: true, verified: false };

  const interims = financials
    .filter((f) => f.Type === "Interim" && typeof f.EndDate === "string")
    .sort((a, b) => String(b.EndDate).localeCompare(String(a.EndDate)));
  for (const period of interims) {
    const income = isRecord(period.stockFinancialMap) && Array.isArray(period.stockFinancialMap.INC)
      ? period.stockFinancialMap.INC.filter(isRecord)
      : [];
    const lookup = (key: string) => toNumber(income.find((item) => item.key === key)?.value);
    const reference = lookup("TotalRevenue") ?? lookup("Revenue");
    const statementValue = valueAt(quarters, topLine.label, String(period.EndDate));
    if (reference === null || statementValue === null || reference === 0) continue;
    const gap = Math.abs(statementValue - reference) / Math.abs(reference);
    if (gap <= REVENUE_TOLERANCE) return { ok: true, verified: true };

    // Revenue disagrees. Same company with differently defined revenue? Then
    // its EPS agrees in every quarter both endpoints report.
    if (epsAgrees(interims, quarters)) return { ok: true, verified: true };
    return {
      ok: false,
      reason: `${topLine.label} for ${period.EndDate} is ${statementValue} Cr against ${reference} Cr from /stock ` +
        `(${Math.round(gap * 100)}% apart), and EPS does not agree either - likely a different company`,
    };
  }
  return { ok: true, verified: false };
}

/** Whether every quarter both endpoints report has matching EPS (at least one must). */
function epsAgrees(interims: Record<string, unknown>[], quarters: Statement): boolean {
  let compared = 0;
  for (const period of interims) {
    const income = isRecord(period.stockFinancialMap) && Array.isArray(period.stockFinancialMap.INC)
      ? period.stockFinancialMap.INC.filter(isRecord)
      : [];
    const lookup = (key: string) => toNumber(income.find((item) => item.key === key)?.value);
    const reference = lookup("DilutedEPSExcludingExtraOrdItems") ?? lookup("DilutedNormalizedEPS");
    const eps = valueAt(quarters, "EPS in Rs", String(period.EndDate));
    if (reference === null || eps === null || reference === 0) continue;
    if (Math.abs(eps - reference) / Math.abs(reference) > EPS_TOLERANCE) return false;
    compared++;
  }
  return compared > 0;
}

export type RoePoint = { period_end: string; roe: number };

/**
 * Return on equity per fiscal year: net profit over the average of opening and
 * closing shareholders' equity (Equity Capital + Reserves), as a percentage.
 * A year is left out rather than guessed when either end's equity or the
 * year's profit is missing, or equity is not positive.
 */
export function deriveRoe(annual: Statement, balance: Statement): RoePoint[] {
  const equityAt = (periodEnd: string): number | null => {
    const capital = valueAt(balance, "Equity Capital", periodEnd);
    const reserves = valueAt(balance, "Reserves", periodEnd);
    return capital === null || reserves === null ? null : capital + reserves;
  };
  const yearEnds = balance.period_ends.filter((p): p is string => p !== null);
  const points: RoePoint[] = [];
  for (let i = 1; i < yearEnds.length; i++) {
    const closing = equityAt(yearEnds[i]);
    const opening = equityAt(yearEnds[i - 1]);
    const profit = valueAt(annual, "Net Profit", yearEnds[i]);
    if (closing === null || opening === null || profit === null) continue;
    const average = (opening + closing) / 2;
    if (average <= 0) continue;
    points.push({ period_end: yearEnds[i], roe: (profit / average) * 100 });
  }
  return points;
}

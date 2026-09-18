/**
 * Yahoo Finance access for the fundamentals sync.
 *
 * The crumb flow is lifted from ai-stock-analysis, which has been using it in
 * production successfully - quoteSummary is crumb-gated and returns 429 without
 * a cookie+crumb pair. Extracted here so both callers share one implementation
 * rather than drifting.
 */

const YAHOO_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0 Safari/537.36";

const CRUMB_TTL_MS = 30 * 60 * 1000;
let crumbCache: { crumb: string; cookie: string; ts: number } | null = null;

/**
 * A real crumb is a short opaque single token. Two non-crumbs reach this code
 * with a 200-ish body and must be rejected:
 *
 *  - a login wall, which is HTML, caught by the "<" test;
 *  - a rate-limit refusal, which is the bare text `Too Many Requests`.
 *
 * The second is the one that bites. It is 17 characters with no angle bracket,
 * so a length-and-"<" check accepts it, and the caller then caches it for the
 * full CRUMB_TTL_MS and appends it to every quoteSummary URL for half an hour -
 * a refusal string used as an auth token, which makes a throttled window look
 * like a parse-shaped failure instead of a throttle. Whitespace is the cheap
 * discriminator: crumbs never contain any, English refusals always do.
 *
 * Exported for tests - the fetch flow around it cannot run under Vitest.
 */
export function isValidCrumb(crumb: string): boolean {
  return crumb.length > 0 && crumb.length <= 40 && !crumb.includes("<") && !/\s/.test(crumb);
}

export async function getYahooCrumb(): Promise<{ crumb: string; cookie: string } | null> {
  try {
    if (crumbCache && Date.now() - crumbCache.ts < CRUMB_TTL_MS) {
      return { crumb: crumbCache.crumb, cookie: crumbCache.cookie };
    }
    const cookieRes = await fetch("https://fc.yahoo.com/", { headers: { "User-Agent": YAHOO_UA } });
    const cookie = (cookieRes.headers.get("set-cookie") || "").split(";")[0];
    if (!cookie) return null;
    const crumbRes = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
      headers: { "User-Agent": YAHOO_UA, Cookie: cookie },
    });
    const crumb = (await crumbRes.text()).trim();
    if (!isValidCrumb(crumb)) return null;
    crumbCache = { crumb, cookie, ts: Date.now() };
    return { crumb, cookie };
  } catch {
    return null;
  }
}

/** NSE ticker to Yahoo ticker. Ampersands are left intact; encoding is the caller's job. */
export function toYahooSymbol(nseSymbol: string): string {
  return nseSymbol.includes(".") ? nseSymbol : `${nseSymbol}.NS`;
}

/**
 * Yahoo's timeseries endpoint, the modern replacement for the quoteSummary
 * statement modules.
 *
 * Needed because balanceSheetHistoryQuarterly has been gutted upstream: it
 * still returns one object per quarter, but each carries only `maxAge` and
 * `endDate` - every financial figure has been stripped. Verified from the
 * deployed function, which is the only place here that Yahoo does not
 * rate-limit. That is why fundamentals_balance holds 664 rows in which
 * total_equity is null for every single one.
 *
 * `type` is a comma-separated list of series names (quarterlyTotalAssets,
 * quarterlyStockholdersEquity, ...). period1/period2 bound the window in epoch
 * seconds; Yahoo returns nothing without them.
 */
export async function fetchTimeseries(
  symbol: string,
  types: string,
  yearsBack = 3,
): Promise<unknown | null> {
  const cc = await getYahooCrumb();
  const now = Math.floor(Date.now() / 1000);
  const from = now - yearsBack * 365 * 24 * 60 * 60;
  const url =
    `https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(symbol)}` +
    `?symbol=${encodeURIComponent(symbol)}&type=${encodeURIComponent(types)}` +
    `&period1=${from}&period2=${now}&merge=false` +
    `${cc ? `&crumb=${encodeURIComponent(cc.crumb)}` : ""}`;
  const res = await fetch(url, {
    headers: { "User-Agent": YAHOO_UA, ...(cc ? { Cookie: cc.cookie } : {}) },
  });
  if (!res.ok) return null;
  return await res.json();
}

export async function fetchQuoteSummary(
  symbol: string,
  modules: string,
): Promise<unknown | null> {
  const cc = await getYahooCrumb();
  const url =
    `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}` +
    `?modules=${encodeURIComponent(modules)}${cc ? `&crumb=${encodeURIComponent(cc.crumb)}` : ""}`;
  const res = await fetch(url, {
    headers: { "User-Agent": YAHOO_UA, ...(cc ? { Cookie: cc.cookie } : {}) },
  });
  if (!res.ok) return null;
  return await res.json();
}

export type BalanceRow = {
  periodEnd: string;
  totalAssets: number | null;
  totalDebt: number | null;
  totalEquity: number | null;
  cashAndEquivalents: number | null;
  currentAssets: number | null;
  currentLiabilities: number | null;
};

export type CashflowRow = {
  periodEnd: string;
  /** "12M" (a fiscal year) or "3M" (a quarter). Indian companies file cash flow
   * annually, so most symbols only have 12M; the two must never be compared. */
  periodType: "12M" | "3M";
  operatingCf: number | null;
  investingCf: number | null;
  financingCf: number | null;
  capex: number | null;
  freeCashFlow: number | null;
};

/** Yahoo wraps every figure as { raw, fmt } and OMITS the key when absent. */
const num = (x: unknown): number | null => {
  const raw = (x as { raw?: unknown } | undefined)?.raw;
  return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
};

/** Epoch seconds to an ISO date, UTC. Yahoo dates are day-granular. */
const toIso = (x: unknown): string | null => {
  const raw = num(x);
  if (raw === null) return null;
  const d = new Date(raw * 1000);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

const statements = (json: unknown, module: string, key: string): Array<Record<string, unknown>> => {
  const result = (json as { quoteSummary?: { result?: unknown[] } })?.quoteSummary?.result;
  if (!Array.isArray(result) || result.length === 0) return [];
  const mod = (result[0] as Record<string, unknown>)[module] as Record<string, unknown> | undefined;
  const list = mod?.[key];
  return Array.isArray(list) ? (list as Array<Record<string, unknown>>) : [];
};

export function parseBalanceSheet(json: unknown): BalanceRow[] {
  return statements(json, "balanceSheetHistoryQuarterly", "balanceSheetStatements")
    .flatMap((s) => {
      const periodEnd = toIso(s.endDate);
      if (!periodEnd) return [];
      // Yahoo has no single total-debt field. Sum the two, but only when at
      // least one is present - otherwise a fully absent debt figure would
      // become 0 and read as "this company has no debt".
      const shortTerm = num(s.shortLongTermDebt);
      const longTerm = num(s.longTermDebt);
      const totalDebt =
        shortTerm === null && longTerm === null ? null : (shortTerm ?? 0) + (longTerm ?? 0);
      return [{
        periodEnd,
        totalAssets: num(s.totalAssets),
        totalDebt,
        totalEquity: num(s.totalStockholderEquity),
        cashAndEquivalents: num(s.cash),
        currentAssets: num(s.totalCurrentAssets),
        currentLiabilities: num(s.totalCurrentLiabilities),
      }];
    });
}

export type IncomeRow = {
  periodEnd: string;
  revenue: number | null;
  profitBeforeTax: number | null;
  profitAfterTax: number | null;
};

/**
 * Quarterly income, from the same quoteSummary call that already returns the
 * balance sheet and cash flow.
 *
 * Added because NSE's corporates-financial-results endpoint stopped returning
 * filings after 31-Dec-2024 for every symbol tested, while these Yahoo
 * statements reach 30-Jun-2026. alignPeriods joins income to balance on an
 * exact period_end match, so with income frozen 21 months behind, the two
 * series never met: derived ratios existed for 3 rows out of ~1,800 and no
 * stock on the site showed a ROE. Sourcing income from the same place as the
 * balance sheet makes the periods align by construction.
 *
 * These rows are written with source 'yahoo' and coexist with NSE XBRL rather
 * than replacing it - the unique key now includes source. A filing is still
 * the better number wherever one exists.
 *
 * A statement with no endDate is dropped rather than dated: a row keyed to the
 * wrong quarter would join against the wrong balance sheet and yield a
 * confident wrong ratio, which is worse than an absent one. Missing figures
 * stay null for the same reason computeRatios treats null as "cannot compute".
 */
/**
 * Figures are stored as rupees. Yahoo reports a few companies' statements in
 * another currency (INFY in US dollars), and stored as rupees those made its
 * free cash flow read Rs 373 crore and every ratio against the rupee market cap
 * ~90x off. An observation without a currency code is assumed to be rupees.
 */
const inRupees = (observation: Record<string, unknown> | null | undefined) =>
  typeof observation?.currencyCode !== "string" || observation.currencyCode === "INR";

/** The first non-rupee currency in a timeseries payload, or null when it is all rupees. */
export function foreignReportingCurrency(json: unknown): string | null {
  const result = (json as { timeseries?: { result?: unknown[] } } | null)?.timeseries?.result;
  if (!Array.isArray(result)) return null;
  for (const entry of result as Record<string, unknown>[]) {
    for (const value of Object.values(entry)) {
      if (!Array.isArray(value)) continue;
      for (const observation of value as Record<string, unknown>[]) {
        if (!inRupees(observation)) return String(observation.currencyCode);
      }
    }
  }
  return null;
}

/** The timeseries series names this parser reads, mapped to BalanceRow fields. */
const TIMESERIES_BALANCE_FIELDS = {
  quarterlyTotalAssets: "totalAssets",
  quarterlyStockholdersEquity: "totalEquity",
  quarterlyTotalDebt: "totalDebt",
  quarterlyCashAndCashEquivalents: "cashAndEquivalents",
  quarterlyCurrentAssets: "currentAssets",
  quarterlyCurrentLiabilities: "currentLiabilities",
} as const;

export const TIMESERIES_BALANCE_TYPES = Object.keys(TIMESERIES_BALANCE_FIELDS).join(",");

/**
 * Balance-sheet quarters from Yahoo's fundamentals-timeseries endpoint.
 *
 * The shape, captured from the deployed function rather than assumed:
 *
 *   timeseries.result[i] = {
 *     meta: { type: ["quarterlyStockholdersEquity"] },
 *     quarterlyStockholdersEquity: [
 *       { asOfDate: "2026-03-31", periodType: "3M", currencyCode: "INR",
 *         reportedValue: { raw: 273615000000, fmt: "273.62B" } } ] }
 *
 * One result entry per requested series, each carrying its own observations, so
 * the parser pivots them onto a single row per period.
 *
 * A series Yahoo omits stays null rather than becoming 0: computeRatios reads
 * null as "cannot compute", while a 0 equity divides and a 0 debt asserts that
 * a company carries none. An observation with no asOfDate is dropped rather
 * than dated - a row keyed to the wrong quarter would join against the wrong
 * income statement and produce a confident wrong ratio.
 */
export function parseTimeseriesBalance(json: unknown): BalanceRow[] {
  const result = (json as { timeseries?: { result?: unknown[] } })?.timeseries?.result;
  if (!Array.isArray(result)) return [];

  const byPeriod = new Map<string, BalanceRow>();

  for (const entry of result) {
    const row = entry as Record<string, unknown>;
    for (const [seriesName, field] of Object.entries(TIMESERIES_BALANCE_FIELDS)) {
      const observations = row[seriesName];
      if (!Array.isArray(observations)) continue;

      for (const raw of observations as Record<string, unknown>[]) {
        const periodEnd = typeof raw?.asOfDate === "string" ? raw.asOfDate : null;
        if (!periodEnd || !inRupees(raw)) continue;
        // num() unwraps Yahoo's { raw, fmt } itself, so hand it the wrapper.
        const value = num(raw.reportedValue);
        if (value === null) continue;

        const existing = byPeriod.get(periodEnd) ?? {
          periodEnd,
          totalAssets: null,
          totalDebt: null,
          totalEquity: null,
          cashAndEquivalents: null,
          currentAssets: null,
          currentLiabilities: null,
        };
        existing[field] = value;
        byPeriod.set(periodEnd, existing);
      }
    }
  }

  return [...byPeriod.values()];
}

export function parseIncomeStatement(json: unknown): IncomeRow[] {
  return statements(json, "incomeStatementHistoryQuarterly", "incomeStatementHistory")
    .flatMap((s) => {
      const periodEnd = toIso(s.endDate);
      if (!periodEnd) return [];
      return [{
        periodEnd,
        revenue: num(s.totalRevenue),
        profitBeforeTax: num(s.incomeBeforeTax),
        profitAfterTax: num(s.netIncome),
      }];
    });
}

/** The cash-flow series read from fundamentals-timeseries, for both period lengths. */
const CASHFLOW_SERIES = {
  OperatingCashFlow: "operatingCf",
  InvestingCashFlow: "investingCf",
  FinancingCashFlow: "financingCf",
  CapitalExpenditure: "capex",
  FreeCashFlow: "freeCashFlow",
} as const;

export const TIMESERIES_CASHFLOW_TYPES = Object.keys(CASHFLOW_SERIES)
  .flatMap((name) => [`annual${name}`, `quarterly${name}`])
  .join(",");

/**
 * Cash flow from the fundamentals-timeseries endpoint, one row per period and
 * length. quoteSummary's cashflowStatementHistoryQuarterly was gutted upstream
 * (dated objects with no figures), which left every stored cash-flow row empty.
 *
 * Annual and quarterly observations share dates (31 March), so the key is date
 * plus length; mixing them would pair a year's cash with a quarter's profit.
 */
export function parseTimeseriesCashflow(json: unknown): CashflowRow[] {
  const result = (json as { timeseries?: { result?: unknown[] } } | null)?.timeseries?.result;
  if (!Array.isArray(result)) return [];

  const rows = new Map<string, CashflowRow>();
  for (const entry of result as Record<string, unknown>[]) {
    for (const [name, field] of Object.entries(CASHFLOW_SERIES)) {
      for (const [prefix, periodType] of [["annual", "12M"], ["quarterly", "3M"]] as const) {
        const observations = entry[`${prefix}${name}`];
        if (!Array.isArray(observations)) continue;
        for (const raw of observations as Record<string, unknown>[]) {
          const periodEnd = typeof raw?.asOfDate === "string" ? raw.asOfDate : null;
          const value = num(raw?.reportedValue);
          if (!periodEnd || value === null || !inRupees(raw)) continue;
          const key = `${periodEnd}|${periodType}`;
          const row = rows.get(key) ?? {
            periodEnd, periodType, operatingCf: null, investingCf: null, financingCf: null, capex: null, freeCashFlow: null,
          };
          // Yahoo reports capex as a negative outflow; the scores subtract a positive spend.
          row[field] = field === "capex" ? Math.abs(value) : value;
          rows.set(key, row);
        }
      }
    }
  }
  for (const row of rows.values()) {
    if (row.freeCashFlow === null && row.operatingCf !== null && row.capex !== null) {
      row.freeCashFlow = row.operatingCf - row.capex;
    }
  }
  return [...rows.values()];
}

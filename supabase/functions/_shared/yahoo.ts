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
    // A login wall returns HTML; a valid crumb is a short opaque token.
    if (!crumb || crumb.includes("<") || crumb.length > 40) return null;
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

export function parseCashflow(json: unknown): CashflowRow[] {
  return statements(json, "cashflowStatementHistoryQuarterly", "cashflowStatements")
    .flatMap((s) => {
      const periodEnd = toIso(s.endDate);
      if (!periodEnd) return [];
      const operatingCf = num(s.totalCashFromOperatingActivities);
      // Yahoo reports capex as a negative outflow. computeRatios subtracts it,
      // so it must be a magnitude - passing -30000 would ADD the spend.
      const rawCapex = num(s.capitalExpenditures);
      const capex = rawCapex === null ? null : Math.abs(rawCapex);
      const freeCashFlow =
        operatingCf === null || capex === null ? null : operatingCf - capex;
      return [{
        periodEnd,
        operatingCf,
        investingCf: num(s.totalCashflowsFromInvestingActivities),
        financingCf: num(s.totalCashFromFinancingActivities),
        capex,
        freeCashFlow,
      }];
    });
}

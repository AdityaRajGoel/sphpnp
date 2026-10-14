import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type {
  HolderSeries, KeyMetrics, MovingAverage, RoePoint, StatementGrid, StatementKind,
} from "@/lib/statements";
import type { ScreenerProfile, TickertapeProfile } from "@/lib/stock-disclosures";

export type StockProfile = {
  company_name: string | null;
  industry: string | null;
  description: string | null;
  key_metrics: KeyMetrics;
  moving_averages: MovingAverage[];
  shareholding: HolderSeries[];
  roe_history: RoePoint[];
  fetched_at: string | null;
  /** Google Finance key stats (via SerpApi), for stocks IndianAPI covered thinly or not at all. */
  google_finance: { pe: number | null; eps: number | null; dividend_yield_pct: number | null } | null;
  google_finance_fetched_at: string | null;
  /** screener.in's company page: headline ratios, growth, pros and cons, documents. */
  screener: ScreenerProfile | null;
  screener_fetched_at: string | null;
  /** Tickertape: analysts, fund holdings, scorecard. */
  tickertape: TickertapeProfile | null;
  tickertape_fetched_at: string | null;
  bse_code: string | null;
};

export type StockStatementsState = {
  loading: boolean;
  error: string | null;
  statements: Partial<Record<StatementKind, StatementGrid>>;
  profile: StockProfile | null;
};

// Newer than the generated Database types, addressed through the same cast
// useStockFundamentals uses.
const table = (name: string) => supabase.from(name as never) as ReturnType<typeof supabase.from>;

const EMPTY: StockStatementsState = { loading: true, error: null, statements: {}, profile: null };

/**
 * The IndianAPI statements and profile for one symbol. Both are absent until
 * sync-stock-statements reaches the symbol, which is an ordinary state: the
 * page falls back to the NSE-filing tables it had before.
 */
/** sync-stock-statements refreshes a profile every 30 days; older means the sync has failed. */
const INDIANAPI_MAX_AGE_MS = 31 * 86_400_000;

/**
 * The profile without IndianAPI's time-sensitive blocks once they are older than
 * INDIANAPI_MAX_AGE_MS: its key was rate-limited from 10 Sep 2026, and 80 pages
 * kept showing that day's TTM ratios and moving averages beside today's price.
 * The page then falls back to screener.in's ratios and the daily analytics.
 */
export function withoutStaleIndianApi(profile: StockProfile, now = Date.now()): StockProfile {
  const fetched = Date.parse(profile.fetched_at ?? "");
  if (!Number.isFinite(fetched) || now - fetched <= INDIANAPI_MAX_AGE_MS) return profile;
  return { ...profile, key_metrics: {}, moving_averages: [] };
}

export function useStockStatements(symbol: string | undefined): StockStatementsState {
  const [state, setState] = useState<StockStatementsState>(EMPTY);

  useEffect(() => {
    if (!symbol) {
      setState({ ...EMPTY, loading: false });
      return;
    }
    let cancelled = false;
    const upper = symbol.toUpperCase();
    setState(EMPTY);

    (async () => {
      try {
        const [statementsRes, profileRes] = await Promise.all([
          table("stock_statements")
            .select("statement,periods,period_ends,rows,verified,fetched_at,source")
            .eq("symbol", upper),
          table("stock_profiles")
            .select("company_name,industry,description,key_metrics,moving_averages,shareholding,roe_history,fetched_at,google_finance,google_finance_fetched_at,screener,screener_fetched_at,tickertape,tickertape_fetched_at,bse_code")
            .eq("symbol", upper)
            .maybeSingle(),
        ]);
        if (cancelled) return;
        const failure = statementsRes.error || profileRes.error;
        if (failure) throw new Error(failure.message);

        const statements: Partial<Record<StatementKind, StatementGrid>> = {};
        for (const row of (statementsRes.data ?? []) as unknown as StatementGrid[]) statements[row.statement] = row;
        const profile = profileRes.data as unknown as StockProfile | null;

        setState({
          loading: false,
          error: null,
          statements,
          // A profile row that only records failed attempts has nothing to show.
          profile: profile?.fetched_at || profile?.google_finance_fetched_at || profile?.screener_fetched_at || profile?.tickertape_fetched_at ? withoutStaleIndianApi(profile) : null,
        });
      } catch (error) {
        if (!cancelled) setState({ ...EMPTY, loading: false, error: (error as Error).message });
      }
    })();

    return () => { cancelled = true; };
  }, [symbol]);

  return state;
}

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type {
  HolderSeries, KeyMetrics, MovingAverage, RoePoint, StatementGrid, StatementKind,
} from "@/lib/statements";

export type StockProfile = {
  company_name: string | null;
  industry: string | null;
  description: string | null;
  key_metrics: KeyMetrics;
  moving_averages: MovingAverage[];
  shareholding: HolderSeries[];
  roe_history: RoePoint[];
  fetched_at: string | null;
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
            .select("statement,periods,period_ends,rows,verified,fetched_at")
            .eq("symbol", upper),
          table("stock_profiles")
            .select("company_name,industry,description,key_metrics,moving_averages,shareholding,roe_history,fetched_at")
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
          // A profile row that only records a failed attempt has no fetch yet.
          profile: profile?.fetched_at ? profile : null,
        });
      } catch (error) {
        if (!cancelled) setState({ ...EMPTY, loading: false, error: (error as Error).message });
      }
    })();

    return () => { cancelled = true; };
  }, [symbol]);

  return state;
}

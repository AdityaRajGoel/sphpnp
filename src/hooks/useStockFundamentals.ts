import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { selectBasis, type Basis, type IncomeRow } from "@/lib/fundamentals";

export type CorporateAction = {
  ex_date: string;
  record_date: string | null;
  action_type: string;
  value: number | null;
  description: string;
};

export type StockHeader = {
  symbol: string;
  name: string;
  sector: string | null;
  price: number | null;
  change_pct: number | null;
  market_cap: number | null;
  updated_at: string | null;
};

export type FilingMeta = {
  filing_date: string | null;
  xbrl_url: string | null;
  is_audited: boolean;
};

export type StockFundamentalsState = {
  loading: boolean;
  /** Symbol is not in the tracked universe - the page must 404. */
  notFound: boolean;
  error: string | null;
  header: StockHeader | null;
  basis: Basis | null;
  bothAvailable: boolean;
  income: IncomeRow[];
  actions: CorporateAction[];
  filing: FilingMeta | null;
  /** False when the symbol is tracked but the cursor has not reached it yet. */
  synced: boolean;
};

// The fundamentals tables post-date the generated Database types, so they are
// addressed through the same cast MarketDataManager.tsx already uses.
const table = (name: string) =>
  supabase.from(name as never) as ReturnType<typeof supabase.from>;

const EMPTY: StockFundamentalsState = {
  loading: true, notFound: false, error: null, header: null, basis: null,
  bothAvailable: false, income: [], actions: [], filing: null, synced: false,
};

export function useStockFundamentals(symbol: string | undefined): StockFundamentalsState {
  const [state, setState] = useState<StockFundamentalsState>(EMPTY);

  useEffect(() => {
    if (!symbol) {
      setState({ ...EMPTY, loading: false, notFound: true });
      return;
    }
    let cancelled = false;
    const upper = symbol.toUpperCase();

    (async () => {
      setState(EMPTY);
      try {
        // The universe row decides 404 vs render, so it is awaited first.
        const { data: headerRow, error: headerErr } = await table("screener_stocks")
          .select("symbol,name,sector,price,change_pct,market_cap,updated_at")
          .eq("symbol", upper)
          .maybeSingle();
        if (cancelled) return;
        if (headerErr) throw new Error(headerErr.message);
        if (!headerRow) {
          setState({ ...EMPTY, loading: false, notFound: true });
          return;
        }

        // Independent of each other - fetched in parallel, no waterfall.
        const [incomeRes, actionsRes, filingRes] = await Promise.all([
          table("fundamentals_income").select("*").eq("symbol", upper),
          table("fundamentals_corporate_actions")
            .select("ex_date,record_date,action_type,value,description")
            .eq("symbol", upper)
            .order("ex_date", { ascending: false })
            .limit(50),
          table("fundamentals_filings")
            .select("filing_date,xbrl_url,is_audited")
            .eq("symbol", upper)
            .order("to_date", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);
        if (cancelled) return;

        const firstError = incomeRes.error || actionsRes.error || filingRes.error;
        if (firstError) throw new Error(firstError.message);

        const rows = (incomeRes.data ?? []) as unknown as IncomeRow[];
        const picked = selectBasis(rows);
        const h = headerRow as unknown as Record<string, unknown>;

        setState({
          loading: false,
          notFound: false,
          error: null,
          header: {
            symbol: upper,
            name: String(h.name ?? upper),
            sector: (h.sector as string) ?? null,
            price: h.price === null ? null : Number(h.price),
            change_pct: h.change_pct === null ? null : Number(h.change_pct),
            market_cap: h.market_cap === null ? null : Number(h.market_cap),
            updated_at: (h.updated_at as string) ?? null,
          },
          basis: picked.basis,
          bothAvailable: picked.bothAvailable,
          income: picked.rows,
          actions: (actionsRes.data ?? []) as unknown as CorporateAction[],
          filing: (filingRes.data as unknown as FilingMeta) ?? null,
          // Tracked but unreached by the cursor is an ordinary state, not a fault.
          synced: rows.length > 0,
        });
      } catch (err) {
        if (cancelled) return;
        setState({
          ...EMPTY, loading: false, error: (err as Error).message,
        });
      }
    })();

    return () => { cancelled = true; };
  }, [symbol]);

  return state;
}

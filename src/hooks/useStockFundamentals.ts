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

/**
 * A quote figure, or null when the sync had nothing to write.
 *
 * Zero is treated as absent on purpose: it is this pipeline's "unknown"
 * sentinel for legacy rows written before the sync started omitting unusable
 * fields, and no listed company on this universe genuinely trades at zero or
 * has a zero 52-week high.
 */
const num = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) && n !== 0 ? n : null;
};

export type StockHeader = {
  symbol: string;
  name: string;
  sector: string | null;
  price: number | null;
  change_pct: number | null;
  market_cap: number | null;
  updated_at: string | null;
  /*
   * Quote metrics the screener already syncs. They were previously fetched but
   * never selected here, so the stock page showed price and market cap while
   * P/E, the ranges and volume sat one column away in the same row.
   *
   * Every one is nullable and must stay that way. The sync now OMITS a field it
   * could not read rather than writing 0, so absent means "Yahoo did not give
   * us this", never "the value is zero" - and a 0 P/E rendered as a number is a
   * statement about a listed company that nobody made.
   */
  pe: number | null;
  high_52: number | null;
  low_52: number | null;
  day_high: number | null;
  day_low: number | null;
  volume: number | null;
  open_price: number | null;
  prev_close: number | null;
};

export type FilingMeta = {
  filing_date: string | null;
  xbrl_url: string | null;
  is_audited: boolean;
};

/**
 * One row of fundamentals_derived. The two string arrays are the reason a null
 * ratio can be explained rather than shrugged at: missing_inputs names inputs
 * that never arrived, unusable_inputs names denominators that arrived and were
 * zero or negative. Both columns are NOT NULL DEFAULT '{}' in the schema, so
 * consumers can index them without a null guard.
 */
export type DerivedRow = {
  period_end: string;
  roe: number | null;
  roce: number | null;
  current_ratio: number | null;
  free_cash_flow: number | null;
  inputs_complete: boolean;
  missing_inputs: string[];
  unusable_inputs: string[];
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
  derived: DerivedRow[];
  /** False when the symbol is tracked but the cursor has not reached it yet. */
  synced: boolean;
};

// The fundamentals tables post-date the generated Database types, so they are
// addressed through the same cast MarketDataManager.tsx already uses.
const table = (name: string) =>
  supabase.from(name as never) as ReturnType<typeof supabase.from>;

const EMPTY: StockFundamentalsState = {
  loading: true, notFound: false, error: null, header: null, basis: null,
  bothAvailable: false, income: [], actions: [], filing: null, derived: [],
  synced: false,
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
          .select("symbol,name,sector,price,change_pct,market_cap,updated_at,pe,high_52,low_52,day_high,day_low,volume,open_price,prev_close")
          .eq("symbol", upper)
          .maybeSingle();
        if (cancelled) return;
        if (headerErr) throw new Error(headerErr.message);
        if (!headerRow) {
          setState({ ...EMPTY, loading: false, notFound: true });
          return;
        }

        // Independent of each other - fetched in parallel, no waterfall.
        const [incomeRes, actionsRes, filingRes, derivedRes] = await Promise.all([
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
          // Twelve periods is three years of quarters - enough for the panel to
          // show a trend without paying for rows it will never render.
          table("fundamentals_derived")
            .select(
              "period_end,roe,roce,current_ratio,free_cash_flow,inputs_complete,missing_inputs,unusable_inputs",
            )
            .eq("symbol", upper)
            .order("period_end", { ascending: false })
            .limit(12),
        ]);
        if (cancelled) return;

        const firstError =
          incomeRes.error || actionsRes.error || filingRes.error || derivedRes.error;
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
            pe: num(h.pe),
            high_52: num(h.high_52),
            low_52: num(h.low_52),
            day_high: num(h.day_high),
            day_low: num(h.day_low),
            volume: num(h.volume),
            open_price: num(h.open_price),
            prev_close: num(h.prev_close),
          },
          basis: picked.basis,
          bothAvailable: picked.bothAvailable,
          income: picked.rows,
          actions: (actionsRes.data ?? []) as unknown as CorporateAction[],
          filing: (filingRes.data as unknown as FilingMeta) ?? null,
          derived: (derivedRes.data ?? []) as unknown as DerivedRow[],
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

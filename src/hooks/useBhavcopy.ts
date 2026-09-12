import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Reads the daily EOD bhavcopy fed by sync-bhavcopy (latest trading day only).
// Stays gracefully empty until the migration + function are deployed and the
// first sync has run.
export type BhavcopyRow = {
  symbol: string;
  series: string;
  trade_date: string;
  close: number | null;
  prev_close: number | null;
  high: number | null;
  low: number | null;
  ttl_trd_qty: number | null;
  deliv_qty: number | null;
  deliv_per: number | null;
};

const bhavcopyTable = () => supabase.from("bhavcopy_eod" as never) as ReturnType<typeof supabase.from>;

export function useBhavcopy() {
  const [rows, setRows] = useState<BhavcopyRow[]>([]);
  const [asOf, setAsOf] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // The table holds one day for every security (~3,400 rows) and the API
        // returns at most 1,000 a request, so it is read in pages. A single
        // request kept only the 1,000 highest-delivery rows - mostly ETFs and
        // debt at 100% - and left almost every tracked stock without a figure.
        const list: BhavcopyRow[] = [];
        for (let from = 0; from < 20_000; from += 1000) {
          const { data, error } = await bhavcopyTable()
            .select("symbol, series, trade_date, close, prev_close, high, low, ttl_trd_qty, deliv_qty, deliv_per")
            .order("deliv_per", { ascending: false, nullsFirst: false })
            .order("symbol")
            .order("series")
            .range(from, from + 999);
          if (error) throw error;
          const page = (data as BhavcopyRow[] | null) ?? [];
          list.push(...page);
          if (page.length < 1000) break;
        }
        if (cancelled) return;
        setRows(list);
        setAsOf(list[0]?.trade_date ?? null);
      } catch {
        // table not deployed yet / no data - remain empty
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { rows, asOf, loading };
}

/** SYMBOL -> delivery %, preferring the EQ series row when a symbol has several. */
export function buildDeliveryMap(rows: BhavcopyRow[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const r of rows) {
    if (r.deliv_per == null) continue;
    if (r.series === "EQ" || map[r.symbol] == null) map[r.symbol] = r.deliv_per;
  }
  return map;
}

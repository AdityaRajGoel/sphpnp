import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Reads the daily NSE bulk & block deals fed by sync-bhavcopy (latest published
// day only). Stays gracefully empty until the migration + function are deployed
// and the first sync has run.
export type BulkDealRow = {
  trade_date: string;
  deal_type: "bulk" | "block";
  symbol: string;
  security_name: string | null;
  client_name: string | null;
  buy_sell: string | null;
  quantity: number | null;
  price: number | null;
};

const dealsTable = () => supabase.from("bulk_block_deals" as never) as ReturnType<typeof supabase.from>;

export function useBulkDeals() {
  const [deals, setDeals] = useState<BulkDealRow[]>([]);
  const [asOf, setAsOf] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await dealsTable()
          .select("trade_date, deal_type, symbol, security_name, client_name, buy_sell, quantity, price")
          .order("trade_date", { ascending: false })
          .limit(1000);
        if (cancelled) return;
        const list = (data as BulkDealRow[] | null) ?? [];
        setDeals(list);
        setAsOf(list[0]?.trade_date ?? null);
      } catch {
        // table not deployed yet / no data - remain empty
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { deals, asOf, loading };
}

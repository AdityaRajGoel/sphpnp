import { useEffect, useState } from "react";
import { loadStockDisclosures, type StockDisclosures } from "@/lib/stock-disclosures";

/** A stock's NSE insider trades, BSE announcements and latest NSE shareholding filing. Null until loaded; empty on failure. */
export function useStockDisclosures(symbol: string | undefined): StockDisclosures | null {
  const [data, setData] = useState<StockDisclosures | null>(null);
  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    setData(null);
    loadStockDisclosures(symbol.toUpperCase())
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setData({ trades: [], announcements: [], shareholding: null }); });
    return () => { cancelled = true; };
  }, [symbol]);
  return data;
}

import { useEffect, useState } from "react";
import { emptyStockAnalytics, loadStockAnalytics, type StockAnalytics } from "@/lib/stock-analytics";

/**
 * A stock's computed risk, technical and fundamental measures. Null while
 * loading; an all-null shape on failure, so the panels render their own
 * "not available yet" rather than the page erroring.
 */
export function useStockAnalytics(symbol: string | undefined): StockAnalytics | null {
  const [data, setData] = useState<StockAnalytics | null>(null);

  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    setData(null);
    loadStockAnalytics(symbol.toUpperCase())
      .then((result) => { if (!cancelled) setData(result); })
      .catch(() => { if (!cancelled) setData(emptyStockAnalytics); });
    return () => { cancelled = true; };
  }, [symbol]);

  return data;
}

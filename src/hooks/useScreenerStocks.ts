import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ScreenerStock = {
  symbol: string;
  name: string;
  sector: string;
  price: number;
  change: number;
  change_pct: number;
  market_cap: number;
  pe: number;
  high_52: number;
  low_52: number;
  volume: number;
  day_high: number;
  day_low: number;
  open_price: number;
  prev_close: number;
  updated_at: string;
};

export function useScreenerStocks() {
  const [stocks, setStocks] = useState<ScreenerStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mapStock = useCallback((s: { symbol: string; name: string; sector?: string; yahoo?: string; updated_at: string } & Record<string, unknown>): ScreenerStock => ({
    symbol: s.symbol,
    name: s.name,
    sector: s.sector || "General",
    price: Number(s.price) || 0,
    change: Number(s.change) || 0,
    change_pct: Number(s.change_pct) || 0,
    market_cap: Number(s.market_cap) || 0,
    pe: Number(s.pe) || 0,
    high_52: Number(s.high_52) || 0,
    low_52: Number(s.low_52) || 0,
    volume: Number(s.volume) || 0,
    day_high: Number(s.day_high) || 0,
    day_low: Number(s.day_low) || 0,
    open_price: Number(s.open_price) || 0,
    prev_close: Number(s.prev_close) || 0,
    updated_at: s.updated_at,
  }), []);

  const fetchStocks = useCallback(async (refresh = false) => {
    try {
      setError(null);

      // ─── Phase 1: Load cached data from Supabase DB instantly ───────────────
      // This is a direct DB query (no Yahoo Finance), typically resolves in <200ms.
      // It lets the table render immediately with the last-known prices.
      if (!refresh) {
        const { data: cached } = await supabase
          .from("screener_stocks")
          .select("*")
          .order("market_cap", { ascending: false });

        if (cached && cached.length > 0) {
          setStocks(cached.map(mapStock));
          setUpdatedAt(cached[0]?.updated_at || null);
          setLoading(false); // ← Show table NOW, before Yahoo refresh
        }
      }

      // ─── Phase 2: Refresh prices via edge function (Yahoo Finance) ───────────
      // Runs in background - edge function checks if cache is fresh (<5 min)
      // and only fetches from Yahoo if stale. This keeps prices up-to-date.
      setRefreshing(true);
      const { data, error: fnError } = await supabase.functions.invoke("fetch-screener-data", {
        body: { refresh },
      });

      if (fnError) throw fnError;

      if (data?.success && data.stocks?.length > 0) {
        setStocks(data.stocks.map(mapStock));
        setUpdatedAt(data.updated_at);
      }
    } catch (e) {
      console.error("Failed to fetch screener stocks:", e);
      setError(e.message || "Failed to load stock data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [mapStock]);

  useEffect(() => {
    fetchStocks();
    
    // Background 5-minute interval
    const intervalId = setInterval(() => {
      if (!document.hidden) fetchStocks();
    }, 5 * 60 * 1000);

    // When bringing app from background to foreground, network radios take slightly longer to wake up.
    // We delay the refetch slightly so it doesn't instantly fail and wait another 5 minutes.
    let wakeTimeout: ReturnType<typeof setTimeout>;
    
    const handleWakeup = () => {
      if (!document.hidden) {
        clearTimeout(wakeTimeout);
        wakeTimeout = setTimeout(() => {
          fetchStocks();
        }, 800);
      }
    };

    const handleOnline = () => {
      clearTimeout(wakeTimeout);
      wakeTimeout = setTimeout(() => fetchStocks(), 500);
    };

    document.addEventListener('visibilitychange', handleWakeup);
    window.addEventListener('online', handleOnline);

    return () => {
      clearInterval(intervalId);
      clearTimeout(wakeTimeout);
      document.removeEventListener('visibilitychange', handleWakeup);
      window.removeEventListener('online', handleOnline);
    };
  }, [fetchStocks]);

  return { stocks, loading, refreshing, updatedAt, error, refresh: () => fetchStocks(true) };
}

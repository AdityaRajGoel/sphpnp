import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isTradingDay } from "@/lib/market-holidays";
import { isPrerender } from "@/lib/prerender";

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

const WEEK_MS = 7 * 86_400_000;

/** During the session a snapshot older than this is not shown at all; the live refresh fills the table. */
export const LIVE_SNAPSHOT_MAX_AGE_MS = 10 * 60_000;

/** True between 09:15 and 15:30 IST on an NSE trading day. */
export function isMarketHours(now: Date = new Date()): boolean {
  const ist = new Date(now.getTime() + 5.5 * 3_600_000);
  const date = ist.toISOString().slice(0, 10);
  if (!isTradingDay(date)) return false;
  const minutes = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  return minutes >= 9 * 60 + 15 && minutes <= 15 * 60 + 30;
}

/**
 * Whether a stored snapshot may be shown before the live refresh answers.
 * Outside market hours the last close IS the current price, so any recent
 * snapshot is fine; during the session an old one would put yesterday's or
 * this morning's prices on screen as if they were live.
 */
export function snapshotIsShowable(updatedAt: string | null | undefined, now: Date = new Date()): boolean {
  const t = Date.parse(updatedAt ?? "");
  if (!Number.isFinite(t)) return false;
  return !isMarketHours(now) || now.getTime() - t <= LIVE_SNAPSHOT_MAX_AGE_MS;
}

/**
 * The rows worth listing: priced, and quoted within a week of the freshest
 * quote. A stock that has stopped trading (delisted, suspended, or listed
 * where the quote source cannot price it) keeps its row for the per-stock
 * syncs but drops out of the tables instead of showing a dead or zero price.
 * Measured against the freshest row, not the clock, so a stalled refresh
 * cannot empty the screener.
 */
export function currentStocks(stocks: ScreenerStock[]): ScreenerStock[] {
  const freshest = Math.max(0, ...stocks.map((s) => Date.parse(s.updated_at) || 0));
  return stocks.filter((s) => s.price > 0 && freshest - (Date.parse(s.updated_at) || 0) <= WEEK_MS);
}

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

        const freshest = cached?.reduce((max, row) => (row.updated_at > max ? row.updated_at : max), "") ?? "";
        if (cached && cached.length > 0 && snapshotIsShowable(freshest)) {
          setStocks(currentStocks(cached.map(mapStock)));
          setUpdatedAt(freshest || null);
          setLoading(false); // Show the table now - the snapshot is current enough to be true.
        }
      }

      // The static capture keeps the stored snapshot only; the live refresh is for visitors.
      if (isPrerender()) return;

      // ─── Phase 2: Refresh prices via edge function (Yahoo Finance) ───────────
      // Runs in background - edge function checks if cache is fresh (<5 min)
      // and only fetches from Yahoo if stale. This keeps prices up-to-date.
      setRefreshing(true);
      const { data, error: fnError } = await supabase.functions.invoke("fetch-screener-data", {
        body: { refresh },
      });

      if (fnError) throw fnError;

      if (data?.success && data.stocks?.length > 0) {
        setStocks(currentStocks(data.stocks.map(mapStock)));
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

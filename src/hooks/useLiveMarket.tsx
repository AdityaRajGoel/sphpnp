import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export type LiveIndex = {
  key: string;
  name: string;
  price: string;
  change: string;
  changeValue?: string;
  up: boolean;
  open?: string;
  high?: string;
  low?: string;
  prevClose?: string;
  volume?: string;
};

export type LiveStock = {
  name: string;
  price: string;
  change: string;
  up: boolean;
  unit?: string;
  volume?: string;
  high?: string;
  low?: string;
  changePercent?: number;
};

export type SectorData = {
  name: string;
  change: string;
  changePercent: number;
  up: boolean;
  weight: number;
};

export type GlobalMarket = {
  name: string;
  price: string;
  change: string;
  up: boolean;
};

export type MarketOverviewData = {
  gainers: LiveStock[];
  losers: LiveStock[];
  mostActive: LiveStock[];
  advances: number;
  declines: number;
  unchanged: number;
};

type LiveMarketContextType = {
  indices: LiveIndex[];
  stocks: LiveStock[];
  commodities: LiveStock[];
  globalMarkets: GlobalMarket[];
  sectors: SectorData[];
  vix: LiveStock | null;
  marketOverview: MarketOverviewData | null;
  marketOpen: boolean;
  marketStatusText: string;
  lastTradingDate: string | null;
  nextMarketOpen: string | null;
  marketClose: string | null;
  fetchedAt: string | null;
  loading: boolean;
  refresh: () => void;
};

const LiveMarketContext = createContext<LiveMarketContextType>({
  indices: [],
  stocks: [],
  commodities: [],
  globalMarkets: [],
  sectors: [],
  vix: null,
  marketOverview: null,
  marketOpen: false,
  marketStatusText: "Market Closed",
  lastTradingDate: null,
  nextMarketOpen: null,
  marketClose: null,
  fetchedAt: null,
  loading: true,
  refresh: () => {},
});

export const useLiveMarket = () => useContext(LiveMarketContext);

/**
 * How old the last good fetch may be before a returning visitor is shown a
 * loading state instead of it. Matches the refresh cadence: one missed poll.
 */
export const STALE_AFTER_MS = { open: 90_000, closed: 6 * 60_000 } as const;

/** Whether data fetched at `fetchedAt` is too old to keep on screen. */
export function isStale(fetchedAt: string | null, marketOpen: boolean, now = Date.now()): boolean {
  if (!fetchedAt) return true;
  const age = now - Date.parse(fetchedAt);
  return !Number.isFinite(age) || age > (marketOpen ? STALE_AFTER_MS.open : STALE_AFTER_MS.closed);
}

export const LiveMarketProvider = ({ children }: { children: ReactNode }) => {
  /*
   * Everything starts EMPTY, with loading true. This provider used to start
   * from hardcoded "fallback" quotes - NIFTY 22,147, gold ₹62,450 and so on -
   * so every visit painted invented prices first and swapped in real ones a
   * second or two later, and a failed fetch left them up indefinitely. Every
   * consumer already renders a skeleton while `loading` is true.
   */
  const [indices, setIndices] = useState<LiveIndex[]>([]);
  const [stocks, setStocks] = useState<LiveStock[]>([]);
  const [commodities, setCommodities] = useState<LiveStock[]>([]);
  const [globalMarkets, setGlobalMarkets] = useState<GlobalMarket[]>([]);
  const [sectors, setSectors] = useState<SectorData[]>([]);
  const [vix, setVix] = useState<LiveStock | null>(null);
  const [marketOverview, setMarketOverview] = useState<MarketOverviewData | null>(null);
  const [marketOpen, setMarketOpen] = useState(false);
  const [marketStatusText, setMarketStatusText] = useState("Market Closed");
  const [lastTradingDate, setLastTradingDate] = useState<string | null>(null);
  const [nextMarketOpen, setNextMarketOpen] = useState<string | null>(null);
  const [marketClose, setMarketClose] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('fetch-stock-prices');
      if (!error && data?.success) {
        if (data.indices?.length > 0) setIndices(data.indices);
        if (data.data?.length > 0) setStocks(data.data);
        if (data.commodities?.length > 0) {
          const processedCommodities = data.commodities.map((c: { name: string; price: string } & Record<string, unknown>) => {
            if (c.name.toLowerCase().includes('aluminium') && c.price) {
              const rawPrice = parseFloat(c.price.replace(/[^\d.-]/g, ''));
              if (!isNaN(rawPrice) && rawPrice > 10000) {
                // MCX Aluminium is usually ~₹250/kg, but API might return ₹250,000/tonne
                const scaledPrice = rawPrice / 1000;
                return { ...c, price: `₹${scaledPrice.toFixed(2)}` };
              }
            }
            return c;
          });
          setCommodities(processedCommodities);
        }
        if (data.globalMarkets?.length > 0) setGlobalMarkets(data.globalMarkets);
        if (data.sectors?.length > 0) setSectors(data.sectors);
        if (data.vix) setVix(data.vix);
        if (data.marketOverview) setMarketOverview(data.marketOverview);
        if (data.fetchedAt) setFetchedAt(data.fetchedAt);
        if (typeof data.marketOpen === 'boolean') setMarketOpen(data.marketOpen);
        if (data.marketStatusText) setMarketStatusText(data.marketStatusText);
        if (data.lastTradingDate) setLastTradingDate(data.lastTradingDate);
        setNextMarketOpen(data.nextMarketOpen || null);
        setMarketClose(data.marketClose || null);
      }
    } catch {
      // keep showing the last good data
    } finally {
      setLoading(false);
    }
  }, []);

  const marketOpenRef = useRef(marketOpen);
  marketOpenRef.current = marketOpen;
  const fetchedAtRef = useRef(fetchedAt);
  fetchedAtRef.current = fetchedAt;

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    let initialTimer: ReturnType<typeof setTimeout> | null = null;
    let wakeTimeout: ReturnType<typeof setTimeout> | null = null;
    let visible = !document.hidden;

    const startInterval = () => {
      if (interval) clearInterval(interval);
      const ms = marketOpenRef.current ? 60_000 : 300_000;
      interval = setInterval(() => {
        if (!document.hidden) fetchData();
      }, ms);
    };

    const handleWakeup = () => {
      visible = !document.hidden;
      if (visible) {
        // Back after a while: hide the old quotes behind the loading state now,
        // rather than leaving them up as if live until the refetch lands.
        if (isStale(fetchedAtRef.current, marketOpenRef.current)) setLoading(true);
        if (wakeTimeout) clearTimeout(wakeTimeout);
        wakeTimeout = setTimeout(() => {
          fetchData();
          startInterval();
        }, 800);
      } else if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    const handleOnline = () => {
      if (wakeTimeout) clearTimeout(wakeTimeout);
      wakeTimeout = setTimeout(() => {
        if (!document.hidden) {
          fetchData();
          startInterval();
        }
      }, 500);
    };

    // Fetched straight away: with no invented placeholder quotes to show, a
    // delay here would only lengthen the skeleton. The request is async and
    // does not block rendering.
    initialTimer = setTimeout(() => {
      fetchData();
      startInterval();
    }, 0);
    
    document.addEventListener('visibilitychange', handleWakeup);
    window.addEventListener('online', handleOnline);

    return () => {
      if (initialTimer) clearTimeout(initialTimer);
      if (wakeTimeout) clearTimeout(wakeTimeout);
      if (interval) clearInterval(interval);
      document.removeEventListener('visibilitychange', handleWakeup);
      window.removeEventListener('online', handleOnline);
    };
  }, [fetchData]);

  return (
    <LiveMarketContext.Provider value={{ indices, stocks, commodities, globalMarkets, sectors, vix, marketOverview, marketOpen, marketStatusText, lastTradingDate, nextMarketOpen, marketClose, fetchedAt, loading, refresh: fetchData }}>
      {children}
    </LiveMarketContext.Provider>
  );
};

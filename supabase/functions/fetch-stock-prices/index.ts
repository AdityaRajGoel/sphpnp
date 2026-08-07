const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const INDEX_SYMBOLS = [
  { symbol: "^NSEI", name: "NIFTY 50", key: "NIFTY" },
  { symbol: "^BSESN", name: "SENSEX", key: "SENSEX" },
  { symbol: "^NSEBANK", name: "BANK NIFTY", key: "BANKNIFTY" },
  { symbol: "^CNXIT", name: "NIFTY IT", key: "NIFTYIT" },
  { symbol: "^CNXFIN", name: "NIFTY FIN", key: "NIFTYFIN" },
];

const STOCK_SYMBOLS = [
  { symbol: "RELIANCE.NS", name: "RELIANCE" },
  { symbol: "TCS.NS", name: "TCS" },
  { symbol: "HDFCBANK.NS", name: "HDFC BANK" },
  { symbol: "INFY.NS", name: "INFOSYS" },
  { symbol: "ICICIBANK.NS", name: "ICICI BANK" },
  { symbol: "ITC.NS", name: "ITC" },
  { symbol: "BAJFINANCE.NS", name: "BAJAJ FIN" },
  { symbol: "TATAMOTORS.NS", name: "TATA MOTORS" },
  { symbol: "SBIN.NS", name: "SBI" },
  { symbol: "BHARTIARTL.NS", name: "BHARTI AIRTEL" },
  { symbol: "WIPRO.NS", name: "WIPRO" },
  { symbol: "HCLTECH.NS", name: "HCL TECH" },
  { symbol: "TATASTEEL.NS", name: "TATA STEEL" },
  { symbol: "ADANIENT.NS", name: "ADANI ENT" },
  { symbol: "LT.NS", name: "L&T" },
];

const MARKET_SYMBOLS = [
  { symbol: "TATAPOWER.NS", name: "TATA POWER" },
  { symbol: "ADANIGREEN.NS", name: "ADANI GREEN" },
  { symbol: "ZOMATO.NS", name: "ZOMATO" },
  { symbol: "BAJFINANCE.NS", name: "BAJAJ FIN" },
  { symbol: "HDFCBANK.NS", name: "HDFC BANK" },
  { symbol: "WIPRO.NS", name: "WIPRO" },
  { symbol: "COALINDIA.NS", name: "COAL INDIA" },
  { symbol: "HINDALCO.NS", name: "HINDALCO" },
  { symbol: "TECHM.NS", name: "TECH MAHI" },
  { symbol: "TATASTEEL.NS", name: "TATA STEEL" },
  { symbol: "SBIN.NS", name: "SBIN" },
  { symbol: "ITC.NS", name: "ITC" },
  { symbol: "TATAMOTORS.NS", name: "TATAMOTORS" },
  { symbol: "ICICIBANK.NS", name: "ICICIBANK" },
  { symbol: "MARUTI.NS", name: "MARUTI" },
  { symbol: "RELIANCE.NS", name: "RELIANCE" },
  { symbol: "HDFCLIFE.NS", name: "HDFCLIFE" },
  { symbol: "INFY.NS", name: "INFOSYS" },
  { symbol: "BHARTIARTL.NS", name: "BHARTI AIRTEL" },
  { symbol: "LT.NS", name: "L&T" },
];

const ET_COMMODITIES = [
  { symbol: "GOLD", name: "GOLD", unit: "₹/10g" }, 
  { symbol: "SILVER", name: "SILVER", unit: "₹/kg" }, 
  { symbol: "CRUDEOIL", name: "CRUDE OIL", unit: "₹/bbl" },
  { symbol: "NATURALGAS", name: "NAT GAS", unit: "₹/MMBtu" },
  { symbol: "COPPER", name: "COPPER", unit: "₹/kg" }, 
  { symbol: "ALUMINIUM", name: "ALUMINIUM", unit: "₹/kg" },
];

const YAHOO_CURRENCIES = [
  { symbol: "USDINR=X", name: "USD/INR", unit: "" },
  { symbol: "EURINR=X", name: "EUR/INR", unit: "" },
  { symbol: "GBPINR=X", name: "GBP/INR", unit: "" },
  { symbol: "^INDIAVIX", name: "INDIA VIX", unit: "" },
];

// Global market indices
const GLOBAL_SYMBOLS = [
  { symbol: "^GSPC", name: "S&P 500" },
  { symbol: "^IXIC", name: "NASDAQ" },
  { symbol: "^DJI", name: "DOW JONES" },
  { symbol: "^HSI", name: "HANG SENG" },
  { symbol: "^N225", name: "NIKKEI 225" },
  { symbol: "^FTSE", name: "FTSE 100" },
];

// Sector index symbols for live sector data
const SECTOR_SYMBOLS = [
  { symbol: "^CNXIT", name: "IT", weight: 18 },
  { symbol: "^NSEBANK", name: "Banks", weight: 25 },
  { symbol: "^CNXPHARMA", name: "Pharma", weight: 10 },
  { symbol: "^CNXAUTO", name: "Auto", weight: 12 },
  { symbol: "^CNXENERGY", name: "Energy", weight: 15 },
  { symbol: "^CNXFMCG", name: "FMCG", weight: 8 },
  { symbol: "^CNXREALTY", name: "Realty", weight: 5 },
  { symbol: "^CNXMETAL", name: "Metal", weight: 7 },
];

interface QuoteResult {
  price: number;
  change: number;
  changePercent: number;
  open?: number;
  high?: number;
  low?: number;
  prevClose?: number;
  volume?: number;
}

async function fetchETCommodity(symbol: string) {
  try {
    const res = await fetch(`https://economictimes.indiatimes.com/commoditysummary/symbol-${symbol}.cms`, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    if (!res.ok) {
      console.error(`ET commodity fetch non-OK for ${symbol}: HTTP ${res.status}`);
      return null;
    }
    const html = await res.text();
    const priceMatch = html.match(/class="commodityPrice"[^>]*>([^<]+)<\//i);
    const changeMatch = html.match(/class="data perChng"[^>]*>([^<]+)<\//i);

    if (!priceMatch) {
      console.error(`ET commodity parse error for ${symbol}: price element not found`);
      return null;
    }

    const price = parseFloat(priceMatch[1].replace(/,/g, ''));
    let changePercent = 0;
    if (changeMatch) {
      const pMatch = changeMatch[1].match(/\(([^)]+)\)/);
      if (pMatch) {
        changePercent = parseFloat(pMatch[1].replace('%',''));
      }
    }

    return {
      price,
      changePercent,
      up: changePercent >= 0
    };
  } catch (e) {
    console.error(`ET commodity fetch error for ${symbol}:`, e);
    return null;
  }
}

async function fetchYahooQuote(symbol: string): Promise<QuoteResult | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    if (!res.ok) {
      console.error(`Yahoo quote fetch non-OK for ${symbol}: HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) {
      console.error(`Yahoo quote parse error for ${symbol}: no chart result in response`);
      return null;
    }

    const meta = result.meta;
    const price = meta.regularMarketPrice;
    const prevClose = meta.chartPreviousClose || meta.previousClose;
    const change = price - prevClose;
    const changePercent = prevClose ? (change / prevClose) * 100 : 0;

    const indicators = result.indicators?.quote?.[0];
    const lastIdx = indicators?.close?.length ? indicators.close.length - 1 : 0;

    return {
      price,
      change,
      changePercent,
      open: indicators?.open?.[lastIdx] || meta.regularMarketOpen || undefined,
      high: indicators?.high?.[lastIdx] || meta.regularMarketDayHigh || undefined,
      low: indicators?.low?.[lastIdx] || meta.regularMarketDayLow || undefined,
      prevClose,
      volume: indicators?.volume?.[lastIdx] || meta.regularMarketVolume || undefined,
    };
  } catch (e) {
    console.error(`Yahoo quote fetch error for ${symbol}:`, e);
    return null;
  }
}

function formatPrice(price: number, isINR = true): string {
  if (isINR) return price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatVolume(vol?: number): string {
  if (!vol) return "-";
  if (vol >= 10000000) return `${(vol / 10000000).toFixed(1)}Cr`;
  if (vol >= 100000) return `${(vol / 100000).toFixed(1)}L`;
  if (vol >= 1000) return `${(vol / 1000).toFixed(1)}K`;
  return vol.toString();
}

function getIndianMarketStatus(): { isOpen: boolean; lastTradingDate: string; statusText: string; nextMarketOpenISO: string | null; marketCloseISO: string | null } {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffset + now.getTimezoneOffset() * 60000);
  
  const day = istNow.getDay();
  const hours = istNow.getHours();
  const minutes = istNow.getMinutes();
  const timeInMinutes = hours * 60 + minutes;
  
  const marketOpenMin = 9 * 60 + 15;
  const marketCloseMin = 15 * 60 + 30;
  
  const isWeekday = day >= 1 && day <= 5;
  const isDuringHours = timeInMinutes >= marketOpenMin && timeInMinutes <= marketCloseMin;
  const isOpen = isWeekday && isDuringHours;
  
  // Calculate last trading date
  const istDate = new Date(istNow);
  if (!isWeekday || (isWeekday && timeInMinutes < marketOpenMin)) {
    const d = new Date(istDate);
    if (timeInMinutes < marketOpenMin && isWeekday) {
      d.setDate(d.getDate() - 1);
    }
    while (d.getDay() === 0 || d.getDay() === 6) {
      d.setDate(d.getDate() - 1);
    }
    istDate.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
  }
  
  const lastTradingDate = `${istDate.getFullYear()}-${String(istDate.getMonth() + 1).padStart(2, '0')}-${String(istDate.getDate()).padStart(2, '0')}`;
  
  let statusText = "Market Closed";
  if (isOpen) {
    statusText = "Market Open";
  } else if (isWeekday && timeInMinutes > marketCloseMin) {
    statusText = "After Hours";
  } else if (isWeekday && timeInMinutes < marketOpenMin) {
    statusText = "Pre-Market";
  }
  
  // Calculate next market open in UTC ISO
  let nextMarketOpenISO: string | null = null;
  let marketCloseISO: string | null = null;
  
  if (isOpen) {
    // Market closes today at 15:30 IST → convert to UTC
    const closeUTC = new Date(istNow);
    closeUTC.setHours(15, 30, 0, 0);
    // Convert IST back to UTC: subtract 5:30
    const closeUTCTime = new Date(closeUTC.getTime() - istOffset + now.getTimezoneOffset() * 60000);
    // Actually just compute from `now` directly
    const remainingMin = marketCloseMin - timeInMinutes;
    marketCloseISO = new Date(now.getTime() + remainingMin * 60000).toISOString();
  }
  
  if (!isOpen) {
    // Find next weekday
    const nextDay = new Date(istNow);
    if (isWeekday && timeInMinutes > marketCloseMin) {
      nextDay.setDate(nextDay.getDate() + 1);
    } else if (isWeekday && timeInMinutes < marketOpenMin) {
      // Same day, just wait
    } else {
      nextDay.setDate(nextDay.getDate() + 1);
    }
    while (nextDay.getDay() === 0 || nextDay.getDay() === 6) {
      nextDay.setDate(nextDay.getDate() + 1);
    }
    // Set to 9:15 AM IST
    nextDay.setHours(9, 15, 0, 0);
    // Convert IST to UTC offset from now
    const diffMs = nextDay.getTime() - istNow.getTime();
    nextMarketOpenISO = new Date(now.getTime() + diffMs).toISOString();
  }
  
  return { isOpen, lastTradingDate, statusText, nextMarketOpenISO, marketCloseISO };
}

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CACHE_KEY = "stock_prices";
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes when market open, check below

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const marketStatus = getIndianMarketStatus();

    // Try to return cached data first
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    let sb: any = null;
    // Hoisted out of the block below so it's still available further down as
    // a last-resort stale fallback if every live source fails this request.
    let cachedRow: { data: any; updated_at: string } | null = null;
    if (supabaseUrl && serviceKey) {
      sb = createClient(supabaseUrl, serviceKey);
      const { data: cached, error: cacheReadError } = await sb
        .from("market_cache")
        .select("data, updated_at")
        .eq("id", CACHE_KEY)
        .single();

      // PGRST116 ("no rows") is expected on a cold cache and isn't an error
      // worth logging; anything else (permissions, connectivity) is.
      if (cacheReadError && cacheReadError.code !== "PGRST116") {
        console.error("market_cache read failed:", cacheReadError);
      }

      if (cached) {
        cachedRow = cached;
        const age = Date.now() - new Date(cached.updated_at).getTime();
        const ttl = marketStatus.isOpen ? CACHE_TTL_MS : 10 * 60 * 1000; // 10 min when closed
        if (age < ttl) {
          return new Response(
            JSON.stringify({ ...cached.data, cached: true, stale: false }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }
    const [indexResults, stockResults, marketResults, commodityResults, globalResults, sectorResults] = await Promise.all([
      Promise.all(INDEX_SYMBOLS.map(async (idx) => {
        const q = await fetchYahooQuote(idx.symbol);
        if (!q) return null;
        return {
          key: idx.key,
          name: idx.name,
          price: formatPrice(q.price),
          change: `${q.changePercent >= 0 ? '+' : ''}${q.changePercent.toFixed(2)}%`,
          changeValue: `${q.change >= 0 ? '+' : ''}${formatPrice(Math.abs(q.change))}`,
          up: q.changePercent >= 0,
          open: q.open ? formatPrice(q.open) : undefined,
          high: q.high ? formatPrice(q.high) : undefined,
          low: q.low ? formatPrice(q.low) : undefined,
          prevClose: q.prevClose ? formatPrice(q.prevClose) : undefined,
          volume: formatVolume(q.volume),
        };
      })),
      Promise.all(STOCK_SYMBOLS.map(async (stock) => {
        const q = await fetchYahooQuote(stock.symbol);
        if (!q) return null;
        return {
          name: stock.name,
          price: formatPrice(q.price),
          change: `${q.changePercent >= 0 ? '+' : ''}${q.changePercent.toFixed(2)}%`,
          up: q.changePercent >= 0,
        };
      })),
      Promise.all(MARKET_SYMBOLS.map(async (stock) => {
        const q = await fetchYahooQuote(stock.symbol);
        if (!q) return null;
        return {
          // The Yahoo symbol is carried through so the client can fetch a real
          // chart for this scrip. Without it MarketOverview had no way to ask
          // for history and drew a generated series instead.
          symbol: stock.symbol,
          name: stock.name,
          price: `₹${formatPrice(q.price)}`,
          change: `${q.changePercent >= 0 ? '+' : ''}${q.changePercent.toFixed(2)}%`,
          changePercent: q.changePercent,
          up: q.changePercent >= 0,
          volume: formatVolume(q.volume),
          high: q.high ? `₹${formatPrice(q.high)}` : undefined,
          low: q.low ? `₹${formatPrice(q.low)}` : undefined,
        };
      })),
      // Fetch ET Commodities and Yahoo Currencies independently
      (async () => {
        const etResults = await Promise.all(ET_COMMODITIES.map(async (item) => {
          const q = await fetchETCommodity(item.symbol);
          if (!q) return null;
          return {
            name: item.name,
            price: `₹${formatPrice(q.price)}`,
            change: `${q.changePercent >= 0 ? '+' : ''}${q.changePercent.toFixed(2)}%`,
            up: q.changePercent >= 0,
            unit: item.unit,
          };
        }));
        
        const currencyResults = await Promise.all(YAHOO_CURRENCIES.map(async (item) => {
          const q = await fetchYahooQuote(item.symbol);
          if (!q) return null;
          return {
            name: item.name,
            price: formatPrice(q.price, false),
            change: `${q.changePercent >= 0 ? '+' : ''}${q.changePercent.toFixed(2)}%`,
            up: q.changePercent >= 0,
            unit: item.unit,
          };
        }));
        
        return [...etResults, ...currencyResults];
      })(),
      // Global markets
      Promise.all(GLOBAL_SYMBOLS.map(async (g) => {
        const q = await fetchYahooQuote(g.symbol);
        if (!q) return null;
        return {
          name: g.name,
          price: formatPrice(q.price, false),
          change: `${q.changePercent >= 0 ? '+' : ''}${q.changePercent.toFixed(2)}%`,
          up: q.changePercent >= 0,
        };
      })),
      // Sector performance
      Promise.all(SECTOR_SYMBOLS.map(async (s) => {
        const q = await fetchYahooQuote(s.symbol);
        if (!q) return null;
        return {
          name: s.name,
          change: `${q.changePercent >= 0 ? '+' : ''}${q.changePercent.toFixed(2)}%`,
          changePercent: q.changePercent,
          up: q.changePercent >= 0,
          weight: s.weight,
        };
      })),
    ]);

    const validMarket = marketResults.filter(Boolean) as any[];
    const gainers = validMarket.filter(s => s.up).sort((a: any, b: any) => b.changePercent - a.changePercent).slice(0, 7);
    const losers = validMarket.filter(s => !s.up).sort((a: any, b: any) => a.changePercent - b.changePercent).slice(0, 7);
    const mostActive = [...validMarket].sort((a: any, b: any) => {
      const volA = parseFloat(a.volume?.replace(/[CLK]/g, '') || '0');
      const volB = parseFloat(b.volume?.replace(/[CLK]/g, '') || '0');
      return volB - volA;
    }).slice(0, 7);

    const advances = validMarket.filter(s => s.up).length;
    const declines = validMarket.filter(s => !s.up).length;

    // Extract VIX from commodities
    const vixResult = commodityResults.find(c => c?.name === "INDIA VIX");

    const indices = indexResults.filter(Boolean);
    const stocksData = stockResults.filter(Boolean);
    const commodities = commodityResults.filter(Boolean);
    const globalMarkets = globalResults.filter(Boolean);
    const sectors = sectorResults.filter(Boolean);

    // Every per-symbol fetch already fails soft to null so one blocked quote
    // never breaks the whole response. But if literally everything came back
    // null - every index, stock, commodity, global index and sector - that's
    // not a handful of quiet symbols, it's the upstream (Yahoo/ET) being
    // unreachable entirely. Previously this still built and cached a
    // `success: true` response full of empty arrays, so a total outage was
    // indistinguishable from a market with nothing to report, AND that empty
    // snapshot got written into market_cache and kept being served as "fresh"
    // for the next 2-10 minutes.
    const allEmpty = indices.length === 0
      && stocksData.length === 0
      && validMarket.length === 0
      && commodities.length === 0
      && globalMarkets.length === 0
      && sectors.length === 0;

    if (allEmpty) {
      console.error('Live stock price fetch returned zero results across every source (indices, stocks, market movers, commodities, global markets, sectors) - treating as a total upstream outage.');

      if (cachedRow) {
        // Serve the last known-good snapshot instead of an empty page, but
        // mark it stale so this is distinguishable from a normal cache hit.
        return new Response(
          JSON.stringify({ ...cachedRow.data, cached: true, stale: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // No live data and nothing cached to fall back to - there is genuinely
      // nothing to serve, so this must not report success.
      return new Response(
        JSON.stringify({ success: false, error: 'Live market data is temporarily unavailable' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const responseData = {
      success: true,
      indices,
      data: stocksData,
      commodities,
      globalMarkets,
      sectors,
      vix: vixResult || null,
      marketOverview: {
        gainers,
        losers,
        mostActive,
        advances,
        declines,
        unchanged: Math.max(0, validMarket.length - advances - declines),
      },
      marketOpen: marketStatus.isOpen,
      marketStatusText: marketStatus.statusText,
      lastTradingDate: marketStatus.lastTradingDate,
      nextMarketOpen: marketStatus.nextMarketOpenISO,
      marketClose: marketStatus.marketCloseISO,
      fetchedAt: new Date().toISOString(),
    };

    // Cache the result. postgrest-js resolves with an { error } object on
    // failure instead of throwing, so a bare try/catch here would never see
    // a rejected write - it has to be checked explicitly.
    if (sb) {
      try {
        const { error: cacheWriteError } = await sb.from("market_cache").upsert({
          id: CACHE_KEY,
          data: responseData,
          updated_at: new Date().toISOString(),
        });
        if (cacheWriteError) {
          console.error("Cache write failed:", cacheWriteError);
        }
      } catch (e) {
        console.error("Cache write failed:", e);
      }
    }

    return new Response(
      JSON.stringify(responseData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching stock prices:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Failed to fetch stock prices' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

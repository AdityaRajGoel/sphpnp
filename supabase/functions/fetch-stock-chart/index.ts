import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Map NSE symbols to Yahoo Finance symbols
function toYahoo(symbol: string): string {
  if (symbol === "NIFTY" || symbol === "NIFTY 50") return "^NSEI";
  if (symbol === "BANKNIFTY" || symbol === "BANK NIFTY") return "^NSEBANK";
  if (symbol === "SENSEX") return "^BSESN";
  if (symbol === "NIFTYIT" || symbol === "NIFTY IT") return "^CNXIT";
  if (symbol === "FINNIFTY" || symbol === "NIFTY FIN" || symbol === "NIFTYFIN") return "NIFTY_FIN_SERVICE.NS";
  
  // Handle special characters
  const cleaned = symbol.replaceAll("&", "%26");

  // Idempotent: callers may pass a bare NSE code ("WIPRO") or a symbol that is
  // already Yahoo-shaped. fetch-stock-prices now forwards the latter, and
  // appending unconditionally produced "HDFCLIFE.NS.NS", which Yahoo answers
  // with a 404.
  if (/^\^/.test(cleaned) || /\.(NS|BO)$/i.test(cleaned)) return cleaned;

  return `${cleaned}.NS`;
}

type TimeRange = "1d" | "5d" | "1mo" | "3mo" | "6mo" | "1y" | "5y";

const INTERVAL_MAP: Record<TimeRange, string> = {
  "1d": "5m",
  "5d": "15m",
  "1mo": "1d",
  "3mo": "1d",
  "6mo": "1d",
  "1y": "1wk",
  "5y": "1mo",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbol, range = "3mo" } = await req.json().catch(() => ({ symbol: "", range: "3mo" }));

    if (!symbol) {
      return new Response(JSON.stringify({ success: false, error: "Symbol required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const timeRange = (["1d", "5d", "1mo", "3mo", "6mo", "1y", "5y"].includes(range) ? range : "3mo") as TimeRange;
    const interval = INTERVAL_MAP[timeRange];
    const yahooSymbol = toYahoo(symbol);

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?range=${timeRange}&interval=${interval}&includePrePost=false`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ success: false, error: `Yahoo API returned ${res.status}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) {
      return new Response(JSON.stringify({ success: false, error: "No data returned" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const timestamps = result.timestamp || [];
    const quotes = result.indicators?.quote?.[0] || {};
    const closes = quotes.close || [];
    const highs = quotes.high || [];
    const lows = quotes.low || [];
    const opens = quotes.open || [];
    const volumes = quotes.volume || [];

    // Build clean data points, filtering out nulls
    const dataPoints: { t: number; o: number; h: number; l: number; c: number; v: number }[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (closes[i] != null && timestamps[i] != null) {
        dataPoints.push({
          t: timestamps[i] * 1000, // ms
          o: opens[i] ?? closes[i],
          h: highs[i] ?? closes[i],
          l: lows[i] ?? closes[i],
          c: closes[i],
          v: volumes[i] ?? 0,
        });
      }
    }

    const meta = result.meta;

    return new Response(JSON.stringify({
      success: true,
      symbol,
      range: timeRange,
      interval,
      currency: meta?.currency || "INR",
      dataPoints,
      previousClose: meta?.chartPreviousClose ?? meta?.previousClose ?? 0,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

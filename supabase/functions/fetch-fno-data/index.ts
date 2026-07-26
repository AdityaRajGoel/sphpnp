import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

function cacheKey(symbol: string, expiry?: string) {
  return `fno_${symbol}_${expiry || "default"}`;
}

async function getCachedData(symbol: string, expiry?: string) {
  try {
    const sb = getSupabase();
    const key = cacheKey(symbol, expiry);
    const { data } = await sb.from("market_cache").select("*").eq("id", key).single();
    if (data) {
      const age = Date.now() - new Date(data.updated_at).getTime();
      if (age < 5 * 60 * 1000) {
        return data.data;
      }
    }
  } catch { /* ignore */ }
  return null;
}

async function setCachedData(symbol: string, expiry: string | undefined, payload: any) {
  try {
    const sb = getSupabase();
    const key = cacheKey(symbol, expiry);
    await sb.from("market_cache").upsert({
      id: key,
      data: payload,
      updated_at: new Date().toISOString(),
    });
  } catch { /* ignore */ }
}

// ── NSE Data Fetching with improved cookie handling ──

const NSE_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9,hi;q=0.8",
  "Accept-Encoding": "gzip, deflate, br",
  Referer: "https://www.nseindia.com/option-chain",
  Connection: "keep-alive",
  "sec-ch-ua":
    '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-origin",
};

function extractCookies(res: Response): string[] {
  const cookies: string[] = [];
  // Try getSetCookie first (Deno standard)
  if (typeof res.headers.getSetCookie === "function") {
    cookies.push(...res.headers.getSetCookie());
  } else {
    // Fallback: iterate headers
    res.headers.forEach((value, key) => {
      if (key.toLowerCase() === "set-cookie") {
        cookies.push(value);
      }
    });
  }
  return cookies;
}

async function getNSECookies(): Promise<string> {
  const mainRes = await fetch("https://www.nseindia.com", {
    headers: { ...NSE_HEADERS, Referer: "https://www.google.com/" },
    redirect: "follow",
  });
  await mainRes.text();
  const mainCookies = extractCookies(mainRes);

  await new Promise((r) => setTimeout(r, 300));

  const res = await fetch("https://www.nseindia.com/option-chain", {
    headers: {
      ...NSE_HEADERS,
      Cookie: mainCookies.map((c) => c.split(";")[0]).join("; "),
    },
    redirect: "follow",
  });
  await res.text();
  const setCookies = extractCookies(res);

  const allCookies = [...mainCookies, ...setCookies];
  const cookies = allCookies.map((c) => c.split(";")[0]).join("; ");
  if (!cookies) throw new Error("Failed to get NSE session cookies");
  return cookies;
}

async function fetchNSEOptionChain(symbol: string, cookies: string) {
  const endpoint = ["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY"].includes(symbol)
    ? `https://www.nseindia.com/api/option-chain-indices?symbol=${symbol}`
    : `https://www.nseindia.com/api/option-chain-equities?symbol=${symbol}`;

  const res = await fetch(endpoint, {
    headers: { ...NSE_HEADERS, Cookie: cookies },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`NSE API returned ${res.status}: ${text.substring(0, 200)}`);
  }
  return await res.json();
}

// ── Process real NSE data ──

interface OptionRow {
  strike: number;
  callOI: number;
  callChange: number;
  callLTP: number;
  callIV: number;
  callVolume: number;
  putOI: number;
  putChange: number;
  putLTP: number;
  putIV: number;
  putVolume: number;
}

function processNSEData(nseData: any, selectedExpiry?: string) {
  const records = nseData?.records;
  const filtered = nseData?.filtered;
  if (!records?.data?.length) throw new Error("No options data available from NSE");

  const spot =
    records.underlyingValue ||
    filtered?.data?.[0]?.PE?.underlyingValue ||
    filtered?.data?.[0]?.CE?.underlyingValue ||
    0;
  const expiryDates: string[] = records.expiryDates || [];
  const expiries = expiryDates.map((d: string) => ({ timestamp: d, label: d }));
  const activeExpiry = selectedExpiry || expiryDates[0];
  const dataForExpiry = records.data.filter((row: any) => row.expiryDate === activeExpiry);

  const strikeMap = new Map<number, OptionRow>();
  for (const row of dataForExpiry) {
    const strike = row.strikePrice;
    if (!strikeMap.has(strike)) {
      strikeMap.set(strike, {
        strike,
        callOI: 0, callChange: 0, callLTP: 0, callIV: 0, callVolume: 0,
        putOI: 0, putChange: 0, putLTP: 0, putIV: 0, putVolume: 0,
      });
    }
    const entry = strikeMap.get(strike)!;
    if (row.CE) {
      entry.callOI = row.CE.openInterest || 0;
      entry.callChange = row.CE.changeinOpenInterest || 0;
      entry.callLTP = row.CE.lastPrice || 0;
      entry.callIV = row.CE.impliedVolatility || 0;
      entry.callVolume = row.CE.totalTradedVolume || 0;
    }
    if (row.PE) {
      entry.putOI = row.PE.openInterest || 0;
      entry.putChange = row.PE.changeinOpenInterest || 0;
      entry.putLTP = row.PE.lastPrice || 0;
      entry.putIV = row.PE.impliedVolatility || 0;
      entry.putVolume = row.PE.totalTradedVolume || 0;
    }
  }

  const chain = Array.from(strikeMap.values()).sort((a, b) => a.strike - b.strike);
  const atmIndex = chain.findIndex((r) => r.strike >= spot);
  const startIdx = Math.max(0, atmIndex - 15);
  const endIdx = Math.min(chain.length, atmIndex + 16);
  const filteredChain = chain.slice(startIdx, endIdx);
  const maxPain = calculateMaxPain(filteredChain);
  const totalCallOI = filteredChain.reduce((s, r) => s + r.callOI, 0);
  const totalPutOI = filteredChain.reduce((s, r) => s + r.putOI, 0);
  const pcr = totalCallOI > 0 ? totalPutOI / totalCallOI : 0;

  return {
    spot,
    chain: filteredChain,
    expiries,
    currentExpiry: activeExpiry,
    maxPain,
    pcr,
    totalCallOI,
    totalPutOI,
  };
}

function calculateMaxPain(chain: OptionRow[]): number {
  let minPain = Infinity;
  let maxPainStrike = chain[0]?.strike ?? 0;
  for (const row of chain) {
    let totalPain = 0;
    for (const other of chain) {
      if (row.strike < other.strike) totalPain += other.putOI * (other.strike - row.strike);
      if (row.strike > other.strike) totalPain += other.callOI * (row.strike - other.strike);
    }
    if (totalPain < minPain) {
      minPain = totalPain;
      maxPainStrike = row.strike;
    }
  }
  return maxPainStrike;
}

// ── Main handler ──

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const symbol = (body.symbol || "NIFTY").toUpperCase();
    const selectedExpiry = body.expiry || undefined;

    // Try cache first
    const cached = await getCachedData(symbol, selectedExpiry);
    if (cached) {
      return new Response(
        JSON.stringify({ success: true, symbol, ...cached, cached: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Strategy 1: Try NSE directly
    let processed;
    try {
      const cookies = await getNSECookies();
      await new Promise((r) => setTimeout(r, 500));
      const nseData = await fetchNSEOptionChain(symbol, cookies);
      processed = processNSEData(nseData, selectedExpiry);
      console.log("Successfully fetched from NSE directly");
    } catch (nseErr) {
      console.warn("NSE direct fetch failed:", nseErr);
    }

    // There is deliberately no generated fallback here.
    //
    // This previously synthesised a whole option chain - strikes, premiums,
    // open interest and an IV smile seeded with Math.random() - on top of a
    // hardcoded spot price whenever NSE was unreachable. The payload carried
    // no marker, so the client could not tell it from real NSE data, and the
    // result was written to market_cache and re-served afterwards.
    //
    // Option OI and IV are what F&O traders position against. Inventing them
    // is categorically different from an empty panel, so the chain now falls
    // through to genuinely stale-but-real data, and then to an error.

    if (!processed) {
      // Last resort: real data from cache, explicitly flagged stale.
      const sb = getSupabase();
      const key = cacheKey(symbol, selectedExpiry);
      const { data: stale } = await sb.from("market_cache").select("*").eq("id", key).single();
      if (stale?.data) {
        return new Response(
          JSON.stringify({ success: true, symbol, ...stale.data, cached: true, stale: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error("Failed to fetch F&O data from all sources");
    }

    const responseData = { ...processed, fetchedAt: new Date().toISOString() };

    // Cache the result
    await setCachedData(symbol, selectedExpiry, responseData);

    return new Response(
      JSON.stringify({ success: true, symbol, ...responseData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("F&O fetch error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Failed to fetch F&O data",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

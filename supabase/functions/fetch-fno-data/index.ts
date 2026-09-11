import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { NSE_HEADERS } from "../_shared/nse.ts";
import { aroundSpot, contractInfoUrl, optionChainUrl, parseContractInfo, parseOptionChainV3, summariseChain } from "../_shared/option-chain.ts";

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

// ── NSE option chain (v3) ──
//
// NSE retired option-chain-indices / option-chain-equities (both 404 since
// 2026); the chain now comes one expiry at a time from option-chain-v3, with
// the expiry list from option-chain-contract-info. See _shared/option-chain.ts.
//
// A browser User-Agent is enough without cookies (_shared/nse.ts); cookies are
// primed from the home page only if NSE answers 401/403.

const OC_HEADERS = { ...NSE_HEADERS, Referer: "https://www.nseindia.com/option-chain" };

async function primeCookies(): Promise<string> {
  const res = await fetch("https://www.nseindia.com/option-chain", { headers: { ...OC_HEADERS, Accept: "text/html" }, signal: AbortSignal.timeout(15_000) });
  await res.body?.cancel();
  const cookies = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  return cookies.map((c) => c.split(";")[0]).join("; ");
}

async function nseJson(url: string): Promise<unknown> {
  const get = (cookie?: string) => fetch(url, { headers: cookie ? { ...OC_HEADERS, Cookie: cookie } : OC_HEADERS, signal: AbortSignal.timeout(20_000) });
  let res = await get();
  if (res.status === 401 || res.status === 403) {
    await res.body?.cancel();
    res = await get(await primeCookies());
  }
  if (!res.ok) throw new Error(`NSE ${new URL(url).pathname} returned ${res.status}`);
  return await res.json();
}

async function fetchChain(symbol: string, selectedExpiry?: string) {
  const expiries = parseContractInfo(await nseJson(contractInfoUrl(symbol)));
  if (expiries.length === 0) throw new Error(`No expiries listed for ${symbol}`);
  const activeExpiry = selectedExpiry && expiries.includes(selectedExpiry) ? selectedExpiry : expiries[0];
  const { spot, rows } = parseOptionChainV3(await nseJson(optionChainUrl(symbol, activeExpiry)), activeExpiry);
  if (rows.length === 0) throw new Error(`No options data for ${symbol} ${activeExpiry}`);
  const summary = summariseChain(rows);
  return {
    spot,
    chain: aroundSpot(rows, spot, 15),
    expiries: expiries.map((d) => ({ timestamp: d, label: d })),
    currentExpiry: activeExpiry,
    maxPain: summary.maxPain ?? 0,
    pcr: summary.pcr ?? 0,
    totalCallOI: summary.totalCallOI,
    totalPutOI: summary.totalPutOI,
  };
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
      processed = await fetchChain(symbol, selectedExpiry);
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

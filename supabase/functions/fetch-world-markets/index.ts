// World indices, Indian sector indices and Indian ETFs in one call, so the
// board does not fan out ~70 chart requests from the browser. World indices and
// ETFs come from Yahoo's keyless chart endpoint (it needs a browser User-Agent);
// sector indices come from NSE's own daily file, already in index_valuation_daily.
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  INDIA_ETFS,
  INDIA_SECTORS,
  WORLD_INDICES,
  chartPoints,
  fxSymbol,
  inDollars,
  summariseSeries,
  type BoardGroup,
  type BoardRow,
  type DailyPoint,
} from "../_shared/world-markets.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CACHE_MS = 15 * 60_000;
const CONCURRENCY = 8;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";

let cache: { at: number; body: string } | null = null;

async function fetchOne(symbol: string): Promise<unknown | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=3mo&interval=1d&includePrePost=false`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8_000) });
    if (!res.ok) { await res.body?.cancel(); return null; }
    return await res.json();
  } catch {
    return null;
  }
}

/** ~95 sessions back is enough for the 62-session quarter change and the spark. */
const SECTOR_LOOKBACK_DAYS = 140;

async function sectorRows(): Promise<{ rows: BoardRow[]; failed: string[] }> {
  const since = new Date(Date.now() - SECTOR_LOOKBACK_DAYS * 86_400_000).toISOString().slice(0, 10);
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  // One query per index: all fifteen in one request came to ~1,400 rows, past
  // PostgREST's 1,000-row cap, and oldest-first ordering cut off the newest six
  // weeks - every tile showed early August as "latest".
  const series = await Promise.all(INDIA_SECTORS.map(async (item) => {
    const { data, error } = await db
      .from("index_valuation_daily")
      .select("trade_date, close, volume")
      .eq("index_name", item.nse!)
      .gte("trade_date", since)
      .order("trade_date", { ascending: true });
    if (error) console.error(`sector ${item.nse} read failed:`, error.message);
    const points: DailyPoint[] = (data ?? []).map((row) => ({
      date: row.trade_date,
      close: Number(row.close),
      volume: row.volume === null ? null : Number(row.volume),
    }));
    return { item, row: summariseSeries(item, points, "INR") };
  }));
  return {
    rows: series.flatMap((s) => (s.row ? [s.row] : [])),
    failed: series.filter((s) => !s.row).map((s) => s.item.symbol),
  };
}

/** Fetches Yahoo charts CONCURRENCY at a time, keyed by symbol. */
async function fetchAll(symbols: string[]): Promise<Map<string, unknown>> {
  const out = new Map<string, unknown>();
  for (let i = 0; i < symbols.length; i += CONCURRENCY) {
    const batch = symbols.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map((symbol) => fetchOne(symbol)));
    batch.forEach((symbol, j) => { if (results[j]) out.set(symbol, results[j]); });
  }
  return out;
}

const returnsOf = (row: BoardRow | null) =>
  row ? { day: row.day, week: row.week, month: row.month, quarter: row.quarter } : null;

async function build(): Promise<string> {
  const sectors = await sectorRows();
  const rows: BoardRow[] = [...sectors.rows];
  const failed: string[] = [...sectors.failed];
  const fromYahoo = [...WORLD_INDICES, ...INDIA_ETFS];
  const charts = await fetchAll(fromYahoo.map((item) => item.symbol));

  // World markets also carry their returns in dollars: each index converted at
  // its currency's daily units-per-dollar rate, one rate series per currency.
  const parsed = new Map(fromYahoo.map((item) => [item.symbol, chartPoints(charts.get(item.symbol))]));
  const fxSymbols = [...new Set(WORLD_INDICES.map((item) => fxSymbol(parsed.get(item.symbol)!.currency)).filter((s): s is string => s !== null))];
  const fxCharts = await fetchAll(fxSymbols);

  for (const item of fromYahoo) {
    const { points, currency } = parsed.get(item.symbol)!;
    const row = summariseSeries(item, points, currency);
    if (!row) { failed.push(item.symbol); continue; }
    if (item.group !== "world") { rows.push(row); continue; }
    const fx = fxSymbol(currency);
    const rates = fx ? chartPoints(fxCharts.get(fx)).points : null;
    // No currency in the quote (Yahoo omits it for MERVAL) means no dollar
    // return - treating it as dollars would show the peso's move as a dollar one.
    const usd = !currency
      ? null
      : fx === null
        ? returnsOf(row)
        : rates && rates.length > 0 ? returnsOf(summariseSeries(item, inDollars(points, rates), "USD")) : null;
    rows.push({ ...row, usd });
  }
  const groups = Object.fromEntries((["world", "sectors", "etfs"] as BoardGroup[]).map((g) => [g, rows.filter((r) => r.group === g)]));
  return JSON.stringify({ success: rows.length > 0, generated_at: new Date().toISOString(), groups, failed });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    if (!cache || Date.now() - cache.at > CACHE_MS) cache = { at: Date.now(), body: await build() };
    return new Response(cache.body, {
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=300, s-maxage=900" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

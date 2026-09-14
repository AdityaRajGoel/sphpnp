// World indices, Indian sector indices and Indian ETFs in one call, so the
// board does not fan out ~75 chart requests from the browser. Yahoo's chart
// endpoint is keyless; it needs a browser User-Agent like every other feed here.
import { BOARD, summariseChart, type BoardGroup, type BoardRow } from "../_shared/world-markets.ts";

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

async function build(): Promise<string> {
  const rows: BoardRow[] = [];
  const failed: string[] = [];
  for (let i = 0; i < BOARD.length; i += CONCURRENCY) {
    const batch = BOARD.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map((item) => fetchOne(item.symbol)));
    batch.forEach((item, j) => {
      const row = results[j] ? summariseChart(item, results[j]) : null;
      if (row) rows.push(row); else failed.push(item.symbol);
    });
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

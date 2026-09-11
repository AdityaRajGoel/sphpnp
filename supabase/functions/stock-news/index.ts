// Recent news for one listed stock, from Google News' RSS search (free,
// keyless). Called by the stock page when its cached copy in stock_news is
// missing or stale; the result is cached for two hours so a busy page costs
// Google one request per stock per two hours at most.
//
// Only symbols in screener_stocks are served - the search is built from the
// stored company name, never from caller input.

import { createClient } from "npm:@supabase/supabase-js@2";
import { parseStockNewsRss, stockNewsQuery, type NewsItem } from "../_shared/google-news.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const FRESH_MS = 2 * 60 * 60 * 1000;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const { symbol: raw } = await req.json().catch(() => ({ symbol: "" }));
  const symbol = typeof raw === "string" ? raw.trim().toUpperCase() : "";
  if (!/^[A-Z0-9&-]{1,20}$/.test(symbol)) return json({ error: "A valid NSE symbol is required" }, 400);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: cached } = await supabase.from("stock_news").select("items,fetched_at").eq("symbol", symbol).maybeSingle();
  if (cached && Date.now() - Date.parse(cached.fetched_at) < FRESH_MS) {
    return json({ symbol, items: cached.items, fetched_at: cached.fetched_at, cached: true });
  }

  const { data: stock, error: stockErr } = await supabase.from("screener_stocks").select("name").eq("symbol", symbol).maybeSingle();
  if (stockErr) return json({ error: `stock read: ${stockErr.message}` }, 500);
  if (!stock?.name) return json({ error: "Unknown symbol" }, 404);

  let items: NewsItem[];
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(stockNewsQuery(stock.name))}&hl=en-IN&gl=IN&ceid=IN:en`;
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/rss+xml, application/xml" }, signal: AbortSignal.timeout(12_000) });
    if (!res.ok) throw new Error(`Google News HTTP ${res.status}`);
    items = parseStockNewsRss(await res.text(), stock.name, symbol);
  } catch (error) {
    // Serve what we had rather than nothing; the page shows its age.
    if (cached) return json({ symbol, items: cached.items, fetched_at: cached.fetched_at, cached: true, stale: true });
    return json({ error: `news fetch: ${(error as Error).message}` }, 502);
  }

  const fetched_at = new Date().toISOString();
  const { error: upErr } = await supabase.from("stock_news").upsert({ symbol, items, fetched_at }, { onConflict: "symbol" });
  if (upErr) console.error("stock_news upsert", upErr.message);
  return json({ symbol, items, fetched_at, cached: false });
});

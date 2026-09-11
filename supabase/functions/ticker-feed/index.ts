// Composes the site-wide live-updates ticker (see _shared/ticker.ts) and caches
// it in ticker_feed for five minutes. Called by the announcement bar when the
// cached row is stale; a fresh row is returned as is, so concurrent visitors
// cost one rebuild, not one each.

import { createClient } from "npm:@supabase/supabase-js@2";
import { rssItems } from "../_shared/google-news.ts";
import { istDate } from "../_shared/ipo-status.ts";
import { GLOBAL_TICKERS } from "../_shared/eodhd.ts";
import {
  MARKET_NEWS_QUERY, announcementItems, exDateItems, globalItems, interleave, ipoItems, moverItems, newsItems, symbolResolver,
  type TickerIpo, type TickerItem,
} from "../_shared/ticker.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const FRESH_MS = 5 * 60 * 1000;
const ROW_ID = "main";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

async function marketNews(): Promise<TickerItem[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(MARKET_NEWS_QUERY)}&hl=en-IN&gl=IN&ceid=IN:en`;
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Google News HTTP ${res.status}`);
  const seen = new Set<string>();
  const items = rssItems(await res.text())
    .sort((a, b) => b.published_at.localeCompare(a.published_at))
    .filter((n) => {
      const key = n.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 60);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return newsItems(items, 6);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: cached } = await supabase.from("ticker_feed").select("items,built_at").eq("id", ROW_ID).maybeSingle();
  if (cached && Date.now() - Date.parse(cached.built_at) < FRESH_MS) return json({ ...cached, cached: true });

  const today = istDate();
  // The markets a trader checks first; the rest are on Market Pulse.
  const TICKER_GLOBALS = ["GSPC.INDX", "IXIC.INDX", "N225.INDX", "HSI.INDX", "USDINR.FOREX", "XAUUSD.FOREX", "BNO.US", "BTC-USD.CC"];
  const nameOf = new Map(GLOBAL_TICKERS.map((t) => [t.ticker, t.name]));
  const [ipoRes, stockRes, actionRes, annRes, news, globalRes] = await Promise.all([
    supabase.from("ipos")
      .select("id,slug,name,status,open_date,close_date,listing_date,price_band_min,price_band_max,subscription_total,listing_gain_pct")
      .or(`status.in.(upcoming,open,closed),listing_date.gte.${addDays(today, -3)}`)
      .limit(200),
    supabase.from("screener_stocks").select("symbol,name,price,change_pct,market_cap").limit(1000),
    supabase.from("nse_corporate_actions").select("company,purpose,ex_date").gte("ex_date", today).lte("ex_date", addDays(today, 10)).order("ex_date").limit(200),
    supabase.from("nse_announcements").select("company,subject,attachment_url,published_at").not("published_at", "is", null).order("published_at", { ascending: false }).limit(150),
    marketNews().catch((e: Error) => { console.error("ticker news", e.message); return [] as TickerItem[]; }),
    supabase.from("global_markets_daily").select("ticker,trade_date,close").in("ticker", TICKER_GLOBALS).gte("trade_date", addDays(today, -10)).order("trade_date"),
  ]);
  const globals = globalItems((globalRes.data ?? []).map((b) => ({ ticker: b.ticker as string, name: nameOf.get(b.ticker as string) ?? (b.ticker as string), trade_date: b.trade_date as string, close: Number(b.close) })));
  const failed = [ipoRes, stockRes, actionRes, annRes].find((r) => r.error);
  if (failed?.error) {
    if (cached) return json({ ...cached, cached: true, stale: true });
    return json({ error: failed.error.message }, 500);
  }

  // Latest GMP per live issue.
  const ipos = (ipoRes.data ?? []) as (TickerIpo & { id: string })[];
  const gmpBySlug = new Map<string, number>();
  if (ipos.length > 0) {
    const { data: snaps } = await supabase.from("ipo_gmp_snapshots")
      .select("ipo_id,gmp,captured_at").in("ipo_id", ipos.map((i) => i.id)).order("captured_at", { ascending: false }).limit(1000);
    const slugOf = new Map(ipos.map((i) => [i.id, i.slug]));
    for (const s of snaps ?? []) {
      const slug = slugOf.get(s.ipo_id);
      if (slug && !gmpBySlug.has(slug)) gmpBySlug.set(slug, Number(s.gmp));
    }
  }

  const stocks = (stockRes.data ?? []).map((s) => ({ ...s, price: Number(s.price) || 0, change_pct: Number(s.change_pct) || 0, market_cap: Number(s.market_cap) || 0 }));
  const symbolOf = symbolResolver(stocks);
  const items = interleave([
    ipoItems(ipos, gmpBySlug, today).slice(0, 8),
    news,
    moverItems(stocks),
    exDateItems(actionRes.data ?? [], symbolOf, today),
    announcementItems(annRes.data ?? [], symbolOf),
    globals,
  ]);

  const built_at = new Date().toISOString();
  const { error: upErr } = await supabase.from("ticker_feed").upsert({ id: ROW_ID, items, built_at }, { onConflict: "id" });
  if (upErr) console.error("ticker_feed upsert", upErr.message);
  return json({ items, built_at, cached: false });
});

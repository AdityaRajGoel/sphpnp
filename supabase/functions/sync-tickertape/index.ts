// Tickertape stock pages for the tracked universe: analyst coverage, the
// holding split with mutual funds and insurers broken out, the funds holding
// the most of each stock, sector valuation and scorecard tags (see
// _shared/tickertape.ts).
//
// Finding a stock's page: the path stored from an earlier run, else the list
// resolved through Tickertape's search (_shared/tickertape-slugs.ts - the
// search API itself answers 403 to Supabase's servers), else the stocks
// sitemap matched by company name. Whichever way, the page's own ticker must
// be this stock's before anything is stored.
//
// Trigger: GitHub Actions (.github/workflows/free-sources-sync.yml). Protected by SYNC_SECRET.

import { createClient } from "npm:@supabase/supabase-js@2";
import { nextData, parseTickertape, sitemapCandidates, type TickertapeStock } from "../_shared/tickertape.ts";
import { TICKERTAPE_PATHS, TICKERTAPE_RENAMED } from "../_shared/tickertape-slugs.ts";
import { cursorAfter, nextBatch } from "../_shared/batch-cursor.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sync-secret",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const JOB = "tickertape";
const BATCH_SIZE = 12;
const RUN_BUDGET_MS = 100_000;
const PACE_MS = 2_000;
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept-Language": "en-IN,en;q=0.9",
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class RateLimited extends Error {}

async function get(url: string, accept: string): Promise<string> {
  const res = await fetch(url, { headers: { ...HEADERS, Accept: accept }, signal: AbortSignal.timeout(25_000) });
  if (res.status === 429 || res.status === 403) throw new RateLimited(`Tickertape HTTP ${res.status}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const secret = Deno.env.get("SYNC_SECRET");
  if (!secret || req.headers.get("x-sync-secret") !== secret) return json({ error: "Unauthorized" }, 401);
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const started = Date.now();

  const { data: universe, error: uErr } = await supabase.from("screener_stocks").select("symbol,name").order("symbol");
  if (uErr) return json({ error: `universe: ${uErr.message}` }, 500);
  const nameOf = new Map((universe ?? []).map((r) => [r.symbol as string, r.name as string]));
  const symbols = [...nameOf.keys()].sort();
  const { data: cursorRow } = await supabase.from("sync_cursors").select("cursor").eq("job", JOB).maybeSingle();
  const previous = (cursorRow?.cursor as string | null) ?? null;
  const { batch, wrapped } = nextBatch(symbols, previous, BATCH_SIZE);
  const { data: known } = await supabase.from("stock_profiles").select("symbol,tickertape").in("symbol", batch);
  const storedPath = new Map((known ?? []).flatMap((k) => {
    const url = typeof k.tickertape?.url === "string" ? k.tickertape.url as string : "";
    return url.startsWith("https://www.tickertape.in/stocks/") ? [[k.symbol as string, url.slice("https://www.tickertape.in".length)]] : [];
  }));

  let sitemap: string | null = null;
  const sitemapPaths = async (symbol: string) => {
    sitemap ??= await get("https://www.tickertape.in/sitemaps/stocks/sitemap.xml", "application/xml");
    return sitemapCandidates(sitemap, nameOf.get(symbol) ?? "");
  };
  /** The stock read from a page, only if the page is for this ticker. */
  const readPage = async (symbol: string, path: string): Promise<TickertapeStock | null> => {
    const props = nextData(await get(`https://www.tickertape.in${path}`, "text/html"));
    const stock = props ? parseTickertape(props) : null;
    const accepted = [symbol, ...(TICKERTAPE_RENAMED[symbol]?.tickers ?? [])];
    return stock && stock.ticker && accepted.includes(stock.ticker) ? { ...stock, url: stock.url ?? `https://www.tickertape.in${path}` } : null;
  };

  let done = 0;
  let stored = 0;
  let viaSitemap = 0;
  let rateLimited = false;
  const failures: { symbol: string; reason: string }[] = [];

  for (const symbol of batch) {
    if (Date.now() - started > RUN_BUDGET_MS) break;
    const attemptedAt = new Date().toISOString();
    try {
      const knownPath = storedPath.get(symbol) ?? TICKERTAPE_PATHS[symbol] ?? TICKERTAPE_RENAMED[symbol]?.path;
      let stock = knownPath ? await readPage(symbol, knownPath) : null;
      if (!stock) {
        for (const path of (await sitemapPaths(symbol)).filter((p) => p !== knownPath).slice(0, 2)) {
          await sleep(PACE_MS);
          stock = await readPage(symbol, path);
          if (stock) { viaSitemap++; break; }
        }
      }
      if (!stock) throw new Error("no Tickertape page for this ticker");
      const { error } = await supabase.from("stock_profiles").upsert(
        { symbol, tickertape: stock, tickertape_sid: stock.sid, tickertape_fetched_at: attemptedAt, tickertape_error: null },
        { onConflict: "symbol" },
      );
      if (error) throw new Error(error.message);
      stored++;
    } catch (e) {
      if (e instanceof RateLimited) { rateLimited = true; break; }
      const reason = (e as Error).message;
      failures.push({ symbol, reason });
      await supabase.from("stock_profiles").upsert({ symbol, tickertape_error: reason.slice(0, 300) }, { onConflict: "symbol" });
    }
    done++;
    // Saved per stock, so a worker killed mid-batch resumes after the last
    // stock done instead of repeating the batch - and dying on it - forever.
    await supabase.from("sync_cursors").upsert({ job: JOB, cursor: batch[done - 1], updated_at: new Date().toISOString() }, { onConflict: "job" });
    await sleep(PACE_MS);
  }

  const finished = wrapped && done >= batch.length;
  await supabase.from("sync_cursors").upsert(
    { job: JOB, cursor: cursorAfter(previous, batch, done, wrapped), updated_at: new Date().toISOString() },
    { onConflict: "job" },
  );
  return json({ ok: !rateLimited, symbols: done, stored, viaSitemap, from: batch[0] ?? null, to: batch[done - 1] ?? null, wrapped: finished, rateLimited, failed: failures.length, failures }, rateLimited ? 429 : 200);
});

// Daily bars for world indices, currencies, metals, oil and bitcoin from
// EODHD's free plan (see _shared/eodhd.ts). One call per ticker; every call is
// counted in provider_usage before it is made, and the run stops at
// DAILY_BUDGET, so a repeated or manual run can never exceed the plan.
//
// Trigger: .github/workflows/global-markets-sync.yml, once each weekday
// morning IST (after the US close). Protected by SYNC_SECRET.

import { createClient } from "npm:@supabase/supabase-js@2";
import { DAILY_BUDGET, GLOBAL_TICKERS, eodUrl, parseEodhdEod } from "../_shared/eodhd.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sync-secret",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const PROVIDER = "eodhd";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const secret = Deno.env.get("SYNC_SECRET");
  if (!secret || req.headers.get("x-sync-secret") !== secret) return json({ error: "Unauthorized" }, 401);
  const token = Deno.env.get("EODHD_API_KEY");
  if (!token) return json({ error: "EODHD_API_KEY is not set" }, 500);
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // EODHD's daily allowance resets at midnight UTC.
  const day = new Date().toISOString().slice(0, 10);
  const { data: usage } = await sb.from("provider_usage").select("calls").eq("provider", PROVIDER).eq("day", day).maybeSingle();
  let calls = usage?.calls ?? 0;

  // A year of history for a ticker with little stored, the last fortnight otherwise - one call either way.
  // Counted per ticker by the database: a year of 15 tickers is ~3,900 rows, past
  // the API's 1,000-row cap, so counting fetched rows would undercount most tickers.
  const since = new Date(Date.now() - 400 * 86_400_000).toISOString().slice(0, 10);
  const stored = new Map(await Promise.all(GLOBAL_TICKERS.map(async (t) => {
    const { count } = await sb.from("global_markets_daily").select("trade_date", { count: "exact", head: true }).eq("ticker", t.ticker).gte("trade_date", since);
    return [t.ticker, count ?? 0] as const;
  })));
  const yearAgo = new Date(Date.now() - 370 * 86_400_000).toISOString().slice(0, 10);
  const fortnight = new Date(Date.now() - 14 * 86_400_000).toISOString().slice(0, 10);

  const results: Record<string, number | string> = {};
  for (const t of GLOBAL_TICKERS) {
    if (calls >= DAILY_BUDGET) { results[t.ticker] = "skipped: daily budget used"; continue; }
    // Counted before the request: a call that fails still counts against the plan.
    calls++;
    await sb.from("provider_usage").upsert({ provider: PROVIDER, day, calls }, { onConflict: "provider,day" });
    try {
      const from = (stored.get(t.ticker) ?? 0) < 150 ? yearAgo : fortnight;
      const res = await fetch(eodUrl(t.ticker, token, from), { signal: AbortSignal.timeout(20_000) });
      if (!res.ok) { results[t.ticker] = `HTTP ${res.status}`; await res.body?.cancel(); continue; }
      const bars = parseEodhdEod(await res.json(), t.ticker);
      if (bars.length > 0) {
        const { error } = await sb.from("global_markets_daily").upsert(bars, { onConflict: "ticker,trade_date" });
        if (error) throw new Error(error.message);
      }
      results[t.ticker] = bars.length;
    } catch (e) {
      results[t.ticker] = (e as Error).message;
    }
  }
  const failed = Object.values(results).filter((v) => typeof v === "string" && !v.startsWith("skipped")).length;
  return json({ ok: failed < GLOBAL_TICKERS.length, callsToday: calls, budget: DAILY_BUDGET, results });
});

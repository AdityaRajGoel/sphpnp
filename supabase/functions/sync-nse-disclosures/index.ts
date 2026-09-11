// Per-stock NSE disclosures for the whole tracked universe: corporate actions
// (dividends, splits, bonuses), each quarter's shareholding-pattern filing, and
// insider trades. Three light JSON calls per stock - no XBRL downloads, which
// is what keeps sync-fundamentals to two stocks a run - so a batch covers
// twenty stocks and the workflow finishes a full pass in one run.
//
// Trigger: GitHub Actions (.github/workflows/free-sources-sync.yml), which
// calls again until the response says `wrapped`. Protected by SYNC_SECRET.

import { createClient } from "npm:@supabase/supabase-js@2";
import { NSE_DELAY_MS, NSE_HEADERS, fetchCorporateActions, sleep } from "../_shared/nse.ts";
import { parseInsiderTrades, parseShareholdingMaster } from "../_shared/nse-disclosures.ts";
import { cursorAfter, nextBatch } from "../_shared/batch-cursor.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sync-secret",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const JOB = "nse-disclosures";
const BATCH_SIZE = 20;
const RUN_BUDGET_MS = 100_000;
/** Insider trades kept per stock: the latest disclosures, which is what the page shows. */
const MAX_TRADES = 100;

async function nseJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: NSE_HEADERS, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const secret = Deno.env.get("SYNC_SECRET");
  if (!secret || req.headers.get("x-sync-secret") !== secret) return json({ error: "Unauthorized" }, 401);
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const started = Date.now();

  const { data: universe, error: uErr } = await supabase.from("screener_stocks").select("symbol").order("symbol");
  if (uErr) return json({ error: `universe: ${uErr.message}` }, 500);
  const symbols = (universe ?? []).map((r) => r.symbol as string).sort();
  const { data: cursorRow } = await supabase.from("sync_cursors").select("cursor").eq("job", JOB).maybeSingle();
  const previous = (cursorRow?.cursor as string | null) ?? null;
  const { batch, wrapped } = nextBatch(symbols, previous, BATCH_SIZE);

  const counts = { actions: 0, shareholding: 0, trades: 0 };
  const failures: { symbol: string; part: string; reason: string }[] = [];
  let done = 0;

  for (const symbol of batch) {
    if (Date.now() - started > RUN_BUDGET_MS) break;
    const fetchedAt = new Date().toISOString();

    try {
      const actions = await fetchCorporateActions(symbol);
      // Deduped on the conflict key: NSE repeats a row per series (EQ, BE), and
      // a repeated key in one INSERT rejects the whole statement.
      const rows = new Map<string, Record<string, unknown>>();
      for (const a of actions) {
        rows.set(`${a.exDate}|${a.actionType}|${a.description}`, {
          symbol, ex_date: a.exDate, record_date: a.recordDate, action_type: a.actionType,
          value: a.value, description: a.description, source: "nse", fetched_at: fetchedAt,
        });
      }
      if (rows.size > 0) {
        const { error } = await supabase.from("fundamentals_corporate_actions").upsert([...rows.values()], { onConflict: "symbol,ex_date,action_type,description" });
        if (error) throw new Error(error.message);
        counts.actions += rows.size;
      }
    } catch (e) {
      failures.push({ symbol, part: "corporate actions", reason: (e as Error).message });
    }
    await sleep(NSE_DELAY_MS);

    try {
      const filings = parseShareholdingMaster(
        await nseJson(`https://www.nseindia.com/api/corporate-share-holdings-master?index=equities&symbol=${encodeURIComponent(symbol)}`),
        symbol,
      );
      if (filings.length > 0) {
        const { error } = await supabase.from("nse_shareholding_filings")
          .upsert(filings.map((f) => ({ ...f, fetched_at: fetchedAt })), { onConflict: "symbol,quarter_end" });
        if (error) throw new Error(error.message);
        counts.shareholding += filings.length;
      }
    } catch (e) {
      failures.push({ symbol, part: "shareholding", reason: (e as Error).message });
    }
    await sleep(NSE_DELAY_MS);

    try {
      const trades = parseInsiderTrades(
        await nseJson(`https://www.nseindia.com/api/corporates-pit?index=equities&symbol=${encodeURIComponent(symbol)}`),
        symbol,
      ).slice(0, MAX_TRADES);
      if (trades.length > 0) {
        const unique = [...new Map(trades.map((t) => [t.disclosure_id, { ...t, fetched_at: fetchedAt }])).values()];
        const { error } = await supabase.from("nse_insider_trades").upsert(unique, { onConflict: "disclosure_id" });
        if (error) throw new Error(error.message);
        counts.trades += unique.length;
      }
    } catch (e) {
      failures.push({ symbol, part: "insider trades", reason: (e as Error).message });
    }
    await sleep(NSE_DELAY_MS);
    done++;
  }

  const finished = wrapped && done >= batch.length;
  await supabase.from("sync_cursors").upsert(
    { job: JOB, cursor: cursorAfter(previous, batch, done, wrapped), updated_at: new Date().toISOString() },
    { onConflict: "job" },
  );

  // Every part failing for every stock is NSE refusing us, not a quiet day.
  const blocked = done > 0 && failures.length >= done * 3;
  return json({ ok: !blocked, symbols: done, from: batch[0] ?? null, to: batch[done - 1] ?? null, wrapped: finished, ...counts, failed: failures.length, failures: failures.slice(0, 20) }, blocked ? 502 : 200);
});

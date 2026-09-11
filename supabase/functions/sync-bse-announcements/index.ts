// Each tracked stock's announcements filed with BSE over the last 45 days,
// by the BSE scrip code sync-screener-in stores on stock_profiles. One call
// per stock; a stock without a known code waits for that sync.
//
// Trigger: GitHub Actions (.github/workflows/free-sources-sync.yml). Protected by SYNC_SECRET.

import { createClient } from "npm:@supabase/supabase-js@2";
import { BSE_HEADERS, bseAnnouncementsUrl, parseBseAnnouncements } from "../_shared/bse.ts";
import { cursorAfter, nextBatch } from "../_shared/batch-cursor.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sync-secret",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const JOB = "bse-announcements";
const BATCH_SIZE = 50;
const RUN_BUDGET_MS = 100_000;
const PACE_MS = 1_000;
const WINDOW_DAYS = 45;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const secret = Deno.env.get("SYNC_SECRET");
  if (!secret || req.headers.get("x-sync-secret") !== secret) return json({ error: "Unauthorized" }, 401);
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const started = Date.now();

  const { data: profiles, error: pErr } = await supabase.from("stock_profiles").select("symbol,bse_code").not("bse_code", "is", null);
  if (pErr) return json({ error: `profiles: ${pErr.message}` }, 500);
  const codeOf = new Map((profiles ?? []).filter((p) => /^\d{6}$/.test(String(p.bse_code))).map((p) => [p.symbol as string, String(p.bse_code)]));
  const symbols = [...codeOf.keys()].sort();
  const { data: cursorRow } = await supabase.from("sync_cursors").select("cursor").eq("job", JOB).maybeSingle();
  const previous = (cursorRow?.cursor as string | null) ?? null;
  const { batch, wrapped } = nextBatch(symbols, previous, BATCH_SIZE);

  const to = new Date();
  const from = new Date(to.getTime() - WINDOW_DAYS * 86_400_000);
  let done = 0;
  let stored = 0;
  const failures: { symbol: string; reason: string }[] = [];

  for (const symbol of batch) {
    if (Date.now() - started > RUN_BUDGET_MS) break;
    const code = codeOf.get(symbol)!;
    try {
      const res = await fetch(bseAnnouncementsUrl(code, from, to), { headers: BSE_HEADERS, signal: AbortSignal.timeout(20_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      // An empty window comes back as {} or a bare string, not an empty table.
      const items = text.trim().startsWith("{") ? parseBseAnnouncements(JSON.parse(text), symbol, code) : [];
      if (items.length > 0) {
        const fetched_at = new Date().toISOString();
        const unique = [...new Map(items.map((i) => [i.news_id, { ...i, fetched_at }])).values()];
        const { error } = await supabase.from("bse_announcements").upsert(unique, { onConflict: "news_id" });
        if (error) throw new Error(error.message);
        stored += unique.length;
      }
    } catch (e) {
      failures.push({ symbol, reason: (e as Error).message });
    }
    done++;
    await sleep(PACE_MS);
  }

  const finished = wrapped && done >= batch.length;
  await supabase.from("sync_cursors").upsert(
    { job: JOB, cursor: cursorAfter(previous, batch, done, wrapped), updated_at: new Date().toISOString() },
    { onConflict: "job" },
  );
  const blocked = done > 0 && failures.length === done;
  return json({ ok: !blocked, withCode: symbols.length, symbols: done, stored, wrapped: finished, failed: failures.length, failures: failures.slice(0, 20) }, blocked ? 502 : 200);
});

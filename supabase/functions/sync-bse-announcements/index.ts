// Each tracked stock's announcements filed with BSE over the last year,
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
// A year, so legal, tax and rating disclosures older than the last quarter
// are still on the stock page's legal and regulatory watch.
const WINDOW_DAYS = 365;
const MAX_PAGES = 5;
/** Below this many rows a page is taken as the last one when BSE reports no total. */
const FULL_PAGE = 50;
type Announcement = ReturnType<typeof parseBseAnnouncements>[number];
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
      // A year of filings can run past BSE's first page, so pages are walked
      // until one adds nothing new, the reported total is reached, or the run
      // budget is spent. A failure after page 1 keeps what was already read.
      const seen = new Map<string, Announcement>();
      for (let page = 1; page <= MAX_PAGES; page++) {
        // BSE's API stalls on a few stocks a pass ("Signal timed out"); one slower retry recovers most.
        const url = bseAnnouncementsUrl(code, from, to, page);
        let text: string;
        try {
          const res = await fetch(url, { headers: BSE_HEADERS, signal: AbortSignal.timeout(20_000) })
            .catch(async (e) => {
              // Only with time to spare: a retry late in the run could outlast the worker.
              if ((e as Error).name !== "TimeoutError" || Date.now() - started > RUN_BUDGET_MS - 45_000) throw e;
              await sleep(PACE_MS);
              return await fetch(url, { headers: BSE_HEADERS, signal: AbortSignal.timeout(25_000) });
            });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          text = await res.text();
        } catch (e) {
          if (page === 1) throw e;
          break;
        }
        // An empty window comes back as {} or a bare string, not an empty table.
        const raw = text.trim().startsWith("{") ? JSON.parse(text) : null;
        const items = raw ? parseBseAnnouncements(raw, symbol, code) : [];
        const fresh = items.filter((i) => !seen.has(i.news_id));
        for (const i of fresh) seen.set(i.news_id, i);
        const total = Number(raw?.Table1?.[0]?.ROWCNT);
        const complete = Number.isFinite(total) && total > 0 ? seen.size >= total : items.length < FULL_PAGE;
        if (fresh.length === 0 || complete || Date.now() - started > RUN_BUDGET_MS) break;
        await sleep(PACE_MS);
      }
      const items = [...seen.values()];
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
  const blocked = done > 0 && failures.length === done;
  return json({ ok: !blocked, withCode: symbols.length, symbols: done, stored, wrapped: finished, failed: failures.length, failures: failures.slice(0, 20) }, blocked ? 502 : 200);
});

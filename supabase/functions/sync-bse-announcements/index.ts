// Each tracked stock's announcements filed with BSE over the last year, by the
// BSE scrip code sync-screener-in stores on stock_profiles. A stock without a
// known code waits for that sync.
//
// Three modes, one write path:
//   fetch  (default) - this function reads BSE itself. Since 24 Sep 2026 00:16 IST
//                      BSE's CDN refuses the edge runtime (403 to Deno and curl, 200
//                      to Node on the same host), so this mode now reports "blocked".
//   plan             - the next batch of stocks and the page URLs to read, for
//                      jobs/host-bse-announcements.sh, which fetches them with Node.
//   ingest           - one stock's raw pages from that job, parsed and written here
//                      exactly as the fetch mode writes its own.
// The parsing, the paging rule and the upsert live here and in _shared/bse.ts only;
// the host job never re-implements them.
//
// Trigger: cron on the VPS (jobs/sphpnp-sync.cron). Protected by SYNC_SECRET.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  BSE_HEADERS, BSE_MAX_PAGES, bseAnnouncementsUrl, bsePagesToFetch, mergeBsePages, type BseAnnouncement,
} from "../_shared/bse.ts";
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
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Universe = { codeOf: Map<string, string>; symbols: string[] };

/** Every tracked stock with a six-digit BSE code, symbols sorted for the cursor. */
async function universe(supabase: SupabaseClient): Promise<Universe | string> {
  const { data, error } = await supabase.from("stock_profiles").select("symbol,bse_code").not("bse_code", "is", null);
  if (error) return `profiles: ${error.message}`;
  const codeOf = new Map(
    (data ?? []).filter((p) => /^\d{6}$/.test(String(p.bse_code))).map((p) => [p.symbol as string, String(p.bse_code)]),
  );
  return { codeOf, symbols: [...codeOf.keys()].sort() };
}

function yearWindow(): { from: Date; to: Date } {
  const to = new Date();
  return { from: new Date(to.getTime() - WINDOW_DAYS * 86_400_000), to };
}

async function store(supabase: SupabaseClient, items: BseAnnouncement[]): Promise<number> {
  if (items.length === 0) return 0;
  const fetched_at = new Date().toISOString();
  const { error } = await supabase.from("bse_announcements").upsert(items.map((i) => ({ ...i, fetched_at })), { onConflict: "news_id" });
  if (error) throw new Error(error.message);
  return items.length;
}

async function saveCursor(supabase: SupabaseClient, cursor: string | null): Promise<void> {
  await supabase.from("sync_cursors").upsert({ job: JOB, cursor, updated_at: new Date().toISOString() }, { onConflict: "job" });
}

/**
 * One page as parsed JSON, or null for an empty window (BSE answers {} or a bare
 * string, not an empty table). BSE's API stalls on a few stocks a pass ("Signal
 * timed out"); one slower retry recovers most, but only with time to spare.
 */
async function fetchPage(url: string, started: number): Promise<unknown> {
  const res = await fetch(url, { headers: BSE_HEADERS, signal: AbortSignal.timeout(20_000) }).catch(async (e) => {
    if ((e as Error).name !== "TimeoutError" || Date.now() - started > RUN_BUDGET_MS - 45_000) throw e;
    await sleep(PACE_MS);
    return await fetch(url, { headers: BSE_HEADERS, signal: AbortSignal.timeout(25_000) });
  });
  if (!res.ok) { await res.body?.cancel(); throw new Error(`HTTP ${res.status}`); }
  const text = (await res.text()).trim();
  return text.startsWith("{") ? JSON.parse(text) : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const secret = Deno.env.get("SYNC_SECRET");
  if (!secret || req.headers.get("x-sync-secret") !== secret) return json({ error: "Unauthorized" }, 401);
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const mode = body.mode === "plan" || body.mode === "ingest" ? body.mode : "fetch";

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const u = await universe(supabase);
  if (typeof u === "string") return json({ error: u }, 500);

  if (mode === "ingest") {
    // The code comes from our own table, never from the caller.
    const symbol = typeof body.symbol === "string" ? body.symbol : "";
    const code = u.codeOf.get(symbol);
    if (!code) return json({ ok: false, error: `no BSE code for ${symbol || "(none)"}` }, 400);
    const pages = Array.isArray(body.pages) ? body.pages.slice(0, BSE_MAX_PAGES) : [];
    const fetchError = typeof body.error === "string" ? body.error.slice(0, 200) : null;
    let stored: number;
    try {
      stored = await store(supabase, mergeBsePages(pages, symbol, code));
    } catch (e) {
      return json({ ok: false, symbol, error: (e as Error).message }, 500);
    }
    // Past this stock either way - one BSE refuses must not stall the pass - and
    // back to the top after the last, as cursorAfter does for a finished batch.
    await saveCursor(supabase, symbol === u.symbols[u.symbols.length - 1] ? null : symbol);
    return json({ ok: fetchError === null, symbol, stored, ...(fetchError ? { error: fetchError } : {}) });
  }

  const { data: cursorRow } = await supabase.from("sync_cursors").select("cursor").eq("job", JOB).maybeSingle();
  const previous = (cursorRow?.cursor as string | null) ?? null;
  const { batch, wrapped } = nextBatch(u.symbols, previous, BATCH_SIZE);
  const { from, to } = yearWindow();

  if (mode === "plan") {
    return json({
      ok: true,
      wrapped,
      withCode: u.symbols.length,
      batch: batch.map((symbol) => ({
        symbol,
        urls: Array.from({ length: BSE_MAX_PAGES }, (_, i) => bseAnnouncementsUrl(u.codeOf.get(symbol)!, from, to, i + 1)),
      })),
    });
  }

  const started = Date.now();
  let done = 0;
  let stored = 0;
  const failures: { symbol: string; reason: string }[] = [];
  for (const symbol of batch) {
    if (Date.now() - started > RUN_BUDGET_MS) break;
    const code = u.codeOf.get(symbol)!;
    try {
      // Page 1 says how many more to read; a failure after it keeps what was read.
      const first = await fetchPage(bseAnnouncementsUrl(code, from, to, 1), started);
      const pages: unknown[] = [first];
      const wanted = bsePagesToFetch(first);
      for (let page = 2; page <= wanted && Date.now() - started <= RUN_BUDGET_MS; page++) {
        await sleep(PACE_MS);
        try { pages.push(await fetchPage(bseAnnouncementsUrl(code, from, to, page), started)); } catch { break; }
      }
      stored += await store(supabase, mergeBsePages(pages, symbol, code));
    } catch (e) {
      failures.push({ symbol, reason: (e as Error).message });
    }
    done++;
    // Saved per stock, so a worker killed mid-batch resumes after the last
    // stock done instead of repeating the batch - and dying on it - forever.
    await saveCursor(supabase, batch[done - 1]);
    await sleep(PACE_MS);
  }

  const finished = wrapped && done >= batch.length;
  await saveCursor(supabase, cursorAfter(previous, batch, done, wrapped));
  const blocked = done > 0 && failures.length === done;
  return json({ ok: !blocked, withCode: u.symbols.length, symbols: done, stored, wrapped: finished, failed: failures.length, failures: failures.slice(0, 20) }, blocked ? 502 : 200);
});

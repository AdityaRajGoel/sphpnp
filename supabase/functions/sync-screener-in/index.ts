// Company pages from screener.in for the whole tracked universe: quarterly and
// annual results, balance sheet, cash flow and ratios (the same grids
// IndianAPI serves, for every stock rather than ~80 a day), the quarterly
// shareholding pattern, headline ratios, compounded growth, pros and cons,
// documents and the BSE code the BSE announcements sync needs.
//
// One page per stock, paced a few seconds apart - screener.in is a small
// site and a burst would be both rude and blocked. A 429 ends the run where
// it is; the cursor resumes there next time.
//
// Trigger: GitHub Actions (.github/workflows/free-sources-sync.yml). Protected by SYNC_SECRET.

import { createClient } from "npm:@supabase/supabase-js@2";
import { parseScreenerPage, searchResultPath, type ScreenerPage } from "../_shared/screener-in.ts";
import { deriveRoe } from "../_shared/indianapi.ts";
import { cursorAfter, nextBatch } from "../_shared/batch-cursor.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sync-secret",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const JOB = "screener-in";
const BATCH_SIZE = 12;
const RUN_BUDGET_MS = 100_000;
const PACE_MS = 3_000;
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "en-IN,en;q=0.9",
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class RateLimited extends Error {}

async function fetchPage(path: string): Promise<string | null> {
  const res = await fetch(`https://www.screener.in${path}`, { headers: HEADERS, redirect: "follow", signal: AbortSignal.timeout(20_000) });
  if (res.status === 429) throw new RateLimited("screener.in HTTP 429");
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

/** The consolidated page when the company reports one, the standalone page otherwise. */
async function companyPage(symbol: string): Promise<ScreenerPage | null> {
  const slug = encodeURIComponent(symbol);
  const consolidated = await fetchPage(`/company/${slug}/consolidated/`);
  const page = consolidated ? parseScreenerPage(consolidated) : null;
  if (page?.statements.quarter_results) return page;
  await sleep(PACE_MS);
  const standalone = await fetchPage(`/company/${slug}/`);
  if (consolidated || standalone) return standalone ? parseScreenerPage(standalone) : page;
  // Neither page exists under the symbol: a BSE-only company is filed under its
  // scrip code, which screener.in's own search resolves.
  await sleep(PACE_MS);
  const search = await fetchPage(`/api/company/search/?q=${slug}&v=3`);
  const path = search ? searchResultPath(JSON.parse(search)) : null;
  if (!path) return null;
  await sleep(PACE_MS);
  const found = await fetchPage(path);
  const foundPage = found ? parseScreenerPage(found) : null;
  if (foundPage?.statements.quarter_results || !path.endsWith("/consolidated/")) return foundPage;
  await sleep(PACE_MS);
  const foundStandalone = await fetchPage(path.replace(/consolidated\/$/, ""));
  return foundStandalone ? parseScreenerPage(foundStandalone) : foundPage;
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

  let done = 0;
  let stored = 0;
  let rateLimited = false;
  const failures: { symbol: string; reason: string }[] = [];

  for (const symbol of batch) {
    if (Date.now() - started > RUN_BUDGET_MS) break;
    const attemptedAt = new Date().toISOString();
    try {
      const page = await companyPage(symbol);
      if (!page || !page.statements.quarter_results) throw new Error("no results on screener.in");
      // A renamed or merged company can land on someone else's page.
      if (page.nse_symbol && page.nse_symbol !== symbol) throw new Error(`page is for ${page.nse_symbol}`);

      const statementRows = Object.entries(page.statements).map(([statement, grid]) => ({
        symbol, statement, periods: grid!.periods, period_ends: grid!.period_ends, rows: grid!.rows,
        verified: true, source: "screener_in", fetched_at: attemptedAt,
      }));
      const { error: sErr } = await supabase.from("stock_statements").upsert(statementRows, { onConflict: "symbol,statement" });
      if (sErr) throw new Error(`statements: ${sErr.message}`);

      const { yoy_results: annual, balancesheet: balance } = page.statements;
      const profile: Record<string, unknown> = {
        symbol,
        screener: {
          name: page.name, basis: page.basis, about: page.about, top_ratios: page.top_ratios,
          growth: page.growth, pros: page.pros, cons: page.cons, documents: page.documents,
        },
        screener_fetched_at: attemptedAt,
        screener_error: null,
      };
      if (page.bse_code) profile.bse_code = page.bse_code;
      if (page.shareholding.length > 0) profile.shareholding = page.shareholding;
      if (annual && balance) {
        const roe = deriveRoe(annual, balance);
        if (roe.length > 0) profile.roe_history = roe;
      }
      const { error: pErr } = await supabase.from("stock_profiles").upsert(profile, { onConflict: "symbol" });
      if (pErr) throw new Error(`profile: ${pErr.message}`);
      stored++;
    } catch (e) {
      if (e instanceof RateLimited) { rateLimited = true; break; }
      const reason = (e as Error).message;
      failures.push({ symbol, reason });
      await supabase.from("stock_profiles").upsert({ symbol, screener_error: reason.slice(0, 300) }, { onConflict: "symbol" });
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
  return json({ ok: !rateLimited, symbols: done, stored, from: batch[0] ?? null, to: batch[done - 1] ?? null, wrapped: finished, rateLimited, failed: failures.length, failures }, rateLimited ? 429 : 200);
});

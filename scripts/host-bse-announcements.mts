// Reads each tracked stock's BSE announcements from the VPS host and hands the raw
// pages to sync-bse-announcements (mode "ingest"), which parses and writes them.
//
// Why this exists: since 24 Sep 2026 00:16 IST api.bseindia.com's CDN answers 403 to
// the edge runtime's Deno fetch and to curl, while Node's fetch from this same host
// gets 200 (measured that day: calendar and announcements APIs, same headers). It is
// a client-fingerprint block, not an IP ban, so the fetch moved here, next to
// scripts/host-fetch.mts which does the same for the results calendar.
//
// The split is the same as host-fetch: this script only fetches and POSTs. Which
// stocks and which URLs come from the function ("plan"); how many pages to read is
// bsePagesToFetch, imported from the shared module the function uses; parsing and
// the upsert stay in the function. Nothing here decides what gets stored.
//
// Politeness: one request at a time, a second apart, BSE's own site as Referer.

import { BSE_HEADERS, bsePagesToFetch } from "../supabase/functions/_shared/bse.ts";

const FN_URL = process.env.BSE_SYNC_URL ?? "http://127.0.0.1:8000/functions/v1/sync-bse-announcements";
const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? "";
const SYNC_SECRET = process.env.MARKET_SYNC_SECRET ?? "";

/** Batches of 50: ten cover the ~250 stocks with a BSE code with room to grow. */
const MAX_BATCHES = Number(process.env.MAX_BATCHES ?? 10);
const PACE_MS = 1_000;
/** This many stocks failing in a row means BSE is refusing this host too: stop, and
 *  let freshness.sh raise it, rather than walk the cursor past every stock. */
const MAX_CONSECUTIVE_FAILURES = 5;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Plan = { ok: boolean; wrapped: boolean; batch: { symbol: string; urls: string[] }[] };
type Page = { ok: true; page: unknown } | { ok: false; error: string };

async function call(body: Record<string, unknown>): Promise<{ status: number; data: Record<string, unknown> }> {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON_KEY}`, "x-sync-secret": SYNC_SECRET },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
  const text = await res.text();
  try {
    return { status: res.status, data: JSON.parse(text) };
  } catch {
    return { status: res.status, data: { error: text.slice(0, 200) } };
  }
}

/** One page as parsed JSON; null for an empty window ({} or a bare string). */
async function getPage(url: string): Promise<Page> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(url, { headers: BSE_HEADERS, signal: AbortSignal.timeout(20_000) });
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
      const text = (await res.text()).trim();
      return { ok: true, page: text.startsWith("{") ? JSON.parse(text) : null };
    } catch (e) {
      // BSE stalls on a few stocks a pass; one slower retry recovers most.
      if (attempt === 2 || !(e instanceof Error) || e.name !== "TimeoutError") {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
      await sleep(PACE_MS);
    }
  }
  return { ok: false, error: "unreachable" };
}

let stocks = 0;
let stored = 0;
let failed = 0;
let inARow = 0;
let finished = false;

run: for (let n = 0; n < MAX_BATCHES; n++) {
  const plan = await call({ mode: "plan" });
  const data = plan.data as unknown as Plan;
  if (plan.status !== 200 || !Array.isArray(data.batch)) {
    console.log(`plan failed (${plan.status}): ${JSON.stringify(plan.data).slice(0, 200)}`);
    process.exitCode = 1;
    break;
  }
  for (const { symbol, urls } of data.batch) {
    const pages: unknown[] = [];
    let error: string | undefined;
    const first = await getPage(urls[0]);
    if ("error" in first) {
      error = first.error;
    } else {
      pages.push(first.page);
      const wanted = Math.min(urls.length, bsePagesToFetch(first.page));
      for (let p = 2; p <= wanted; p++) {
        await sleep(PACE_MS);
        const next = await getPage(urls[p - 1]);
        if (!next.ok) break; // keep what was read, as the function does
        pages.push(next.page);
      }
    }
    const res = await call({ mode: "ingest", symbol, pages, ...(error ? { error } : {}) });
    stocks++;
    if (error || res.status !== 200) {
      failed++;
      inARow++;
      if (inARow >= MAX_CONSECUTIVE_FAILURES) {
        console.log(`stopping: ${inARow} stocks failed in a row (last ${symbol}: ${error ?? `ingest ${res.status}`})`);
        process.exitCode = 1;
        break run;
      }
    } else {
      inARow = 0;
      stored += Number(res.data.stored ?? 0);
    }
    await sleep(PACE_MS);
  }
  if (data.wrapped) {
    finished = true;
    break;
  }
}

console.log(`${stocks} stocks, ${stored} announcements written, ${failed} failed${finished ? ", pass complete" : ""}`);

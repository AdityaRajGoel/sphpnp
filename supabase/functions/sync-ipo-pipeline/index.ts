// Reads SEBI's public-issue filings and rebuilds the IPO pipeline.
//
// Trigger: GitHub Actions (.github/workflows/ipo-pipeline-sync.yml), daily.
// Protected by SYNC_SECRET; writes use the service-role key.
//
// A normal run reads the newest pages of both lists - drafts filed with SEBI
// and red herring documents filed with the ROC. {"backfill": true} walks back
// until filings are older than the pipeline window. Every filing is kept; the
// per-company pipeline is then rebuilt from the whole stored window, so a daily
// run that reads two pages still sees each company's full history.

import { createClient } from "npm:@supabase/supabase-js@2";
import { ipoMatchKey } from "../_shared/ipo-parse.ts";
import { istDate } from "../_shared/ipo-status.ts";
import {
  PIPELINE_WINDOW_DAYS,
  buildPipeline,
  parseSebiListing,
  type FilingCategory,
  type SebiFiling,
} from "../_shared/sebi-filings.ts";

const LISTING_URL = "https://www.sebi.gov.in/sebiweb/ajax/home/getnewslistinfo.jsp";
const LISTS: { category: FilingCategory; smid: number }[] = [
  { category: "draft", smid: 10 }, // Draft Offer Documents filed with SEBI
  { category: "rhp", smid: 11 },   // Red Herring Documents filed with ROC
];
const DAILY_PAGES = 2;
const BACKFILL_MAX_PAGES = 30;
const RUN_BUDGET_MS = 110_000;
const PACING_MS = 500;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sync-secret",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** One page of one list, through the listing's own pager. Page 0 is the newest. */
async function fetchPage(smid: number, page: number): Promise<string> {
  const form = new URLSearchParams({
    nextValue: "1", next: "n", search: "", fromDate: "", toDate: "", fromYear: "", toYear: "",
    deptId: "", sid: "3", ssid: "15", smid: String(smid), ssidhidden: "15", intmid: "-1",
    sText: "Filings", ssText: "Public Issues", smText: "", doDirect: String(page),
  });
  const response = await fetch(LISTING_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      Referer: `https://www.sebi.gov.in/sebiweb/home/HomeAction.do?doListing=yes&sid=3&ssid=15&smid=${smid}`,
    },
    body: form,
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) throw new Error(`SEBI smid=${smid} page ${page}: HTTP ${response.status}`);
  return response.text();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const secret = Deno.env.get("SYNC_SECRET");
  if (!secret || req.headers.get("x-sync-secret") !== secret) return json({ error: "Unauthorized" }, 401);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const backfill = ((await req.json().catch(() => ({}))) as { backfill?: unknown }).backfill === true;
  const today = istDate();
  const cutoff = new Date(Date.parse(`${today}T00:00:00Z`) - PIPELINE_WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10);

  const started = Date.now();
  const collected: SebiFiling[] = [];
  const reports: { category: FilingCategory; pages: number; filings: number; error?: string }[] = [];

  for (const { category, smid } of LISTS) {
    const report: { category: FilingCategory; pages: number; filings: number; error?: string } = { category, pages: 0, filings: 0 };
    const maxPages = backfill ? BACKFILL_MAX_PAGES : DAILY_PAGES;
    try {
      for (let page = 0; page < maxPages; page++) {
        if (Date.now() - started > RUN_BUDGET_MS) { report.error = "time budget reached"; break; }
        const { filings } = parseSebiListing(await fetchPage(smid, page), category);
        report.pages++;
        if (filings.length === 0) break;
        collected.push(...filings);
        report.filings += filings.length;
        // Newest first: once a page ends before the window, older pages are out of it too.
        if (filings[filings.length - 1].filed_on < cutoff) break;
        await sleep(PACING_MS);
      }
    } catch (error) {
      report.error = error instanceof Error ? error.message : String(error);
    }
    reports.push(report);
  }

  if (collected.length > 0) {
    const rows = [...new Map(collected.map((f) => [f.url, f])).values()].map((f) => ({
      url: f.url, company: f.company, company_key: ipoMatchKey(f.company), kind: f.kind, category: f.category,
      detail: f.detail, filed_on: f.filed_on, extra_links: f.extra_links, fetched_at: new Date().toISOString(),
    })).filter((r) => r.company_key);
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabase.from("ipo_pipeline_filings").upsert(rows.slice(i, i + 500), { onConflict: "url" });
      if (error) return json({ error: `filings write: ${error.message}`, reports }, 500);
    }
  }

  // Rebuilt from everything stored inside the window, not just this run's pages.
  // Read in pages: the API caps a response at 1,000 rows whatever .limit() says,
  // and 18 months of both lists can exceed that - a silent cap would drop the
  // oldest filings and misstate companies' first-filed dates.
  const stored: SebiFiling[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from("ipo_pipeline_filings")
      .select("company,kind,category,detail,filed_on,url,extra_links")
      .gte("filed_on", cutoff).order("id").range(from, from + 999);
    if (error) return json({ error: `filings read: ${error.message}`, reports }, 500);
    stored.push(...(data ?? []) as SebiFiling[]);
    if (!data || data.length < 1000) break;
  }
  const { data: ipos, error: iErr } = await supabase.from("ipos").select("slug,name,open_date");
  if (iErr) return json({ error: iErr.message, reports }, 500);

  const pipeline = buildPipeline(stored, ipos ?? [], today);
  const now = new Date().toISOString();
  for (let i = 0; i < pipeline.length; i += 500) {
    const { error } = await supabase.from("ipo_pipeline").upsert(
      pipeline.slice(i, i + 500).map((c) => ({ ...c, updated_at: now })),
      { onConflict: "key" },
    );
    if (error) return json({ error: `pipeline write: ${error.message}`, reports }, 500);
  }
  // Companies that fell out of the window since the last rebuild.
  const { error: pruneErr } = await supabase.from("ipo_pipeline").delete().lt("updated_at", now);
  if (pruneErr) console.error(`pipeline prune: ${pruneErr.message}`);

  const readNothing = collected.length === 0;
  const stages = pipeline.reduce<Record<string, number>>((acc, c) => ({ ...acc, [c.stage]: (acc[c.stage] ?? 0) + 1 }), {});
  return json({ ok: !readNothing, backfill, reports, filingsRead: collected.length, companies: pipeline.length, stages }, readNothing ? 500 : 200);
});

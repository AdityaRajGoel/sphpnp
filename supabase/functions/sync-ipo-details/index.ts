// Fetches Chittorgarh's page for each live IPO and stores everything on it:
// minimum investment per category, timetable, registrar, lead managers, issue
// structure, financials, KPIs, valuation, shareholding, objects of the issue.
//
// Trigger: GitHub Actions (.github/workflows/ipo-details-sync.yml), after the
// browser sync has refreshed the catalogue and its detail links.
// Protected by SYNC_SECRET; writes use the service-role key.
//
// Direct fetch first. A page the direct fetch cannot read - refused, timed
// out, or missing its "IPO Details" section - is retried once through Apify's
// RAG Web Browser actor, which fetches through Apify's own network. Apify is
// metered (the account is on the free $5/month tier), so it is only ever the
// fallback and is capped per run.

import { createClient } from "npm:@supabase/supabase-js@2";
import { parseChittorgarhDetail, type IpoDetail } from "../_shared/ipo-detail.ts";
import { CHITTORGARH_ISSUE_URL } from "../_shared/ipo-parse.ts";
import { deriveIpoStatus, istDate } from "../_shared/ipo-status.ts";

/** Pages per run. Each direct fetch is ~1s plus pacing; an Apify fallback ~10s. */
const BATCH_SIZE = Number(Deno.env.get("IPO_DETAILS_BATCH_SIZE") ?? "20");
/** Apify fallbacks per run - bounded by the run's time budget and the account's credit. */
const APIFY_MAX_PER_RUN = Number(Deno.env.get("IPO_DETAILS_APIFY_MAX") ?? "4");
/** A live issue's page changes (subscription, anchor book, dates); refresh it this often. */
const LIVE_REFRESH_HOURS = 12;
/** Listed issues stay in scope this long for their final details. */
const LISTED_WINDOW_DAYS = 30;
const RUN_BUDGET_MS = 110_000;
const PACING_MS = 800;

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "en-IN,en;q=0.9",
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sync-secret",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Row = {
  id: string; slug: string; status: "upcoming" | "open" | "closed" | "listed";
  detail_url: string | null; open_date: string | null; close_date: string | null; listing_date: string | null;
  registrar: string | null; allotment_date: string | null;
  details_fetched_at: string | null; details_attempted_at: string | null;
};

/** A parse that found the issue's own sections, or a reason it did not. */
const usable = (detail: IpoDetail): string | null =>
  detail.sections.some((s) => s.title === "IPO Details") ? null : "page has no IPO Details section";

async function fetchDirect(url: string): Promise<{ detail: IpoDetail } | { reason: string }> {
  try {
    const response = await fetch(url, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(20_000) });
    if (!response.ok) return { reason: `HTTP ${response.status}` };
    const detail = parseChittorgarhDetail(await response.text());
    const problem = usable(detail);
    return problem ? { reason: problem } : { detail };
  } catch (error) {
    return { reason: error instanceof Error ? error.message : String(error) };
  }
}

/** One page through Apify's RAG Web Browser, which returns the page's HTML. */
async function fetchViaApify(url: string, token: string): Promise<{ detail: IpoDetail } | { reason: string }> {
  try {
    const response = await fetch(
      `https://api.apify.com/v2/acts/apify~rag-web-browser/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&timeout=60`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: url, outputFormats: ["html"], scrapingTool: "raw-http", maxResults: 1 }),
        signal: AbortSignal.timeout(70_000),
      },
    );
    if (!response.ok) return { reason: `Apify HTTP ${response.status}: ${(await response.text()).slice(0, 160)}` };
    const items = await response.json() as { html?: string; crawl?: { httpStatusCode?: number } }[];
    const html = items[0]?.html;
    if (!html) return { reason: `Apify returned no HTML (page status ${items[0]?.crawl?.httpStatusCode ?? "unknown"})` };
    const detail = parseChittorgarhDetail(html);
    const problem = usable(detail);
    return problem ? { reason: `via Apify: ${problem}` } : { detail };
  } catch (error) {
    return { reason: `Apify: ${error instanceof Error ? error.message : String(error)}` };
  }
}

/**
 * The columns this page fills. Values the page did not give are omitted, never
 * written as null, so a thinner page cannot erase what an earlier one said.
 * Issue dates already on the row (from the catalogue sync) are kept; the page
 * only fills the ones missing, plus the steps only it publishes.
 */
function updateFor(row: Row, detail: IpoDetail, source: string, now: string): Record<string, unknown> {
  const f = detail.facts;
  const update: Record<string, unknown> = {
    details: { sections: detail.sections },
    details_source: source,
    details_fetched_at: now,
    details_attempted_at: now,
    details_error: null,
  };
  const set = (column: string, value: unknown) => {
    if (value !== null && value !== undefined && !(Array.isArray(value) && value.length === 0)) update[column] = value;
  };
  if (f.min_investment) {
    set("min_investment", f.min_investment.amount);
    set("min_investment_lots", f.min_investment.lots);
    set("min_investment_shares", f.min_investment.shares);
    set("min_investment_category", f.min_investment.category);
  }
  set("face_value", f.face_value);
  set("issue_type", f.issue_type);
  set("sale_type", f.sale_type);
  set("listing_exchanges", f.listing_exchanges);
  set("fresh_issue_crore", f.fresh_issue_crore);
  set("ofs_crore", f.ofs_crore);
  set("refund_date", f.refund_date);
  set("credit_date", f.credit_date);
  set("lead_managers", f.lead_managers);
  set("promoter_holding_pre", f.promoter_holding_pre);
  set("promoter_holding_post", f.promoter_holding_post);
  set("allotment_date", f.allotment_date);
  set("registrar", f.registrar);
  if (!row.open_date) set("open_date", f.open_date);
  if (!row.close_date) set("close_date", f.close_date);
  if (!row.listing_date) set("listing_date", f.listing_date);
  return update;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const secret = Deno.env.get("SYNC_SECRET");
  if (!secret || req.headers.get("x-sync-secret") !== secret) return json({ error: "Unauthorized" }, 401);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const apifyToken = Deno.env.get("APIFY_API_KEY") ?? null;

  const { data, error } = await supabase.from("ipos").select(
    "id,slug,status,detail_url,open_date,close_date,listing_date,registrar,allotment_date,details_fetched_at,details_attempted_at",
  ).not("detail_url", "is", null);
  if (error) return json({ error: error.message }, 500);

  const today = istDate();
  const listedCutoff = new Date(Date.now() - LISTED_WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10);
  const liveCutoff = Date.now() - LIVE_REFRESH_HOURS * 3_600_000;

  // Due: live issues whose page is older than LIVE_REFRESH_HOURS, and issues
  // listed within LISTED_WINDOW_DAYS that have never been read. Stalest first.
  const due = ((data ?? []) as Row[])
    .filter((row) => row.detail_url && CHITTORGARH_ISSUE_URL.test(row.detail_url))
    .filter((row) => {
      const status = deriveIpoStatus(row, row.status, today);
      const attempted = row.details_attempted_at ? Date.parse(row.details_attempted_at) : 0;
      if (status === "listed") {
        const listedOn = row.listing_date ?? row.close_date;
        return !row.details_fetched_at && attempted < liveCutoff && (!listedOn || listedOn >= listedCutoff);
      }
      return attempted < liveCutoff;
    })
    .sort((a, b) => (a.details_attempted_at ?? "").localeCompare(b.details_attempted_at ?? ""))
    .slice(0, BATCH_SIZE);

  const started = Date.now();
  const failedDirect: Row[] = [];
  const failures: { slug: string; reason: string }[] = [];
  let fetched = 0;
  let viaApify = 0;
  let writeErrors = 0;

  const store = async (row: Row, detail: IpoDetail, source: string) => {
    const { error: upErr } = await supabase.from("ipos").update(updateFor(row, detail, source, new Date().toISOString())).eq("id", row.id);
    if (upErr) {
      writeErrors++;
      failures.push({ slug: row.slug, reason: `write: ${upErr.message}` });
      return;
    }
    fetched++;
  };
  const recordFailure = async (row: Row, reason: string) => {
    failures.push({ slug: row.slug, reason });
    await supabase.from("ipos").update({ details_attempted_at: new Date().toISOString(), details_error: reason }).eq("id", row.id);
  };

  for (const row of due) {
    if (Date.now() - started > RUN_BUDGET_MS) break;
    const result = await fetchDirect(row.detail_url!);
    if ("detail" in result) await store(row, result.detail, "chittorgarh");
    else failedDirect.push(Object.assign({}, row, { details_error: result.reason }) as Row);
    await sleep(PACING_MS);
  }

  // Only what the direct fetch could not read goes to Apify, and only so many.
  for (const [index, row] of failedDirect.entries()) {
    const directReason = (row as Row & { details_error?: string }).details_error ?? "direct fetch failed";
    if (!apifyToken || index >= APIFY_MAX_PER_RUN || Date.now() - started > RUN_BUDGET_MS) {
      await recordFailure(row, `${directReason}${apifyToken ? "; Apify fallback deferred to a later run" : "; no APIFY_API_KEY"}`);
      continue;
    }
    const result = await fetchViaApify(row.detail_url!, apifyToken);
    if ("detail" in result) {
      viaApify++;
      await store(row, result.detail, "chittorgarh via apify");
    } else {
      await recordFailure(row, `${directReason}; ${result.reason}`);
    }
  }

  // Nothing readable at all from a non-empty batch is an outage; a few pages
  // failing is not, and is reported per slug.
  const status = (due.length > 0 && fetched === 0) || writeErrors > 0 ? 500 : 200;
  return json({ ok: status === 200, due: due.length, fetched, viaApify, failed: failures }, status);
});

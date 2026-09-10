// Collects NSE's own RSS feeds: corporate actions, financial-results filings
// and general company announcements.
//
// These are exchange-published primary sources, unlike the nine business-press
// feeds fetch-news reads. Press RSS carries a journalist's summary and cannot
// be attributed to a company reliably; these carry NSE's record of what a named
// company filed, which is what a per-ticker announcements surface needs.
//
// Reachable from this runtime because, unlike NSE's JSON APIs, the RSS
// endpoints need no cookie or session priming - verified from the deployed
// function (102 corporate actions, 4 result filings, 1,904 announcements).
// Nothing here needs the browser runner. What they DO need is a browser UA:
// see FEED_HEADERS.
//
// Triggered by GitHub Actions. Announcements move through the trading day, so
// this runs more often than the daily syncs.

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  parseAnnouncements,
  parseCorporateActions,
  parseFinancialResults,
} from "../_shared/nse-announcements.ts";
import { NSE_HEADERS } from "../_shared/nse.ts";

const FEEDS = {
  corporateActions: "https://nsearchives.nseindia.com/content/RSS/Corporate_action.xml",
  results: "https://nsearchives.nseindia.com/content/RSS/Financial_Results.xml",
  announcements: "https://nsearchives.nseindia.com/content/RSS/Online_announcements.xml",
} as const;

/**
 * NSE's browser UA, never one of our own. A "+https://www.sphpnp.com" bot
 * string here is what broke this function on its first deploy: NSE's CDN drops
 * the stream for it, and Deno reports that as "http2 error: stream error
 * received: unexpected internal error encountered" - which reads like a Deno
 * HTTP/2 bug and is not one. src/test/nse.test.ts fails any NSE caller that
 * declares a bot UA.
 */
const FEED_HEADERS = {
  "User-Agent": NSE_HEADERS["User-Agent"],
  Accept: "application/rss+xml, application/xml, text/xml",
};
const FETCH_TIMEOUT_MS = 25_000;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sync-secret",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

type SourceReport = { source: string; ok: boolean; rows: number; reason?: string };

/**
 * Fetches one feed and parses it, turning any failure into a reported outcome.
 *
 * Zero rows from a page that answered 200 is reported distinctly from a network
 * failure: it is the signature of the feed changing shape, and this repo has
 * been bitten repeatedly by sources that kept answering 200 while returning
 * nothing usable.
 */
async function collect<T>(
  source: string,
  url: string,
  parse: (xml: string) => T[],
): Promise<{ rows: T[]; report: SourceReport }> {
  try {
    const response = await fetch(url, {
      headers: FEED_HEADERS,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      return { rows: [], report: { source, ok: false, rows: 0, reason: `HTTP ${response.status}` } };
    }
    const xml = await response.text();
    const rows = parse(xml);
    if (rows.length === 0) {
      return {
        rows: [],
        report: {
          source, ok: false, rows: 0,
          reason: xml.includes("<item>") ? "items present but none parsed (feed shape changed?)" : "no <item> in response",
        },
      };
    }
    return { rows, report: { source, ok: true, rows: rows.length } };
  } catch (error) {
    return { rows: [], report: { source, ok: false, rows: 0, reason: error instanceof Error ? error.message : String(error) } };
  }
}

/**
 * Last row wins for any key that repeats inside one batch.
 *
 * Not defensive padding: an upsert whose payload contains the same conflict key
 * twice is rejected outright by Postgres ("ON CONFLICT DO UPDATE command cannot
 * affect row a second time"), which would fail the whole write over one company
 * re-filing the same document. The feeds repeat heavily: a debenture trustee
 * files one Security Cover Certificate PDF once per bond ISIN, a second apart
 * - one Sammaan Capital certificate appeared 157 times in a single feed, and
 * 1,459 announcements with attachments came down to 807 distinct documents.
 */
function dedupe<T>(rows: T[], key: (row: T) => string): T[] {
  const byKey = new Map<string, T>();
  for (const row of rows) byKey.set(key(row), row);
  return [...byKey.values()];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const secret = Deno.env.get("SYNC_SECRET");
  if (!secret || req.headers.get("x-sync-secret") !== secret) return json({ error: "Unauthorized" }, 401);

  try {
    const [actions, results, announcements] = await Promise.all([
      collect("corporate-actions", FEEDS.corporateActions, parseCorporateActions),
      collect("result-filings", FEEDS.results, parseFinancialResults),
      collect("announcements", FEEDS.announcements, parseAnnouncements),
    ]);

    const reports = [actions.report, results.report, announcements.report];
    for (const r of reports) {
      if (r.ok) console.log(`sync-announcements ok: ${r.source} (${r.rows})`);
      else console.error(`sync-announcements failed: ${r.source} - ${r.reason}`);
    }

    // Every feed failing is an outage worth shouting about, not a quiet no-op.
    if (reports.every((r) => !r.ok)) {
      return json({ error: "No NSE feed could be collected", sources: reports }, 502);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const written: Record<string, number> = {};

    /*
     * Corporate actions are keyed on (company, purpose, ex_date). Rows whose
     * ex_date could not be parsed are dropped rather than written with a null
     * key column - they would collide with each other on every run and each
     * overwrite the last.
     */
    const actionRows = dedupe(
      actions.rows.filter((a) => a.exDate),
      (a) => `${a.company}|${a.purpose}|${a.exDate}`,
    ).map((a) => ({
      company: a.company, purpose: a.purpose, series: a.series, face_value: a.faceValue,
      ex_date: a.exDate, record_date: a.recordDate, published_at: a.publishedAt, link: a.link,
      fetched_at: new Date().toISOString(),
    }));
    if (actionRows.length > 0) {
      const { error } = await supabase.from("nse_corporate_actions")
        .upsert(actionRows, { onConflict: "company,purpose,ex_date" });
      if (error) throw new Error(`corporate actions upsert: ${error.message}`);
      written.corporate_actions = actionRows.length;
    }

    // parsed_at is deliberately NOT set here: it belongs to whatever later reads
    // the XBRL, and setting it now would mark every filing as processed before
    // anything had looked at one.
    const filingRows = dedupe(results.rows, (f) => f.xbrlUrl).map((f) => ({
      company: f.company, xbrl_url: f.xbrlUrl, period_ended: f.periodEnded, period: f.period,
      is_consolidated: f.isConsolidated, is_audited: f.isAudited, published_at: f.publishedAt,
      fetched_at: new Date().toISOString(),
    }));
    if (filingRows.length > 0) {
      const { error } = await supabase.from("nse_result_filings")
        .upsert(filingRows, { onConflict: "xbrl_url" });
      if (error) throw new Error(`result filings upsert: ${error.message}`);
      written.result_filings = filingRows.length;
    }

    /*
     * Announcements arrive ~1,500 at a time, which is past what one PostgREST
     * call should carry, so they go in chunks. Keyed on attachment_url: the
     * same document re-published keeps one row rather than accumulating a
     * duplicate on every run.
     */
    const annRows = dedupe(
      announcements.rows.filter((a) => a.attachmentUrl),
      (a) => a.attachmentUrl,
    ).map((a) => ({
      company: a.company, subject: a.subject, detail: a.detail,
      attachment_url: a.attachmentUrl, published_at: a.publishedAt,
      fetched_at: new Date().toISOString(),
    }));
    for (let i = 0; i < annRows.length; i += 500) {
      const { error } = await supabase.from("nse_announcements")
        .upsert(annRows.slice(i, i + 500), { onConflict: "attachment_url" });
      if (error) throw new Error(`announcements upsert: ${error.message}`);
    }
    if (annRows.length > 0) written.announcements = annRows.length;

    return json({ ok: true, sources: reports, written, capturedAt: new Date().toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("sync-announcements failed:", message);
    return json({ error: message }, 500);
  }
});

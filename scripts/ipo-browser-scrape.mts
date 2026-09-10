// Renders the two IPO sources a Deno edge function provably cannot: InvestorGain
// and Chittorgarh both ship an empty <table> and inject their rows with
// client-side JavaScript (see the module comment in
// supabase/functions/sync-ipos/index.ts for the measured proof - InvestorGain's
// raw table reads literally "No data available", and Chittorgarh's report URLs
// redirect to a list page with no table at all).
//
// This script is the GitHub Actions producer for that gap: launch one headless
// Chromium, visit each page in turn, wait for its table to actually populate,
// then run the EXACT SAME parsers this repo already tests
// (parseInvestorGain / parseChittorgarh in ipo-parse.ts) against the rendered
// HTML - never a re-implementation, never raw HTML shipped over the wire. The
// parsed rows are POSTed as compact JSON to the sync-ipos edge function, which
// still fetches and parses IPO Watch itself (that source is server-rendered
// and always worked from the edge) and is the one place that reconciles all
// three sources and upserts the catalogue - see the write-path rationale in
// that file's module comment.
//
// Politeness, not permission: these are two ordinary content sites, not paid
// APIs, so requests are serialised through a single browser, spaced out, and
// sent with a real (if descriptive) User-Agent rather than run at whatever
// concurrency GitHub Actions would otherwise allow.

import { chromium } from "@playwright/test";
import {
  parseChittorgarh,
  parseInvestorGain,
  type ChittorgarhRow,
  type InvestorGainRow,
} from "../supabase/functions/_shared/ipo-parse.ts";

const SYNC_URL = "https://zbkjbbujsdlpujotgltm.supabase.co/functions/v1/sync-ipos";

// A real desktop Chrome fingerprint with a descriptive suffix identifying the
// crawler and a contact URL. Verified live (2026-09-10): this exact string
// rendered real tables on both sites; a plain bot-style UA is exactly the
// mistake documented in supabase/functions/_shared/nse.ts for a different
// site's WAF, so it is not repeated here.
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/124.0.0.0 Safari/537.36 sphpnp-ipo-monitor/1.0 (+https://www.sphpnp.com)";

const NAV_TIMEOUT_MS = 45_000;
const TABLE_WAIT_MS = 20_000;
const SETTLE_MS = 1_500;
// Spacing between page loads - polite, not evasive: one browser, one page at a
// time, with a breather between requests so this never reads as a burst.
const DELAY_BETWEEN_PAGES_MS = 3_000;

type Board = "mainboard" | "sme";

type RenderTarget = {
  name: string;
  url: string;
  board?: Board;
};

// Chittorgarh's own report URL now redirects here (verified live); the final
// URL is used directly to save a hop, but it must be kept in sync with
// SOURCES.chittorgarh in supabase/functions/sync-ipos/index.ts, which records
// this same base for provenance.
const CHITTORGARH_BASE = "https://www.chittorgarh.com/report/ipo-in-india-list-main-board-sme/82/";

const TARGETS: RenderTarget[] = [
  { name: "investorgain", url: "https://www.investorgain.com/report/ipo-gmp-live/331/" },
  { name: "chittorgarh-mainboard", url: `${CHITTORGARH_BASE}mainboard/`, board: "mainboard" },
  { name: "chittorgarh-sme", url: `${CHITTORGARH_BASE}sme/`, board: "sme" },
];

type RenderOutcome = { name: string; html: string | null; reason?: string };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function warn(message: string): void {
  console.log(`::warning title=IPO browser source degraded::${message}`);
}

function fail(message: string): void {
  console.log(`::error title=IPO browser source failed::${message}`);
}

/** Renders one page, retrying navigation once on a transient failure. */
async function renderOne(
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  target: RenderTarget,
): Promise<RenderOutcome> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const page = await browser.newPage({ userAgent: USER_AGENT });
    try {
      await page.goto(target.url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
      try {
        await page.waitForSelector("table tr td", { timeout: TABLE_WAIT_MS });
      } catch {
        // Table never populated - report it, but still return whatever HTML
        // we have so the caller can distinguish "no table" from "no rows" the
        // same way sync-ipos's own collect() does for IPO Watch.
        const html = await page.content();
        await page.close();
        return { name: target.name, html, reason: "table did not populate within timeout" };
      }
      await page.waitForTimeout(SETTLE_MS);
      const html = await page.content();
      await page.close();
      return { name: target.name, html };
    } catch (error) {
      await page.close().catch(() => {});
      const reason = error instanceof Error ? error.message : String(error);
      if (attempt === 0) {
        warn(`${target.name}: navigation failed (${reason}), retrying once`);
        await sleep(3_000);
        continue;
      }
      return { name: target.name, html: null, reason };
    }
  }
  return { name: target.name, html: null, reason: "unreachable" };
}

async function main(): Promise<void> {
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const syncSecret = process.env.MARKET_SYNC_SECRET;
  if (!anonKey || !syncSecret) {
    fail("SUPABASE_ANON_KEY and MARKET_SYNC_SECRET must both be set");
    process.exitCode = 1;
    return;
  }

  const browser = await chromium.launch();
  const outcomes: RenderOutcome[] = [];
  try {
    for (let i = 0; i < TARGETS.length; i++) {
      if (i > 0) await sleep(DELAY_BETWEEN_PAGES_MS);
      const outcome = await renderOne(browser, TARGETS[i]);
      outcomes.push(outcome);
    }
  } finally {
    await browser.close();
  }

  let investorgainRows: InvestorGainRow[] = [];
  let chittorgarhRows: ChittorgarhRow[] = [];

  for (const outcome of outcomes) {
    const target = TARGETS.find((t) => t.name === outcome.name)!;
    if (!outcome.html) {
      fail(`${outcome.name}: rendered no HTML (${outcome.reason ?? "unknown error"})`);
      continue;
    }
    if (outcome.reason) warn(`${outcome.name}: ${outcome.reason}`);

    if (target.name === "investorgain") {
      const parsed = parseInvestorGain(outcome.html);
      console.log(`${outcome.name}: tablesMatched=${parsed.tablesMatched} rows=${parsed.rows.length}`);
      if (parsed.rows.length === 0) {
        warn(`investorgain: ${parsed.tablesMatched === 0 ? "no matching table (layout changed?)" : "table matched but parsed 0 rows"}`);
      }
      investorgainRows = parsed.rows;
    } else {
      const board = target.board!;
      const parsed = parseChittorgarh(outcome.html, board);
      console.log(`${outcome.name}: tablesMatched=${parsed.tablesMatched} rows=${parsed.rows.length}`);
      if (parsed.rows.length === 0) {
        warn(`${outcome.name}: ${parsed.tablesMatched === 0 ? "no matching table (layout changed?)" : "table matched but parsed 0 rows"}`);
      }
      chittorgarhRows = chittorgarhRows.concat(parsed.rows);
    }
  }

  if (investorgainRows.length === 0 && chittorgarhRows.length === 0) {
    warn("both browser-rendered sources collected 0 rows this run - only IPO Watch (fetched server-side) can keep the catalogue current");
  }

  console.log(
    `Posting to sync-ipos: investorgain=${investorgainRows.length} rows, ` +
      `chittorgarh=${chittorgarhRows.length} rows (mainboard+sme combined)`,
  );

  let response: Response;
  try {
    response = await fetch(SYNC_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${anonKey}`,
        "x-sync-secret": syncSecret,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ investorgain: investorgainRows, chittorgarh: chittorgarhRows }),
      signal: AbortSignal.timeout(90_000),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    fail(`could not reach sync-ipos: ${reason}`);
    process.exitCode = 1;
    return;
  }

  const body = await response.text();
  console.log(body);

  if (!response.ok) {
    fail(`sync-ipos returned HTTP ${response.status}`);
    process.exitCode = 1;
    return;
  }

  try {
    const parsed = JSON.parse(body) as { sources?: { source: string; ok: boolean; rows: number; reason?: string }[] };
    for (const source of parsed.sources ?? []) {
      if (!source.ok) warn(`sync-ipos reports ${source.source} failed: ${source.reason ?? "unknown reason"}`);
    }
  } catch {
    // Non-JSON body with a 200 status would be unusual but is not itself a
    // failure signal - the HTTP status above is what this job's exit code
    // follows, consistent with every other sync-*.yml in this repo.
  }
}

await main();

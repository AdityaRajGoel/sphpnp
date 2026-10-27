// Collects the IPO catalogue from three independent sources and reconciles
// them into one entry per issue.
//
// It reads three sites rather than one because the single-source version read a
// fixed column order from IPO Watch, so when that table drifted every field
// silently took the wrong column and the whole page went wrong at once. With
// three parsers a layout change shows up as disagreement between sources and as
// one source reporting zero rows, both of which are recorded, rather than as
// quietly wrong numbers.
//
// Triggered by the VPS cron; not a visitor-facing scraper. Every successful
// collection appends a GMP observation, preserving the history the public
// detail chart draws - GMP snapshots are never rewritten.

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  type Board,
  type ChittorgarhRow,
  parseChittorgarhApi,
  parseInvestorGainApi,
  parseIpoWatch,
  toCatalogueRow,
} from "../_shared/ipo-parse.ts";
import { reconcileIpos } from "../_shared/ipo-reconcile.ts";
import { deriveIpoStatus, istDate } from "../_shared/ipo-status.ts";
import { adoptStoredIdentity, FILLABLE, planIpoMerges, preferFullName, resolveSlug, type IpoMerge, type StoredIpo } from "../_shared/ipo-identity.ts";
import { sanitizeChittorgarhRows, sanitizeInvestorGainRows } from "../_shared/ipo-ingest.ts";
import { errorText } from "../_shared/errors.ts";

const SOURCES = {
  ipowatch: "https://ipowatch.in/ipo-grey-market-premium-latest-ipo-gmp/",
  investorgain: "https://www.investorgain.com/report/ipo-gmp-live/331/",
  chittorgarh: "https://www.chittorgarh.com/report/ipo-in-india-list-main-board-sme/82/",
  // All three are fetched directly from this runtime. IPO Watch is
  // server-rendered. InvestorGain and Chittorgarh ship an empty table and fill
  // it from a JSON API on webnodejs.<site>.com, which answers a plain fetch
  // (found 2026-10-27 with scripts/discover-endpoints.mts) - see the API URLs
  // below and parseInvestorGainApi/parseChittorgarhApi.
  //
  // The headless-browser path (scripts/ipo-browser-scrape.mts, run by hand via
  // infra/vps/jobs/ipo-browser.sh) still POSTs rendered rows; they are used only
  // for a source whose API returned nothing this run.
} as const;

// Both take a year and a "2026-27"-style segment. InvestorGain validates the
// year but returns its current list whatever it is. Chittorgarh filters by the
// calendar year the issue opened (the second segment is ignored), so January
// also reads the previous year to keep issues that opened in late December.
const yearPath = (year: number) => `${year}/${year}-${String((year + 1) % 100).padStart(2, "0")}`;
const investorGainApi = (year: number) =>
  `https://webnodejs.investorgain.com/cloud/v2/report/data-read/331/1/10/${yearPath(year)}/0/all`;
const chittorgarhApi = (year: number, board: Board) =>
  `https://webnodejs.chittorgarh.com/cloud/report/data-read/82/1/10/${yearPath(year)}/0/${board}/0`;

const USER_AGENT = "Mozilla/5.0 (compatible; sphpnp-ipo-monitor/1.0; +https://www.sphpnp.com)";
const FETCH_TIMEOUT_MS = 30_000;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sync-secret",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

type SourceReport = { source: string; ok: boolean; rows: number; reason?: string };

/**
 * Fetches and parses one source, converting any failure into a reported
 * outcome rather than an exception.
 *
 * A single site being down, rate-limiting, or restructuring must degrade the
 * catalogue, never empty it - the whole reason for three sources. But a silent
 * skip would be its own defect, so every failure is recorded with a reason and
 * returned to the caller for logging.
 */
async function collect<T, E extends Record<string, unknown> = Record<string, never>>(
  source: string,
  url: string,
  parse: (html: string) => { rows: T[]; tablesMatched?: number } & E,
): Promise<{ rows: T[]; report: SourceReport } & Partial<E>> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/json" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      return { rows: [], report: { source, ok: false, rows: 0, reason: `HTTP ${response.status}` } };
    }
    const parsed = parse(await response.text());
    const { rows, tablesMatched } = parsed;
    if (rows.length === 0) {
      // Zero rows from a reachable page is the signature of layout drift, and
      // is worth distinguishing from a network failure when reading the logs.
      return {
        rows: [],
        report: {
          source,
          ok: false,
          rows: 0,
          reason: tablesMatched === 0 ? "no matching table (layout changed?)" : "table matched but parsed 0 rows",
        },
      };
    }
    return { ...parsed, rows, report: { source, ok: true, rows: rows.length } };
  } catch (error) {
    const reason = errorText(error);
    return { rows: [], report: { source, ok: false, rows: 0, reason } };
  }
}

type Db = ReturnType<typeof createClient>;

/**
 * Folds one duplicate row into its survivor, deleting the duplicate LAST.
 *
 * ipo_gmp_snapshots cascade-delete with their IPO, so the duplicate's GMP
 * history is moved across before the row goes. A snapshot at an instant the
 * survivor already has is dropped rather than moved: unique (ipo_id,
 * captured_at) would reject it, and both were written by the same run, for the
 * same issue. Any failure stops this merge before the delete, so the worst case
 * is a duplicate that survives until the next run retries it - never lost
 * history.
 */
async function applyMerge(supabase: Db, merge: IpoMerge): Promise<string | null> {
  const { data: kept, error: keptErr } = await supabase
    .from("ipo_gmp_snapshots").select("captured_at").eq("ipo_id", merge.intoId);
  if (keptErr) return `reading survivor snapshots: ${keptErr.message}`;

  const clashing = (kept ?? []).map((row: { captured_at: string }) => row.captured_at);
  if (clashing.length > 0) {
    const { error } = await supabase
      .from("ipo_gmp_snapshots").delete().eq("ipo_id", merge.fromId).in("captured_at", clashing);
    if (error) return `dropping clashing snapshots: ${error.message}`;
  }

  const { error: moveErr } = await supabase
    .from("ipo_gmp_snapshots").update({ ipo_id: merge.intoId }).eq("ipo_id", merge.fromId);
  if (moveErr) return `moving snapshots: ${moveErr.message}`;

  if (Object.keys(merge.patch).length > 0) {
    const { error } = await supabase.from("ipos").update(merge.patch).eq("id", merge.intoId);
    if (error) return `filling survivor fields: ${error.message}`;
  }

  const { error: deleteErr } = await supabase.from("ipos").delete().eq("id", merge.fromId);
  return deleteErr ? `deleting duplicate: ${deleteErr.message}` : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const secret = Deno.env.get("SYNC_SECRET");
  if (!secret || req.headers.get("x-sync-secret") !== secret) {
    return json({ error: "Unauthorized" }, 401);
  }

  // A body is only sent by the browser fallback (ipo-browser.sh): rows it
  // rendered and parsed, never raw HTML. A malformed body is ignored rather than
  // 500ing the request - the APIs and IPO Watch must still get through.
  let browserPayload: { investorgain?: unknown; chittorgarh?: unknown } = {};
  const rawBody = await req.text();
  if (rawBody) {
    try {
      const parsed = JSON.parse(rawBody);
      if (parsed && typeof parsed === "object") browserPayload = parsed;
    } catch {
      console.error("sync-ipos: ignoring malformed JSON body");
    }
  }

  try {
    const today = istDate();
    const year = Number(today.slice(0, 4));
    const years = today.slice(5, 7) === "01" ? [year, year - 1] : [year];
    const boards: Board[] = ["mainboard", "sme"];
    // Fetched in parallel: independent sites, and one slow response should not
    // push the whole run toward the function's time budget.
    const [watch, gain, ...chittorgarhParts] = await Promise.all([
      collect("ipowatch", SOURCES.ipowatch, (html) => parseIpoWatch(html)),
      collect("investorgain", investorGainApi(year), (text) => parseInvestorGainApi(JSON.parse(text))),
      ...years.flatMap((y) => boards.map((board) =>
        collect(`chittorgarh ${board} ${y}`, chittorgarhApi(y, board), (text) => parseChittorgarhApi(JSON.parse(text), board)))),
    ]);

    // A board/year list can legitimately be empty (no SME issue yet in January),
    // so the source counts as failed only when every list failed.
    const chittorgarhApiRows = chittorgarhParts.flatMap((part) => part.rows as ChittorgarhRow[]);
    const chittorgarhApiFailed = chittorgarhParts.every((part) => !part.report.ok);
    const browserInvestorGain = sanitizeInvestorGainRows(browserPayload.investorgain);
    const browserChittorgarh = sanitizeChittorgarhRows(browserPayload.chittorgarh);
    const investorgainRows = gain.rows.length > 0 ? gain.rows : browserInvestorGain;
    const chittorgarhRows = chittorgarhApiRows.length > 0 ? chittorgarhApiRows : browserChittorgarh;

    const sourceReport = (source: string, rows: number, apiReport: string | undefined): SourceReport =>
      rows > 0 ? { source, ok: true, rows } : { source, ok: false, rows: 0, reason: apiReport ?? "0 rows" };
    const reports: SourceReport[] = [
      watch.report,
      sourceReport("investorgain", investorgainRows.length, gain.report.reason),
      sourceReport("chittorgarh", chittorgarhRows.length,
        chittorgarhApiFailed ? chittorgarhParts.map((p) => `${p.report.source}: ${p.report.reason}`).join("; ") : undefined),
    ];
    if (gain.rows.length === 0 && browserInvestorGain.length > 0) console.log("sync-ipos: investorgain from the browser fallback");
    if (chittorgarhApiRows.length === 0 && browserChittorgarh.length > 0) console.log("sync-ipos: chittorgarh from the browser fallback");
    for (const report of reports) {
      if (!report.ok) console.error(`sync-ipos source failed: ${report.source} - ${report.reason}`);
      else console.log(`sync-ipos source ok: ${report.source} (${report.rows} rows)`);
    }

    // IPO Watch publishes listed-issue prices in a second table, returned
    // separately by the parser. Folding them onto the GMP rows by slug is what
    // makes FIELD_PRECEDENCE's `listing_price: ["ipowatch"]` reachable; without
    // this the field would be declared and permanently null.
    const listingPriceBySlug = new Map(
      (watch.listings ?? []).map((listing) => [listing.slug, listing.listing_price]),
    );
    const ipowatchRows = watch.rows.map((row) => {
      const listingPrice = listingPriceBySlug.get(row.slug);
      return listingPrice === undefined || listingPrice === null
        ? row
        : { ...row, listing_price: listingPrice };
    });

    // Every source failing is a real outage, not a quiet no-op: fail loudly so
    // the run surfaces it rather than reporting a successful empty run.
    if (ipowatchRows.length + investorgainRows.length + chittorgarhRows.length === 0) {
      return json(
        { error: "No IPO rows collected from any source", sources: reports },
        502,
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    // One stored row per issue: fold existing duplicates, then settle each
    // source row's identity against the catalogue before reconciling, and write
    // each issue under the slug already on record for it. Without that a source
    // dropping out, or naming an issue more briefly than another, would mint a
    // fresh row for an issue the catalogue already holds. See _shared/ipo-identity.ts.
    const { data: storedRows, error: storedErr } = await supabase
      .from("ipos").select(["id", "slug", "name", "created_at", "status", ...FILLABLE].join(","));
    if (storedErr) throw new Error(`reading stored IPOs failed: ${storedErr.message}`);
    const { merges, survivors } = planIpoMerges((storedRows ?? []) as unknown as StoredIpo[]);
    const mergeFailures: string[] = [];
    for (const merge of merges) {
      const failure = await applyMerge(supabase, merge);
      if (failure) mergeFailures.push(`${merge.fromSlug} -> ${merge.intoSlug}: ${failure}`);
      else console.log(`sync-ipos merged duplicate ${merge.fromSlug} into ${merge.intoSlug}`);
    }
    for (const failure of mergeFailures) console.error(`sync-ipos merge failed: ${failure}`);

    const reconciled = reconcileIpos({
      ipowatch: adoptStoredIdentity(ipowatchRows, survivors),
      investorgain: adoptStoredIdentity(investorgainRows, survivors),
      chittorgarh: adoptStoredIdentity(chittorgarhRows, survivors),
    });
    const storedName = new Map(survivors.map((row) => [row.slug, row.name]));
    // A slug twice in one upsert fails the whole batch ("cannot affect row a
    // second time"), so a clash adoptStoredIdentity did not settle is skipped
    // and logged rather than costing every other issue this run.
    const written = new Set<string>();
    const resolved = reconciled.flatMap((ipo) => {
      const slug = resolveSlug(ipo, survivors);
      if (written.has(slug)) {
        console.error(`sync-ipos: skipped "${ipo.name}", a second issue resolving to ${slug}`);
        return [];
      }
      written.add(slug);
      return [{ ...ipo, slug, name: preferFullName(ipo.name, storedName.get(slug)) }];
    });

    const capturedAt = new Date().toISOString();
    const contributing = reports.filter((r) => r.ok).map((r) => r.source);
    const sourcesLabel = contributing.join("+") || "none";
    // Multiple sources may have contributed to this run - one URL column can
    // no longer name a single source, so it lists every one that actually did.
    const sourceUrl = contributing
      .map((source) => SOURCES[source as keyof typeof SOURCES])
      .filter(Boolean)
      .join(" | ") || SOURCES.ipowatch;

    // Status from the calendar, with the reconciled label only able to move it
    // forward. Reconciling labels alone stored every Chittorgarh-only issue as
    // "upcoming" indefinitely - see _shared/ipo-status.ts.
    const catalogueRows = resolved.map((ipo) =>
      toCatalogueRow(
        { ...ipo, status: deriveIpoStatus(ipo, ipo.status, today) },
        sourcesLabel,
        sourceUrl,
        capturedAt,
      ),
    );

    // PostgREST derives one column list per bulk upsert from the batch it is
    // given, and these rows deliberately omit different fields depending on
    // what each source knew. Mixing shapes in one call would write NULL into
    // the omitted columns, which is precisely the clobbering the omission
    // exists to prevent - so rows are grouped by shape, as screener-row.ts does.
    const byShape = new Map<string, Record<string, unknown>[]>();
    for (const row of catalogueRows) {
      const key = Object.keys(row).sort().join(",");
      const group = byShape.get(key);
      if (group) group.push(row);
      else byShape.set(key, [row]);
    }

    const idsBySlug = new Map<string, string>();
    for (const group of byShape.values()) {
      const { data, error } = await supabase
        .from("ipos")
        .upsert(group, { onConflict: "slug" })
        .select("id,slug");
      if (error) throw new Error(`IPO upsert failed: ${error.message}`);
      for (const row of (data ?? []) as { id: string; slug: string }[]) {
        idsBySlug.set(row.slug, row.id);
      }
    }

    const snapshots = resolved.flatMap((ipo) => {
      const ipoId = idsBySlug.get(ipo.slug);
      if (!ipoId || ipo.gmp === null) return [];
      return [{
        ipo_id: ipoId,
        captured_at: capturedAt,
        gmp: ipo.gmp,
        est_listing_price: ipo.est_listing_price,
        source: ipo.gmp_sources.join("+") || "unknown",
        sources: ipo.gmp_sources,
      }];
    });

    if (snapshots.length > 0) {
      const { error } = await supabase.from("ipo_gmp_snapshots").insert(snapshots);
      if (error) throw new Error(`GMP snapshot insert failed: ${error.message}`);
    }

    return json({
      ok: true,
      ipos: resolved.length,
      snapshots: snapshots.length,
      merged: merges.length - mergeFailures.length,
      mergeFailures,
      sources: reports,
      capturedAt,
    });
  } catch (error) {
    const message = errorText(error);
    console.error("sync-ipos failed:", message);
    return json({ error: message }, 500);
  }
});

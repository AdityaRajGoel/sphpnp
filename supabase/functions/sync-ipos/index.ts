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
// Triggered by GitHub Actions; not a visitor-facing scraper. Every successful
// collection appends a GMP observation, preserving the history the public
// detail chart draws - GMP snapshots are never rewritten.

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  parseChittorgarh,
  parseInvestorGain,
  parseIpoWatch,
  toCatalogueRow,
} from "../_shared/ipo-parse.ts";
import { reconcileIpos } from "../_shared/ipo-reconcile.ts";

const SOURCES = {
  ipowatch: "https://ipowatch.in/ipo-grey-market-premium-latest-ipo-gmp/",
  investorgain: "https://www.investorgain.com/report/live-ipo-gmp/331/",
  chittorgarhMainboard: "https://www.chittorgarh.com/report/latest-ipo-gmp-grey-market-premium/15/",
  chittorgarhSme: "https://www.chittorgarh.com/report/latest-sme-ipo-gmp-grey-market/72/",
} as const;

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
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
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
    const reason = error instanceof Error ? error.message : String(error);
    return { rows: [], report: { source, ok: false, rows: 0, reason } };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const secret = Deno.env.get("SYNC_SECRET");
  if (!secret || req.headers.get("x-sync-secret") !== secret) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    // Fetched in parallel: they are independent sites and one slow response
    // should not push the whole run toward the function's time budget.
    const [watch, gain, cgMain, cgSme] = await Promise.all([
      collect("ipowatch", SOURCES.ipowatch, (html) => parseIpoWatch(html)),
      collect("investorgain", SOURCES.investorgain, (html) => parseInvestorGain(html)),
      collect("chittorgarh-mainboard", SOURCES.chittorgarhMainboard, (html) => parseChittorgarh(html, "mainboard")),
      collect("chittorgarh-sme", SOURCES.chittorgarhSme, (html) => parseChittorgarh(html, "sme")),
    ]);

    const reports = [watch.report, gain.report, cgMain.report, cgSme.report];
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

    const reconciled = reconcileIpos({
      ipowatch: ipowatchRows,
      investorgain: gain.rows,
      chittorgarh: [...cgMain.rows, ...cgSme.rows],
    });

    // Every source failing is a real outage, not a quiet no-op: fail loudly so
    // the workflow surfaces it rather than reporting a successful empty run.
    if (reconciled.length === 0) {
      return json(
        { error: "No IPO rows collected from any source", sources: reports },
        502,
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const capturedAt = new Date().toISOString();
    const contributing = reports.filter((r) => r.ok).map((r) => r.source);
    const sourcesLabel = contributing.join("+") || "none";

    const catalogueRows = reconciled.map((ipo) =>
      toCatalogueRow(ipo, sourcesLabel, SOURCES.ipowatch, capturedAt),
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

    const snapshots = reconciled.flatMap((ipo) => {
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
      ipos: reconciled.length,
      snapshots: snapshots.length,
      sources: reports,
      capturedAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("sync-ipos failed:", message);
    return json({ error: message }, 500);
  }
});

// Ingests Indian macro indicators from World Bank Open Data (CC-BY 4.0) and
// USD/EUR/GBP-INR exchange rates from Frankfurter (open source over ECB
// reference rates) - the two sources in a wide survey with unambiguously
// clean licensing, and neither requiring an API key.
//
// Trigger: GitHub Actions cron, daily (see .github/workflows/macro-sync.yml).
// World Bank indicators only change annually and Frankfurter only publishes
// one rate per trading day, so a daily run is the right cadence - unlike the
// hourly market-data syncs, running this more often would just repeat the
// same upstream answer.
//
// No cursor/batch here, unlike sync-fundamentals-yahoo: the whole job is three
// World Bank indicators and three currency pairs, six HTTP calls total, so it
// always completes in one invocation and there is no universe to page through.

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  parseWorldBankIndicator,
  parseFrankfurterRate,
  type WorldBankObservation,
} from "../_shared/macro.ts";
import { SyncObservation } from "../_shared/observation.ts";
import { upsertWithRetry } from "../_shared/db-retry.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-sync-secret",
};

const JOB = "macro";
const COUNTRY = "IND";

// Three indicators carried, chosen from probing the World Bank catalogue for
// India: a price signal (inflation), a growth signal (GDP growth), and a
// scale signal (GDP per capita) - broad enough to characterize the economy
// without turning this into a full national-accounts mirror. Other candidates
// probed (e.g. unemployment, FP.CPI.TOTL - the price level rather than its
// growth rate) were dropped as redundant with what these three already cover.
const INDICATORS: { code: string; name: string }[] = [
  { code: "FP.CPI.TOTL.ZG", name: "Inflation, consumer prices (annual %)" },
  { code: "NY.GDP.MKTP.KD.ZG", name: "GDP growth (annual %)" },
  { code: "NY.GDP.PCAP.CD", name: "GDP per capita (current US$)" },
];

// USD/INR is the one the task requires; EUR/INR and GBP/INR are carried too
// since each costs one extra `fetch` against the same free, keyless endpoint.
const FX_PAIRS: { base: string; quote: string }[] = [
  { base: "USD", quote: "INR" },
  { base: "EUR", quote: "INR" },
  { base: "GBP", quote: "INR" },
];

async function fetchWorldBank(code: string): Promise<unknown | null> {
  const url =
    `https://api.worldbank.org/v2/country/${COUNTRY}/indicator/${encodeURIComponent(code)}` +
    `?format=json&per_page=100`;
  const res = await fetch(url);
  // The World Bank answers a bad request with 200 + an error envelope, not a
  // 4xx (see _shared/macro.ts) - res.ok only catches transport-level failures
  // (5xx, network errors). The envelope itself is parseWorldBankIndicator's
  // job to reject.
  if (!res.ok) return null;
  return await res.json();
}

async function fetchFrankfurter(base: string, quote: string): Promise<unknown | null> {
  // api.frankfurter.app 301s to api.frankfurter.dev/v1. Deno follows the
  // redirect so the old host still worked, but it cost an extra round trip on
  // every one of the three FX calls, and a host that only answers with a
  // redirect is one deprecation away from answering with nothing.
  const url = `https://api.frankfurter.dev/v1/latest?from=${encodeURIComponent(base)}&to=${encodeURIComponent(quote)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return await res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const secret = Deno.env.get("SYNC_SECRET");
  if (!secret || req.headers.get("x-sync-secret") !== secret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const summary = {
    indicators: INDICATORS.length,
    pairs: FX_PAIRS.length,
    macroRows: 0,
    fxRows: 0,
    worldBankFailed: 0,
    frankfurterFailed: 0,
  };
  // Write failures are counted separately from upstream failures, same split
  // as sync-fundamentals-yahoo: a fetch/parse failure means the source
  // refused us or changed shape, a write failure means our own database
  // rejected a well-formed row. Different fault classes, same containment
  // (skip this item, keep the run going), but conflating them under one
  // counter would misdirect on-call at the wrong system.
  let writeFailed = 0;
  // The message of every write that still failed after its retries. A bare
  // count ("1 write(s) failed") is what made the first occurrence of this
  // undiagnosable - the Postgres error existed only in the edge function's
  // console, which nobody reads until long after the run is gone. Carried into
  // the observation row so sync_observations alone answers "why".
  const writeErrors: string[] = [];

  // Opened before any work, same reasoning as every other sync in this repo:
  // a run killed mid-flight still leaves a visible 'running' row rather than
  // no trace at all.
  const observation = new SyncObservation(supabase, JOB);
  await observation.open({
    indicators: INDICATORS.map((i) => i.code),
    pairs: FX_PAIRS.map((p) => `${p.base}/${p.quote}`),
  });

  for (const indicator of INDICATORS) {
    let json: unknown | null = null;
    try {
      json = await fetchWorldBank(indicator.code);
    } catch (err) {
      console.error(`world bank fetch failed for ${indicator.code}:`, (err as Error).message);
      json = null;
    }

    if (json === null) {
      summary.worldBankFailed++;
      observation.recordFailure("world-bank", 1);
      continue;
    }

    let observations: WorldBankObservation[] = [];
    try {
      observations = parseWorldBankIndicator(json);
    } catch (err) {
      // A throw here means the payload didn't even match the expected
      // [metadata, data[]] shape closely enough for the parser's own guards -
      // counted as a parse failure, distinct from an upstream fetch failure,
      // so a schema change on the World Bank side is diagnosable from
      // sync_observations without re-fetching the payload by hand.
      console.error(`world bank parse failed for ${indicator.code}:`, (err as Error).message);
      observation.recordFailure("parse", 1);
      continue;
    }

    // An empty result is not necessarily a failure - it is also what the
    // error envelope and an out-of-range page both parse down to (see
    // _shared/macro.ts) - so nothing is written and nothing is counted as a
    // failure either. The wroteNothing gate below is what catches the case
    // where this happens for every indicator in the same run.
    if (observations.length === 0) continue;

    const rows = observations.map((o) => ({
      country_code: COUNTRY,
      indicator_code: indicator.code,
      indicator_name: indicator.name,
      year: o.year,
      value: o.value,
      source: "world-bank",
      fetched_at: new Date().toISOString(),
    }));

    // postgrest-js resolves with an error rather than throwing, so the result
    // is checked explicitly rather than relying on a try/catch to see it - the
    // exact pattern that silently dropped writes elsewhere in this repo.
    // Retried because a single transient upsert failure here once reddened a
    // build that had already written 135 of 200 rows (see _shared/db-retry.ts).
    const failure = await upsertWithRetry(
      () =>
        supabase
          .from("macro_indicators")
          .upsert(rows, { onConflict: "country_code,indicator_code,year,source" }),
      `macro_indicators/${indicator.code}`,
    );
    if (failure) {
      observation.recordFailure("macro_indicators", 1);
      writeFailed++;
      writeErrors.push(`macro_indicators/${indicator.code}: ${failure}`);
    } else {
      summary.macroRows += rows.length;
      observation.recordWrite("macro_indicators", rows.length);
    }
  }

  for (const { base, quote } of FX_PAIRS) {
    let json: unknown | null = null;
    try {
      json = await fetchFrankfurter(base, quote);
    } catch (err) {
      console.error(`frankfurter fetch failed for ${base}/${quote}:`, (err as Error).message);
      json = null;
    }

    if (json === null) {
      summary.frankfurterFailed++;
      observation.recordFailure("frankfurter", 1);
      continue;
    }

    const parsed = parseFrankfurterRate(json, quote);
    if (!parsed) {
      // Frankfurter answers an unsupported/malformed pair with 200 + a body
      // that has no `rates` key (see _shared/macro.ts), so this is the same
      // fault class as a fetch failure from the caller's point of view: this
      // pair produced nothing this run, whether the source refused us
      // outright or answered with a shape we could not read.
      summary.frankfurterFailed++;
      observation.recordFailure("frankfurter", 1);
      continue;
    }

    const row = {
      pair: `${base}/${quote}`,
      rate_date: parsed.date,
      rate: parsed.rate,
      source: "frankfurter",
      fetched_at: new Date().toISOString(),
    };

    const failure = await upsertWithRetry(
      () => supabase.from("fx_rates").upsert([row], { onConflict: "pair,rate_date,source" }),
      `fx_rates/${base}/${quote}`,
    );
    if (failure) {
      observation.recordFailure("fx_rates", 1);
      writeFailed++;
      writeErrors.push(`fx_rates/${base}/${quote}: ${failure}`);
    } else {
      summary.fxRows += 1;
      observation.recordWrite("fx_rates", 1);
    }
  }

  // Every World Bank call AND every Frankfurter call failing in the same run
  // is not a partial - it is both upstreams refusing us (or being
  // unreachable) at once, and it must turn the build red on its own.
  const blockedOut =
    summary.worldBankFailed === INDICATORS.length && summary.frankfurterFailed === FX_PAIRS.length;
  const anyWriteFailed = writeFailed > 0;
  // The mandatory gate: a run that wrote nothing to either table must never
  // report the same 200 a working run would. This catches the case blockedOut
  // and anyWriteFailed cannot see between them - every fetch succeeding but
  // every parse landing on zero rows (a schema drift on either source's side,
  // or an all-null-value World Bank response), which would otherwise close
  // this run as {"ok":true, macroRows:0, fxRows:0} - the exact
  // {"ok":true,rows:0} shape this repo has already shipped as a real incident
  // for a different sync.
  const wroteNothing = observation.wroteNothing;
  const status = blockedOut || anyWriteFailed || wroteNothing ? 500 : 200;

  await observation.close({
    status: status === 200 ? "ok" : "failed",
    detail: { ...summary, blockedOut, writeFailed, wroteNothing, writeErrors },
    error: blockedOut
      ? `every upstream call failed (${summary.worldBankFailed}/${INDICATORS.length} World Bank, ` +
        `${summary.frankfurterFailed}/${FX_PAIRS.length} Frankfurter)`
      : anyWriteFailed
        ? `${writeFailed} write(s) failed after retries: ${writeErrors.join("; ")}`
        : wroteNothing
          ? "run completed without writing any row to macro_indicators or fx_rates"
          : undefined,
  });

  return new Response(
    JSON.stringify({ ok: !blockedOut && !anyWriteFailed && !wroteNothing, ...summary }),
    {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    },
  );
});

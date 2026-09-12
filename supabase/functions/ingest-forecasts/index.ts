// Receives Kronos forecast rows from the GitHub Actions job and writes them.
//
// WHY THIS EXISTS AT ALL, rather than the job writing to PostgREST directly:
// every other workflow in this repo carries only the anon key plus a shared
// sync secret, and the service-role key lives exclusively in Supabase where
// the edge functions run. A Python job writing straight to the table would
// have needed that key in GitHub Actions secrets - a strictly weaker posture
// than everything around it, and the sort of exception that quietly becomes
// the norm. This function keeps the key where the others keep it.
//
// Everything arriving here is treated as untrusted input. The job is the only
// intended caller, but the shared secret is what makes that true, and a
// blind insert of a posted JSON array would let anyone who learned the secret
// write arbitrary columns.

import { createClient } from "npm:@supabase/supabase-js@2";
import { SyncObservation } from "../_shared/observation.ts";
import { upsertWithRetry } from "../_shared/db-retry.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-sync-secret",
};

const JOB = "kronos-forecast";

/** One posted row, after validation. Anything not listed here is discarded. */
type ForecastRow = {
  symbol: string;
  as_of: string;
  model: string;
  horizon_days: number;
  samples: number;
  last_close: number;
  band_low: number;
  band_mid: number;
  band_high: number;
  band_low_pct: number;
  band_mid_pct: number;
  band_high_pct: number;
  path: unknown[];
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SYMBOL = /^[A-Z0-9&.-]{1,30}$/;

/** A generous ceiling that still refuses a runaway: 250 symbols is five times the job's default. */
const MAX_ROWS = 250;

const num = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

/**
 * Validates one row. Returns null - discarding it - rather than coercing:
 * a forecast row with a missing band is not a forecast, and the columns are
 * NOT NULL precisely so a half-row cannot be stored.
 */
function validate(raw: unknown): ForecastRow | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;

  const symbol = typeof row.symbol === "string" ? row.symbol.toUpperCase().trim() : "";
  if (!SYMBOL.test(symbol)) return null;
  if (typeof row.as_of !== "string" || !ISO_DATE.test(row.as_of)) return null;
  if (typeof row.model !== "string" || row.model.length === 0 || row.model.length > 120) return null;

  const numbers = {
    horizon_days: num(row.horizon_days),
    samples: num(row.samples),
    last_close: num(row.last_close),
    band_low: num(row.band_low),
    band_mid: num(row.band_mid),
    band_high: num(row.band_high),
    band_low_pct: num(row.band_low_pct),
    band_mid_pct: num(row.band_mid_pct),
    band_high_pct: num(row.band_high_pct),
  };
  if (Object.values(numbers).some((value) => value === null)) return null;

  // A band whose edges are out of order, or a non-positive price, means the
  // percentiles were computed wrong upstream - storing it would put a broken
  // range on a stock page.
  if (!(numbers.last_close! > 0)) return null;
  if (!(numbers.band_low! <= numbers.band_mid! && numbers.band_mid! <= numbers.band_high!)) return null;
  if (!(numbers.horizon_days! > 0 && numbers.samples! > 0)) return null;

  return {
    symbol,
    as_of: row.as_of,
    model: row.model,
    horizon_days: Math.round(numbers.horizon_days!),
    samples: Math.round(numbers.samples!),
    last_close: numbers.last_close!,
    band_low: numbers.band_low!,
    band_mid: numbers.band_mid!,
    band_high: numbers.band_high!,
    band_low_pct: numbers.band_low_pct!,
    band_mid_pct: numbers.band_mid_pct!,
    band_high_pct: numbers.band_high_pct!,
    // Kept as posted but only as an array; the cone is rendered from it and a
    // malformed entry costs a chart, not a figure.
    path: Array.isArray(row.path) ? row.path.slice(0, 400) : [],
  };
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

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Body is not JSON" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const posted = Array.isArray(payload) ? payload : (payload as { rows?: unknown })?.rows;
  if (!Array.isArray(posted)) {
    return new Response(JSON.stringify({ error: "Expected an array of forecast rows" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  if (posted.length > MAX_ROWS) {
    return new Response(JSON.stringify({ error: `Too many rows (${posted.length} > ${MAX_ROWS})` }), {
      status: 413,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const rows: ForecastRow[] = [];
  let rejected = 0;
  for (const raw of posted) {
    const row = validate(raw);
    if (row) rows.push(row);
    else rejected++;
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const observation = new SyncObservation(supabase, JOB);
  await observation.open({ posted: posted.length });

  let writeError: string | null = null;
  if (rows.length > 0) {
    writeError = await upsertWithRetry(
      () => supabase.from("stock_forecasts").upsert(rows, { onConflict: "symbol,as_of,model,horizon_days" }),
      "stock_forecasts",
    );
    if (writeError) observation.recordFailure("stock_forecasts", 1);
    else observation.recordWrite("stock_forecasts", rows.length);
  }

  // Nothing usable in a non-empty post means the job's output shape changed -
  // loud, because the alternative is a green run that stored nothing.
  const status = writeError || (posted.length > 0 && rows.length === 0) ? 500 : 200;

  await observation.close({
    status: status === 200 ? "ok" : "failed",
    detail: { posted: posted.length, written: rows.length, rejected },
    error: writeError ?? (rows.length === 0 && posted.length > 0 ? "every posted row failed validation" : undefined),
  });

  return new Response(JSON.stringify({ ok: status === 200, written: rows.length, rejected }), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
});

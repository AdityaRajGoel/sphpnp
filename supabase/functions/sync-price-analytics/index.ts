// Computes the risk/trend/participation measures for the tracked universe from
// the daily bars already in eq_eod, and writes them to stock_price_analytics.
//
// Trigger: GitHub Actions cron, after the bhavcopy sync has landed the day's
// bars (see .github/workflows/price-analytics-sync.yml). Nothing here fetches
// anything external - every input is already in this database - so the run is
// bounded by query time rather than by somebody else's rate limit.
//
// THE BAR SELECTION IS LOAD-BEARING. eq_eod holds the same symbol on both NSE
// and BSE, at different closes, across several series. Interleaving them gives
// a volatility that is mostly the spread between two venues, so this reads NSE
// series EQ only and says so in the query rather than deduplicating afterwards.

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  adjustForCorporateActions,
  computePriceAnalytics,
  type Bar,
  type CorporateAction,
} from "../_shared/price-analytics.ts";
import {
  adx,
  bollingerBands,
  dailyVwap,
  macd,
  moneyFlowIndex,
  movingAverages,
  obvTrend,
  relativeStrength,
  stochastic,
} from "../_shared/technical-indicators.ts";
import { SyncObservation } from "../_shared/observation.ts";
import { upsertWithRetry } from "../_shared/db-retry.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-sync-secret",
};

const JOB = "price-analytics";

/**
 * Symbols per invocation. Each one costs a single indexed eq_eod query of at
 * most ~400 rows, so this is far cheaper than any of the fetch-bound syncs;
 * the cap exists to stay clear of the edge function's wall-clock limit on a
 * slow day, not because the work is heavy.
 */
const BATCH_SIZE = 60;

/** Symbol queries in flight at once. Postgres is fine with this; the pooler is the limit. */
const CONCURRENCY = 8;

/** Bars to read per symbol - a little over a year of sessions, which is all eq_eod holds. */
const LOOKBACK_BARS = 400;

/**
 * Beta and correlation are quoted against the Nifty 50, stored per row so a
 * later change of benchmark cannot silently reinterpret old numbers.
 */
const BENCHMARK = "Nifty 50";

/** Supabase kills an edge function at 150s; stop starting new work well before. */
const TIME_BUDGET_MS = 110_000;

type SupabaseClient = ReturnType<typeof createClient>;

async function fetchBars(supabase: SupabaseClient, symbol: string): Promise<Bar[]> {
  const { data, error } = await supabase
    .from("eq_eod")
    .select("trade_date, close, high, low, volume, deliv_pct, turnover_lacs")
    .eq("symbol", symbol)
    .eq("exchange", "NSE")
    .eq("series", "EQ")
    .order("trade_date", { ascending: false })
    .limit(LOOKBACK_BARS);
  if (error) {
    console.error(`eq_eod read failed for ${symbol}:`, error.message);
    return [];
  }
  // Newest-first from the index, oldest-first for the measures.
  return ((data ?? []) as Bar[]).slice().reverse();
}

/**
 * The technical indicators, flattened to the column names the table uses.
 * Every one of them is independently nullable: a symbol with eight months of
 * bars has a real MACD and no 200-day average, and both facts are true at once.
 */
function technicals(bars: Bar[], benchmark: Bar[]): Record<string, unknown> {
  const ma = movingAverages(bars);
  const macdValue = macd(bars);
  const bands = bollingerBands(bars);
  const stoch = stochastic(bars);
  const directional = adx(bars);
  const lastBar = bars[bars.length - 1];
  const vwap = dailyVwap(lastBar as Bar & { turnover_lacs?: number | null });

  return {
    sma_20: ma.sma20,
    sma_50: ma.sma50,
    sma_200: ma.sma200,
    distance_from_200: ma.distanceFrom200,
    ma_trend: ma.trend,
    macd: macdValue?.macd ?? null,
    macd_signal: macdValue?.signal ?? null,
    macd_histogram: macdValue?.histogram ?? null,
    bollinger_upper: bands?.upper ?? null,
    bollinger_lower: bands?.lower ?? null,
    bollinger_percent_b: bands?.percentB ?? null,
    bollinger_bandwidth: bands?.bandwidth ?? null,
    stochastic_k: stoch?.k ?? null,
    stochastic_d: stoch?.d ?? null,
    adx: directional?.adx ?? null,
    plus_di: directional?.plusDi ?? null,
    minus_di: directional?.minusDi ?? null,
    obv_trend_20: obvTrend(bars),
    money_flow_index: moneyFlowIndex(bars),
    vwap: vwap?.vwap ?? null,
    close_vs_vwap: vwap?.closeVsVwap ?? null,
    relative_strength_3m: relativeStrength(bars, benchmark),
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

  const started = Date.now();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: universe, error: universeError } = await supabase
    .from("screener_stocks")
    .select("symbol")
    .order("symbol");
  if (universeError) {
    return new Response(JSON.stringify({ error: universeError.message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const symbols = (universe ?? []).map((row) => row.symbol as string);
  const { data: cursorRow } = await supabase
    .from("sync_cursors").select("cursor").eq("job", JOB).maybeSingle();

  let start = 0;
  if (cursorRow?.cursor) {
    const index = symbols.indexOf(cursorRow.cursor as string);
    // A cursor symbol that has left the universe restarts the pass. Logged
    // rather than silent: it costs a full extra pass, and an unexplained
    // restart looks identical to an ordinary batch boundary in the counts.
    if (index === -1) console.error(`cursor symbol ${cursorRow.cursor} no longer in universe; restarting`);
    else start = index + 1;
  }
  const batch = symbols.slice(start, start + BATCH_SIZE);
  const wrapped = start + batch.length >= symbols.length;

  const summary = {
    symbols: batch.length,
    computed: 0,
    /** Symbols with too few bars to say anything at all. Thin coverage, not a fault. */
    noBars: 0,
    /**
     * Symbols whose series still had an unexplained jump, or a corporate action
     * inside the window we could not parse. The measures are REFUSED for these
     * rather than published wrong - see price-analytics.ts. A handful is
     * normal; a spike means a corporate-action description format changed.
     */
    refused: 0,
    refusedSymbols: [] as string[],
    wrapped,
    budgetExhausted: false,
  };
  let writeFailed = 0;
  const writeErrors: string[] = [];

  // Opened before any work: a run killed mid-flight leaves a visible 'running'
  // row rather than no trace at all.
  const observation = new SyncObservation(supabase, JOB);
  await observation.open({ batch, cursorStart: start, universeSize: symbols.length, benchmark: BENCHMARK });

  // One benchmark read for the whole batch, not one per symbol.
  const { data: benchmarkRows, error: benchmarkError } = await supabase
    .from("index_valuation_daily")
    .select("trade_date, close")
    .eq("index_name", BENCHMARK)
    .order("trade_date", { ascending: false })
    .limit(LOOKBACK_BARS);
  if (benchmarkError) console.error(`benchmark read failed:`, benchmarkError.message);
  const benchmark = ((benchmarkRows ?? []) as Bar[]).slice().reverse();

  // Every action for the batch in one read. Dividends and AGMs come back too:
  // the adjuster needs to see them to tell "nothing to adjust for" apart from
  // "an action we could not read", which is the difference between a trusted
  // series and a refused one.
  const { data: actionRows } = await supabase
    .from("fundamentals_corporate_actions")
    .select("symbol, ex_date, action_type, description")
    .in("symbol", batch);
  const actionsBySymbol = new Map<string, CorporateAction[]>();
  for (const row of (actionRows ?? []) as (CorporateAction & { symbol: string })[]) {
    const list = actionsBySymbol.get(row.symbol) ?? [];
    list.push(row);
    actionsBySymbol.set(row.symbol, list);
  }

  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < batch.length; i += CONCURRENCY) {
    if (Date.now() - started > TIME_BUDGET_MS) {
      summary.budgetExhausted = true;
      break;
    }
    const slice = batch.slice(i, i + CONCURRENCY);
    const results = await Promise.all(slice.map(async (symbol) => ({ symbol, bars: await fetchBars(supabase, symbol) })));

    for (const { symbol, bars } of results) {
      if (bars.length === 0) {
        summary.noBars++;
        continue;
      }
      const symbolActions = actionsBySymbol.get(symbol) ?? [];
      const analytics = computePriceAnalytics(bars, benchmark, symbolActions);
      if (analytics === null) {
        summary.refused++;
        summary.refusedSymbols.push(symbol);
        observation.recordFailure("refused", 1);
        continue;
      }
      // The technicals run on the SAME adjusted bars the risk measures used,
      // not on the raw ones: a 200-day average computed across an unadjusted
      // split is as wrong as a volatility computed across it, and passing the
      // raw series here would quietly reintroduce the defect the refusal above
      // exists to prevent.
      //
      // Adjusting a second time from the RAW bars is safe and is why it is done
      // this way round - the adjustment is a pure function of (raw bars,
      // actions), so it lands on the same series. Passing already-adjusted bars
      // back through it would divide by the ratio twice.
      const adjusted = adjustForCorporateActions(bars, symbolActions).bars;
      rows.push({ symbol, benchmark: BENCHMARK, ...analytics, ...technicals(adjusted, benchmark) });
    }
  }

  if (rows.length > 0) {
    const failure = await upsertWithRetry(
      () => supabase.from("stock_price_analytics").upsert(rows, { onConflict: "symbol,as_of" }),
      "stock_price_analytics",
    );
    if (failure) {
      writeFailed++;
      writeErrors.push(failure);
      observation.recordFailure("stock_price_analytics", 1);
    } else {
      summary.computed = rows.length;
      observation.recordWrite("stock_price_analytics", rows.length);
    }
  }

  // The cursor advances only over symbols actually attempted. A run cut short
  // by the time budget must resume where it stopped, not skip the rest of the
  // batch - otherwise a chronically slow day silently starves the tail of the
  // universe, which is a bug that only shows up as stale rows weeks later.
  const attempted = summary.computed + summary.refused + summary.noBars;
  if (attempted > 0 && writeFailed === 0) {
    const lastDone = batch[attempted - 1];
    await supabase.from("sync_cursors").upsert(
      { job: JOB, cursor: wrapped && attempted >= batch.length ? null : lastDone, updated_at: new Date().toISOString() },
      { onConflict: "job" },
    );
  }

  // Nothing written AND nothing refused means the batch produced no answer at
  // all - the shape this repo has shipped as a real incident more than once.
  // A batch that was entirely refused is different: that is the guard working,
  // loudly, and it gets its own signal in the workflow rather than a 500 here.
  const wroteNothing = observation.wroteNothing && summary.refused === 0 && summary.noBars < batch.length;
  const status = writeFailed > 0 || wroteNothing ? 500 : 200;

  await observation.close({
    status: status === 200 ? "ok" : "failed",
    detail: { ...summary, writeFailed, writeErrors, wroteNothing },
    error: writeFailed > 0
      ? `write failed after retries: ${writeErrors.join("; ")}`
      : wroteNothing
        ? "batch computed nothing for any symbol"
        : undefined,
  });

  return new Response(JSON.stringify({ ok: status === 200, ...summary }), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
});

// Ingests Yahoo Finance's quarterly balance sheet and cash flow for the
// tracked universe, then derives ROE, ROCE, current ratio and free cash flow
// by pairing them with the NSE-sourced income statement that
// sync-fundamentals already wrote.
//
// Trigger: GitHub Actions cron, same convention as sync-fundamentals.
// Protected by SYNC_SECRET; writes use the service-role key, matching
// sync-bhavcopy, sync-market-feed, sync-unlisted-quotes and sync-fundamentals.
//
// A bounded batch of symbols runs per invocation with its own cursor in
// sync_cursors (job "fundamentals-yahoo", distinct from "fundamentals" which
// the XBRL sync owns), so the run never approaches the function timeout and
// an interruption costs only the current batch.

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  fetchQuoteSummary,
  toYahooSymbol,
  parseBalanceSheet,
  parseCashflow,
  type BalanceRow,
  type CashflowRow,
} from "../_shared/yahoo.ts";
import { alignPeriods } from "../_shared/period.ts";
import { computeRatios } from "../_shared/ratios.ts";
import { SyncObservation } from "../_shared/observation.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-sync-secret",
};

const JOB = "fundamentals-yahoo";
/**
 * Symbols per invocation. Yahoo returns BOTH statements (balance sheet and
 * cash flow) in one quoteSummary call per symbol, so a symbol costs one HTTP
 * round trip plus two small in-memory parses - far cheaper than the XBRL
 * sync's per-filing document fetch and regex parse, which is why that sync
 * had to drop to 2. Start at 5; if WORKER_RESOURCE_LIMIT ever appears in the
 * run log, lower this rather than anything else - that is exactly the ceiling
 * that killed the XBRL sync's first real run.
 */
const BATCH_SIZE = 5;

type IncomeBasisRow = {
  period_end: string;
  is_consolidated: boolean;
  profit_after_tax: number | null;
  profit_before_tax: number | null;
};

/**
 * Selects one reporting basis per symbol before alignment.
 *
 * fundamentals_income is unique on (symbol, period_end, is_consolidated), so
 * a symbol normally holds TWO rows per period: consolidated and standalone
 * (measured on live data: 95 of 204 rows are duplicate symbol+period_end
 * pairs). fundamentals_derived is unique on (symbol, period_end) - one row
 * only - so passing both bases into alignPeriods would produce two derived
 * rows per period that collide on that key, and whichever write lands last
 * wins arbitrarily.
 *
 * Worse than the key collision: Yahoo's balance sheet and cash flow are
 * always CONSOLIDATED figures. Pairing them with a standalone profit number
 * is a cross-basis mismatch that alignPeriods cannot see on its own - it only
 * checks that period_end lines up, not that the two sides describe the same
 * legal entity. A Return on Equity built from that pairing looks entirely
 * reasonable and is wrong, which on a SEBI-registered broker's page is worse
 * than showing nothing.
 *
 * Consolidated is preferred; standalone is used only when the symbol has no
 * consolidated rows at all. The two bases are never mixed within one symbol.
 * This mirrors selectBasis in src/lib/fundamentals.ts, which is frontend code
 * and unavailable to edge functions, so the filter is reimplemented here,
 * deliberately small.
 */
function selectIncomeBasis(
  rows: IncomeBasisRow[],
): { basis: "consolidated" | "standalone" | "none"; rows: IncomeBasisRow[] } {
  const consolidated = rows.filter((r) => r.is_consolidated);
  if (consolidated.length > 0) return { basis: "consolidated", rows: consolidated };
  const standalone = rows.filter((r) => !r.is_consolidated);
  if (standalone.length > 0) return { basis: "standalone", rows: standalone };
  return { basis: "none", rows: [] };
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

  // Universe comes from screener_stocks, which already holds the tracked symbols.
  const { data: universe, error: uErr } = await supabase
    .from("screener_stocks")
    .select("symbol")
    .order("symbol");
  if (uErr) {
    return new Response(JSON.stringify({ error: uErr.message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const symbols = (universe ?? []).map((r: { symbol: string }) => r.symbol);
  const { data: cursorRow } = await supabase
    .from("sync_cursors").select("cursor").eq("job", JOB).maybeSingle();

  let start = 0;
  if (cursorRow?.cursor) {
    const idx = symbols.indexOf(cursorRow.cursor);
    if (idx === -1) {
      // The stored cursor symbol is no longer in the universe (delisted or
      // renamed out of screener_stocks). Restarting from the top is the
      // deliberate, safe choice, logged so a full extra pass over Yahoo isn't
      // indistinguishable from an ordinary batch boundary.
      console.error(
        `cursor symbol ${cursorRow.cursor} no longer in universe; restarting from the top`,
      );
      start = 0;
    } else {
      start = idx + 1;
    }
  }
  const batch = symbols.slice(Math.max(0, start), Math.max(0, start) + BATCH_SIZE);
  const summary = {
    symbols: batch.length,
    balanceRows: 0,
    cashflowRows: 0,
    derivedRows: 0,
    yahooFailed: 0,
  };
  // Which reporting basis selectIncomeBasis picked per symbol, so a wrong
  // pairing (or an unexpected "none") is diagnosable from the observation row
  // later without re-deriving it from raw table contents.
  const basisBySymbol: Record<string, "consolidated" | "standalone" | "none"> = {};
  // Counts failed writes to fundamentals_balance, fundamentals_cashflow and
  // fundamentals_derived, PLUS failed reads of fundamentals_income - that
  // read sits one hop upstream of the derived write and gates the entire
  // derived-ratio branch, so a read failure there is the same fault class as
  // a write failure with the write simply never reached. Kept outside
  // `summary` so the HTTP response keeps exactly the { ok, symbols,
  // balanceRows, cashflowRows, derivedRows, yahooFailed } shape, but still
  // gates the status code below. Without this, a run where every one of
  // these failed (bad column, an RLS change, a renamed table) still reported
  // {"ok":true} with zero rows written - the same shape as the
  // {"ok":true,"filings":0} defect this repo already shipped once, where
  // `sync_observations.failures` recorded the truth but the status code the
  // workflow actually gates on did not.
  let writeFailed = 0;

  // Opened BEFORE the loop, not after it, so a run killed mid-batch (e.g. by
  // WORKER_RESOURCE_LIMIT) still leaves a visible trace: an unclosed row with
  // status='running' rather than no row at all.
  const observation = new SyncObservation(supabase, JOB);
  await observation.open({
    batch,
    cursorStart: start,
    universeSize: symbols.length,
    batchSize: BATCH_SIZE,
  });

  for (const symbol of batch) {
    const yahooSymbol = toYahooSymbol(symbol);

    let json: unknown | null = null;
    let balance: BalanceRow[] = [];
    let cashflow: CashflowRow[] = [];
    // Recorded separately from the fetch failure below: a fetch failure means
    // Yahoo (or the crumb flow) refused us, while a parse failure means Yahoo
    // answered fine and OUR code broke on the payload. Collapsing the two
    // under one "yahoo" label would misdirect on-call straight at Yahoo for a
    // fault that is actually a parser regression - the label would be wrong
    // even though the containment (skip this symbol, keep the batch going)
    // is identical either way.
    let parseFailed = false;
    try {
      json = await fetchQuoteSummary(
        yahooSymbol,
        "balanceSheetHistoryQuarterly,cashflowStatementHistoryQuarterly",
      );
    } catch (err) {
      console.error(`yahoo fetch failed for ${symbol}:`, (err as Error).message);
      json = null;
    }

    if (json !== null) {
      // Parsing gets its OWN try/catch, not folded into the fetch's. It used
      // to sit outside any try/catch at all: an unexpected throw from a
      // malformed payload would then escape the per-symbol boundary entirely
      // and abort the rest of the batch, rather than costing only this
      // symbol the way a fetch failure does.
      try {
        balance = parseBalanceSheet(json);
        cashflow = parseCashflow(json);
      } catch (err) {
        console.error(`yahoo parse failed for ${symbol}:`, (err as Error).message);
        parseFailed = true;
        json = null;
      }
    }

    if (json === null) {
      // A Yahoo failure for one symbol must not abort the batch - counted so
      // it is visible in the response and the observation row, not just in
      // logs the workflow never reads.
      summary.yahooFailed++;
      observation.recordFailure(parseFailed ? "parse" : "yahoo", 1);
      await advanceCursor(symbol);
      continue;
    }

    if (balance.length > 0) {
      const { error: balErr } = await supabase.from("fundamentals_balance").upsert(
        balance.map((b) => ({
          symbol,
          period_end: b.periodEnd,
          total_assets: b.totalAssets,
          total_debt: b.totalDebt,
          total_equity: b.totalEquity,
          cash_and_equivalents: b.cashAndEquivalents,
          current_assets: b.currentAssets,
          current_liabilities: b.currentLiabilities,
          source: "yahoo",
          fetched_at: new Date().toISOString(),
        })),
        { onConflict: "symbol,period_end" },
      );
      // postgrest-js RESOLVES with an error rather than throwing, so a bare
      // try/catch around this call would never see it - the exact pattern
      // that silently killed the corporate_actions writes for two commits and
      // a deploy elsewhere in this repo. Checked explicitly here instead.
      if (balErr) {
        console.error(`balance upsert failed for ${symbol}:`, balErr.message);
        observation.recordFailure("fundamentals_balance", 1);
        writeFailed++;
      } else {
        summary.balanceRows += balance.length;
        observation.recordWrite("fundamentals_balance", balance.length);
      }
    }

    if (cashflow.length > 0) {
      const { error: cfErr } = await supabase.from("fundamentals_cashflow").upsert(
        cashflow.map((c) => ({
          symbol,
          period_end: c.periodEnd,
          operating_cf: c.operatingCf,
          investing_cf: c.investingCf,
          financing_cf: c.financingCf,
          capex: c.capex,
          free_cash_flow: c.freeCashFlow,
          source: "yahoo",
          fetched_at: new Date().toISOString(),
        })),
        { onConflict: "symbol,period_end" },
      );
      if (cfErr) {
        console.error(`cashflow upsert failed for ${symbol}:`, cfErr.message);
        observation.recordFailure("fundamentals_cashflow", 1);
        writeFailed++;
      } else {
        summary.cashflowRows += cashflow.length;
        observation.recordWrite("fundamentals_cashflow", cashflow.length);
      }
    }

    // Derived ratios depend on this symbol's income statement, which comes
    // from the separate NSE XBRL sync (sync-fundamentals) - read fresh here
    // rather than assumed, since that sync runs on its own schedule.
    const { data: incomeRows, error: incErr } = await supabase
      .from("fundamentals_income")
      .select("period_end, is_consolidated, profit_after_tax, profit_before_tax")
      .eq("symbol", symbol);

    if (incErr) {
      console.error(`income read failed for ${symbol}:`, incErr.message);
      observation.recordFailure("fundamentals_income_read", 1);
      // Folded into the same gate as the write failures below. This read sits
      // directly upstream of the fundamentals_derived write: on failure,
      // selectIncomeBasis/alignPeriods/computeRatios and the derived upsert
      // never run for this symbol at all, so there is never an upsert here to
      // fail. A run where this read fails for every symbol (RLS change,
      // dropped column, renamed table - the exact fault classes the gate
      // exists for) would otherwise leave blockedOut false (Yahoo succeeded)
      // and writeFailed at 0 (nothing was ever attempted), returning
      // {"ok":true,"derivedRows":0} - the same defect one hop upstream of a
      // write instead of at one.
      writeFailed++;
    } else {
      const { basis, rows: basisRows } = selectIncomeBasis(
        (incomeRows ?? []) as IncomeBasisRow[],
      );
      basisBySymbol[symbol] = basis;

      if (basisRows.length > 0) {
        // Reuse the statements just parsed from Yahoo rather than re-reading
        // fundamentals_balance/fundamentals_cashflow back from the database -
        // they already carry this symbol's full quarterly history and are
        // exactly what was (or would have been) written above.
        const balanceLike = balance.map((b) => ({
          period_end: b.periodEnd,
          total_equity: b.totalEquity,
          total_debt: b.totalDebt,
          current_assets: b.currentAssets,
          current_liabilities: b.currentLiabilities,
        }));
        const cashflowLike = cashflow.map((c) => ({
          period_end: c.periodEnd,
          operating_cf: c.operatingCf,
          capex: c.capex,
        }));

        // alignPeriods matches on exact period_end across all three sources;
        // a period that does not line up yields no derived row rather than a
        // guessed one.
        const aligned = alignPeriods(basisRows, balanceLike, cashflowLike);

        if (aligned.length > 0) {
          const derivedRows = aligned.map(({ periodEnd, input }) => {
            const result = computeRatios(input);
            return {
              symbol,
              period_end: periodEnd,
              roe: result.roe,
              roce: result.roce,
              current_ratio: result.currentRatio,
              free_cash_flow: result.freeCashFlow,
              inputs_complete: result.inputsComplete,
              missing_inputs: result.missingInputs,
              unusable_inputs: result.unusableInputs,
              computed_at: new Date().toISOString(),
            };
          });

          const { error: derErr } = await supabase
            .from("fundamentals_derived")
            .upsert(derivedRows, { onConflict: "symbol,period_end" });

          if (derErr) {
            console.error(`derived upsert failed for ${symbol}:`, derErr.message);
            observation.recordFailure("fundamentals_derived", 1);
            writeFailed++;
          } else {
            summary.derivedRows += derivedRows.length;
            observation.recordWrite("fundamentals_derived", derivedRows.length);
          }
        }
      }
    }

    await advanceCursor(symbol);
  }

  // Cursor advances after EVERY symbol, not once after the loop. Written at
  // the foot of the loop it would simply never be reached whenever a batch
  // ran long, so the next run would restart on the same symbols and the
  // universe would never advance. Per-symbol, an interrupted run still banks
  // the progress it made.
  async function advanceCursor(symbol: string): Promise<void> {
    const isLastSymbol = symbol === batch[batch.length - 1];
    const { error: curErr } = await supabase.from("sync_cursors").upsert({
      job: JOB,
      // Null restarts the universe once the end is reached.
      cursor: isLastSymbol && start + BATCH_SIZE >= symbols.length ? null : symbol,
      updated_at: new Date().toISOString(),
    }, { onConflict: "job" });
    // Unchecked, a failing cursor write is indistinguishable from success and
    // the same batch would repeat every run forever.
    if (curErr) {
      console.error(`cursor upsert failed at ${symbol}:`, curErr.message);
      observation.recordFailure("cursor", 1);
    } else {
      observation.recordWrite("sync_cursors");
    }
  }

  // Every symbol in the batch failing its Yahoo call is not a partial - it is
  // Yahoo refusing us outright (or the crumb flow breaking), and it must be
  // able to turn the build red on its own, exactly as blockedOut works for
  // the XBRL sync's registry calls. A partial (some symbols blocked, others
  // fine) stays green on this condition alone.
  const blockedOut = summary.symbols > 0 && summary.yahooFailed === summary.symbols;
  // A database write (or the fundamentals_income read that gates the derived
  // write) failing is a DIFFERENT fault from Yahoo refusing a symbol, and
  // blockedOut alone cannot see it: a run where every one of those failed
  // (bad column, an RLS change, a renamed table) had every Yahoo call
  // succeed, so yahooFailed stays 0 and blockedOut stays false. Without this
  // check that run returns {"ok":true} having written nothing - the same
  // shape as the {"ok":true,"filings":0} defect this repo already shipped
  // once. sync_observations.failures records the truth either way, but that
  // table isn't what gates the GitHub Actions workflow; the status code is.
  // Mirrors the sibling XBRL sync's `summary.failed > 0 || blockedOut` gate.
  const anyWriteFailed = writeFailed > 0;
  const status = blockedOut || anyWriteFailed ? 500 : 200;

  await observation.close({
    status: status === 200 ? "ok" : "failed",
    detail: {
      ...summary,
      blockedOut,
      writeFailed,
      basisBySymbol,
      wroteNothing: observation.wroteNothing,
    },
    error: blockedOut
      ? `every symbol in the batch failed its Yahoo call (${summary.yahooFailed}/${summary.symbols})`
      : anyWriteFailed
        ? `${writeFailed} write(s)/read(s) failed across fundamentals_balance/` +
          `fundamentals_cashflow/fundamentals_income/fundamentals_derived`
        : undefined,
  });

  return new Response(
    JSON.stringify({ ok: !blockedOut && !anyWriteFailed, ...summary }),
    {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    },
  );
});

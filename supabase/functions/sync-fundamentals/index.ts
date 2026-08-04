// Ingests NSE quarterly filings into fundamentals_filings, parses each one's
// XBRL, and writes the income statement.
//
// Trigger: GitHub Actions cron (.github/workflows/fundamentals-sync.yml).
// Protected by SYNC_SECRET; writes use the service-role key, matching
// sync-bhavcopy, sync-market-feed and sync-unlisted-quotes.
//
// A bounded batch of symbols runs per invocation with a cursor in sync_cursors,
// so the run never approaches the function timeout and an interruption costs
// only the current batch.

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  fetchFilingRegistry,
  fetchXbrl,
  NSE_DELAY_MS,
  sleep,
} from "../_shared/nse.ts";
import { parseIncomeStatement } from "../_shared/xbrl.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-sync-secret",
};

const JOB = "fundamentals";
/** Symbols per invocation. Small enough that a run finishes well inside the timeout. */
const BATCH_SIZE = 5;

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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
      // deliberate, safe choice - but it costs a full extra pass over NSE's
      // public endpoints, so it must show up in the logs rather than being
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
  const summary = { symbols: batch.length, filings: 0, parsed: 0, failed: 0 };

  for (const symbol of batch) {
    let registry;
    try {
      registry = await fetchFilingRegistry(symbol);
    } catch (err) {
      // 4xx halts this symbol only; the batch continues.
      console.error(`registry failed for ${symbol}:`, (err as Error).message);
      continue;
    }
    await sleep(NSE_DELAY_MS);

    for (const f of registry) {
      const { data: existing } = await supabase
        .from("fundamentals_filings")
        .select("id, content_hash, parse_status")
        .eq("symbol", f.symbol)
        .eq("from_date", f.fromDate)
        .eq("to_date", f.toDate)
        .eq("is_consolidated", f.isConsolidated)
        .maybeSingle();

      let xml: string;
      try {
        xml = await fetchXbrl(f.xbrlUrl);
      } catch (err) {
        console.error(`xbrl failed for ${f.symbol} ${f.toDate}:`, (err as Error).message);
        continue;
      }
      await sleep(NSE_DELAY_MS);

      const hash = await sha256(xml);
      // Unchanged and already parsed: nothing to do. A restatement changes the
      // hash and falls through to be reprocessed.
      if (existing?.content_hash === hash && existing?.parse_status === "parsed") continue;

      const statement = parseIncomeStatement(xml);

      // fundamentals_income.filing_id references fundamentals_filings.id, so the
      // filing row has to exist (and therefore be upserted) before the income
      // write can happen - the two writes cannot be reordered outright. What CAN
      // be controlled is when the row is allowed to read "parsed": that flip is
      // deferred to a second, later write that only happens once the income
      // upsert has actually succeeded. Until then the row carries a non-terminal
      // status, so a crash or a failed income write leaves content_hash paired
      // with something other than "parsed" - the skip check at the top of this
      // loop will not treat it as done, and the next run retries it instead of
      // silently losing the row forever.
      const { data: filingRow, error: fErr } = await supabase
        .from("fundamentals_filings")
        .upsert({
          symbol: f.symbol,
          period: f.period,
          from_date: f.fromDate,
          to_date: f.toDate,
          is_consolidated: f.isConsolidated,
          is_audited: f.isAudited,
          xbrl_url: f.xbrlUrl,
          filing_date: f.filingDate,
          content_hash: hash,
          parse_status: statement ? "pending" : "failed",
          parse_error: statement ? null : "no OneD headline context",
          fetched_at: new Date().toISOString(),
        }, { onConflict: "symbol,from_date,to_date,is_consolidated" })
        .select("id")
        .single();

      if (fErr) { console.error("filing upsert:", fErr.message); continue; }
      summary.filings++;

      if (!statement) { summary.failed++; continue; }

      const { error: iErr } = await supabase.from("fundamentals_income").upsert({
        symbol: f.symbol,
        // The registry's toDate is authoritative; the document's period is not.
        period_end: f.toDate,
        is_consolidated: f.isConsolidated,
        revenue: statement.revenue,
        other_income: statement.otherIncome,
        total_income: statement.totalIncome,
        total_expenses: statement.totalExpenses,
        profit_before_tax: statement.profitBeforeTax,
        profit_after_tax: statement.profitAfterTax,
        basic_eps: statement.basicEps,
        diluted_eps: statement.dilutedEps,
        debt_equity_ratio: statement.debtEquityRatio,
        debt_service_coverage_ratio: statement.debtServiceCoverageRatio,
        filing_id: filingRow.id,
        source: "nse_xbrl",
        fetched_at: new Date().toISOString(),
      }, { onConflict: "symbol,period_end,is_consolidated" });

      if (iErr) {
        // The filing must not be left in "pending" silently - "pending" already
        // guarantees a retry, but the failure needs to be visible in the
        // response, not just in logs, matching the summary contract for every
        // other failure path in this run.
        console.error("income upsert:", iErr.message);
        summary.failed++;
        const { error: markErr } = await supabase
          .from("fundamentals_filings")
          .update({
            parse_status: "failed",
            parse_error: `income upsert failed: ${iErr.message}`,
          })
          .eq("id", filingRow.id);
        if (markErr) {
          console.error("filing status update after income failure:", markErr.message);
        }
        continue;
      }

      const { error: markParsedErr } = await supabase
        .from("fundamentals_filings")
        .update({ parse_status: "parsed" })
        .eq("id", filingRow.id);
      // The income row is correct either way; only the status flag would lag
      // behind. A lagging "pending" simply causes a harmless, idempotent
      // reprocess next run (the income upsert overwrites with identical
      // values), so this is not counted as a failure - but it is logged so a
      // recurring pattern here is not invisible.
      if (markParsedErr) {
        console.error("filing status update to parsed:", markParsedErr.message);
      }
      summary.parsed++;
    }
  }

  const next = batch.length ? batch[batch.length - 1] : null;
  await supabase.from("sync_cursors").upsert({
    job: JOB,
    // Null restarts the universe on the next run once the end is reached.
    cursor: start + BATCH_SIZE >= symbols.length ? null : next,
    updated_at: new Date().toISOString(),
  }, { onConflict: "job" });

  return new Response(JSON.stringify({ ok: true, ...summary }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});

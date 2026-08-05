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
  fetchCorporateActions,
  NSE_DELAY_MS,
  sleep,
  type FilingRecord,
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
/**
 * Failed parses of one filing after which the sync stops fetching it. A filing
 * that has failed this many times is not going to start parsing because we
 * asked NSE for the same bytes once more; it needs a person to look at
 * parse_error. The counter resets to 0 the moment the filing parses and its
 * income row is written.
 */
const MAX_PARSE_ATTEMPTS = 5;
/**
 * Most-recent filings considered per symbol, newest first.
 *
 * This bound is load-bearing, not tidiness. The NSE registry is not a recent
 * window - it is the company's whole history: 130 filings for RELIANCE (84
 * standalone + 46 consolidated, 2005-2024). Unbounded, one symbol alone costs
 * ~130 x (1.2s pacing + fetch) ≈ 300s, so a 5-symbol batch could never finish
 * inside the 300s the workflow allows, the cursor at the foot of the loop was
 * never reached, and every hourly run re-walked the same symbols forever -
 * thousands of requests a day to the exchange's own endpoint for zero progress.
 *
 * 12 covers roughly the last six quarters across both bases, which is what an
 * hourly incremental sync is for. Historical backfill is a separate, deliberate,
 * one-off job and must not ride on the cron. Worst case now ≈ 12 x 2.3s + two
 * paced calls ≈ 30s per symbol, ≈ 150s for a full batch of 5, and far less in
 * steady state because already-parsed filings are skipped before the download.
 */
const MAX_FILINGS_PER_SYMBOL = 12;

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
  const summary = { symbols: batch.length, filings: 0, parsed: 0, failed: 0, skipped: 0 };

  for (const symbol of batch) {
    // A registry failure must not take this symbol's corporate actions down with
    // it. The two come from different NSE endpoints
    // (corporates-financial-results vs corporates-corporateActions), and one
    // being unavailable says nothing about the other - so the failure is
    // expressed as "no filings to iterate" rather than as a `continue`, and the
    // corporate-actions block at the bottom of the loop body still runs.
    let registry: FilingRecord[] = [];
    try {
      registry = await fetchFilingRegistry(symbol);
    } catch (err) {
      // 4xx halts this symbol's filings only; the batch continues.
      console.error(`registry failed for ${symbol}:`, (err as Error).message);
    }
    // Paced whether or not the call succeeded: a failed request still consumed
    // an NSE request, so the delay before the next one stands. This is the only
    // delay between the registry call and whichever NSE call comes next (the
    // first fetchXbrl, or fetchCorporateActions when there are no filings).
    await sleep(NSE_DELAY_MS);

    // Newest first, then bounded. Sorting before slicing matters: NSE's ordering
    // is not guaranteed, and slicing an arbitrary order would pin us to whichever
    // 12 filings happened to come back first - possibly all from 2007.
    const recent = [...registry]
      .sort((a, b) => b.toDate.localeCompare(a.toDate))
      .slice(0, MAX_FILINGS_PER_SYMBOL);

    for (const f of recent) {
      const { data: existing, error: readErr } = await supabase
        .from("fundamentals_filings")
        .select("id, content_hash, parse_status, parse_attempts, xbrl_url, filing_date")
        .eq("symbol", f.symbol)
        .eq("from_date", f.fromDate)
        .eq("to_date", f.toDate)
        .eq("is_consolidated", f.isConsolidated)
        .maybeSingle();

      // This error used to be discarded, which was worse than it looks: a failed
      // read yields `existing === undefined`, so attempts reads 0, the cap below
      // is bypassed, and the upsert then overwrites a stored count of 4 with 1.
      // The counter silently stopped being monotonic and the bound stopped being
      // a bound. Skipping the filing costs one cycle; corrupting the counter
      // costs the cap.
      if (readErr) {
        console.error(`filing lookup failed for ${f.symbol} ${f.toDate}:`, readErr.message);
        continue;
      }

      const attempts: number = existing?.parse_attempts ?? 0;

      // Skip BEFORE the download when the registry itself says nothing changed.
      //
      // The content hash is the authoritative check, but it cannot be computed
      // without first spending the download - which is the entire cost being
      // managed here. So this cheaper gate runs first: if we already parsed this
      // filing successfully and the registry still reports the same document URL
      // and filing date, there is nothing new to fetch. A restatement changes the
      // filing date (and in practice the URL), so it still comes through and is
      // re-hashed.
      //
      // Trade-off stated plainly: this trusts registry metadata rather than
      // bytes, which is weaker than a hash. It is the only signal available
      // before paying for the document, and the hash still gates everything that
      // does get downloaded.
      //
      // Safe against the data-loss bug a prior review found here, because it
      // requires parse_status === 'parsed', and 'parsed' is only ever written
      // after an income row is proven written. A filing whose income write failed
      // carries 'pending' or 'failed', so it can never be skipped by this gate.
      if (
        existing?.parse_status === "parsed" &&
        existing.xbrl_url === f.xbrlUrl &&
        existing.filing_date === f.filingDate
      ) {
        continue;
      }

      // The cap is checked HERE, before fetchXbrl, because the fetch is the cost
      // being bounded - skipping after the download would save nothing. Without
      // it a filing whose XBRL cannot be parsed is re-downloaded from NSE on
      // every single run, forever: it carries parse_status 'failed', so the
      // "unchanged and already parsed" check below never matches it.
      //
      // The trade-off, stated plainly: because we skip before the fetch we never
      // see the bytes, so we cannot notice that a permanently-broken filing has
      // been restated into something parseable - a capped filing stays capped
      // until a person intervenes. That is the deliberate choice. parse_error is
      // in the table precisely so there is something to act on, and
      // docs/fundamentals-validation.md treats any failed row as a gate blocker,
      // so a capped filing is meant to be looked at rather than retried in
      // perpetuity against the exchange's own public endpoint.
      if (existing?.parse_status === "failed" && attempts >= MAX_PARSE_ATTEMPTS) {
        console.error(
          `skipping ${f.symbol} ${f.toDate}: ${attempts} failed parse attempts, ` +
            `see fundamentals_filings.parse_error`,
        );
        summary.skipped++;
        continue;
      }

      let xml: string | null = null;
      try {
        xml = await fetchXbrl(f.xbrlUrl);
      } catch (err) {
        console.error(`xbrl failed for ${f.symbol} ${f.toDate}:`, (err as Error).message);
      }
      // Paced whether or not the fetch succeeded, and the failure path is the one
      // that actually needs it: nseGet throws immediately on any 4xx with no
      // delay of its own, so a symbol whose document URLs 403 would otherwise
      // fire a dozen back-to-back requests at precisely the moment NSE is telling
      // us to stop. The `continue` used to sit above this line and skip it.
      await sleep(NSE_DELAY_MS);
      if (xml === null) continue;

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
          // Counted on the failure path only. While the filing is 'pending' the
          // attempt is still in flight and the previous count stands - and
          // 'pending' is never skipped by the cap above, so an unfinished attempt
          // can never strand a filing whose income row has not been written.
          // The reset to 0 belongs with the proven write, not with this one.
          parse_attempts: statement ? attempts : attempts + 1,
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
            // Deliberately does NOT increment parse_attempts. The cap exists
            // because asking NSE for the same bytes again will not make
            // unparseable XBRL parse - reasoning that simply does not hold for a
            // database write error, which is exactly the kind that succeeds on
            // retry. Counting these would let five transient write failures cap a
            // filing permanently, leaving it 'failed' with NO income row and then
            // skipped before the fetch: the precise data-loss shape a prior
            // review flagged here. It stays visible instead via summary.failed,
            // which now drives a non-200, and via this parse_error text, which
            // distinguishes a write failure from a parse failure at a glance.
          })
          .eq("id", filingRow.id);
        if (markErr) {
          console.error("filing status update after income failure:", markErr.message);
        }
        continue;
      }

      // The income row is now proven, so this is the one place entitled to clear
      // the attempt counter: a restatement that finally parses must not stay
      // tainted by the broken version's failures.
      const { error: markParsedErr } = await supabase
        .from("fundamentals_filings")
        .update({ parse_status: "parsed", parse_attempts: 0 })
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

    try {
      const actions = await fetchCorporateActions(symbol);
      if (actions.length) {
        // Dedupe by the conflict key before sending. NSE returns per-series rows
        // (EQ, BE) that can carry the same ex-date and subject, and two identical
        // key tuples in a single INSERT make Postgres reject the WHOLE statement
        // with "ON CONFLICT DO UPDATE command cannot affect row a second time" -
        // losing every action for the symbol, not just the duplicate.
        const deduped = new Map<string, Record<string, unknown>>();
        for (const a of actions) {
          deduped.set(`${a.symbol}|${a.exDate}|${a.actionType}|${a.description}`, {
            symbol: a.symbol,
            ex_date: a.exDate,
            record_date: a.recordDate,
            action_type: a.actionType,
            value: a.value,
            description: a.description,
            source: "nse",
            fetched_at: new Date().toISOString(),
          });
        }

        // fundamentals_corporate_actions, NOT corporate_actions. That name was
        // already taken by 20260709000000_market_feed.sql with an entirely
        // different shape (company/details, both NOT NULL), so this table's own
        // `create table if not exists` was a silent no-op and the intended table
        // never existed - every write here failed with 42703 while the function
        // still returned 200, because the error below was not being read. Merging
        // into the market-feed table instead would be worse: sync-market-feed
        // runs a daily delete of past ex-dates and would purge all history.
        const { error: caErr } = await supabase
          .from("fundamentals_corporate_actions")
          .upsert(Array.from(deduped.values()), {
            onConflict: "symbol,ex_date,action_type,description",
          });
        // postgrest-js RESOLVES with an error rather than throwing, so the
        // enclosing try/catch never sees this. Unread, it hid a completely dead
        // write path through two commits and a deploy.
        if (caErr) {
          console.error(`corporate actions upsert failed for ${symbol}:`, caErr.message);
          summary.failed++;
        }
      }
    } catch (err) {
      console.error(`corporate actions failed for ${symbol}:`, (err as Error).message);
    }
    await sleep(NSE_DELAY_MS);

    // Cursor advances after EVERY symbol, not once after the loop. Written at the
    // foot of the loop it was simply never reached whenever a batch ran long, so
    // the next run restarted on the same symbols and the universe never advanced.
    // Per-symbol, an interrupted run still banks the progress it made.
    const isLastSymbol = symbol === batch[batch.length - 1];
    const { error: curErr } = await supabase.from("sync_cursors").upsert({
      job: JOB,
      // Null restarts the universe once the end is reached.
      cursor: isLastSymbol && start + BATCH_SIZE >= symbols.length ? null : symbol,
      updated_at: new Date().toISOString(),
    }, { onConflict: "job" });
    // Unchecked, a failing cursor write is indistinguishable from success and the
    // same batch repeats hourly forever.
    if (curErr) console.error(`cursor upsert failed at ${symbol}:`, curErr.message);
  }

  // The cursor is written per symbol inside the loop above, so there is no
  // end-of-run write here. A duplicate one would undo the incremental progress
  // whenever the loop exited early.

  // A real failure must be able to turn the build red. Previously this always
  // returned 200 regardless of summary.failed, so the hourly workflow - which
  // gates purely on the status code - could not distinguish a clean run from one
  // where every filing failed to parse. This follows the three-way contract the
  // sibling unlisted-quotes sync already uses: genuine failures are a 500,
  // while `skipped` is informational (a filing at its attempt cap is a known,
  // deliberate state, not a new fault) and is annotated by the workflow rather
  // than failing it.
  const status = summary.failed > 0 ? 500 : 200;
  return new Response(JSON.stringify({ ok: summary.failed === 0, ...summary }), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
});

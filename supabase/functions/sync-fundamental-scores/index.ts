// Scores the tracked universe on the fundamentals already collected - Piotroski
// plus the balance-sheet quality ratios - and writes them to
// stock_fundamental_scores.
//
// Trigger: GitHub Actions cron, daily. Nothing external is fetched; every input
// is already in this database, so the cadence only needs to be often enough to
// pick up newly filed results.
//
// THE REPORTING BASIS IS THE TRAP HERE. fundamentals_income holds a
// consolidated AND a standalone row for most symbol/period pairs, and mixing
// them pairs one set of books' profit with another's balance sheet. Every read
// below goes through oneReportingBasis before anything is computed.

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  cagr,
  oneReportingBasis,
  piotroskiScore,
  qualityMetrics,
  type BalancePeriod,
  type CashflowPeriod,
  type IncomePeriod,
} from "../_shared/fundamental-scores.ts";
import { SyncObservation } from "../_shared/observation.ts";
import { upsertWithRetry } from "../_shared/db-retry.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-sync-secret",
};

const JOB = "fundamental-scores";

/** Symbols per invocation. Three indexed reads each, all small. */
const BATCH_SIZE = 50;
const CONCURRENCY = 8;

/** Annual periods to read back. Four of them is three years of CAGR. */
const PERIODS = 8;

/** Supabase kills an edge function at 150s; stop starting new work before that. */
const TIME_BUDGET_MS = 110_000;

type SupabaseClient = ReturnType<typeof createClient>;
type IncomeRow = IncomePeriod & { is_consolidated?: boolean | null };
type UniverseRow = { symbol: string; market_cap: number | null; pe: number | null };

type SymbolData = {
  income: IncomeRow[];
  basis: "consolidated" | "standalone";
  balance: BalancePeriod[];
  cashflow: CashflowPeriod[];
};

async function readSymbol(supabase: SupabaseClient, symbol: string): Promise<SymbolData> {
  const [income, balance, cashflow] = await Promise.all([
    supabase
      .from("fundamentals_income")
      .select("period_end, is_consolidated, revenue, total_income, total_expenses, profit_after_tax")
      .eq("symbol", symbol)
      .order("period_end", { ascending: false })
      // Twice the limit, because roughly half the rows are the other reporting
      // basis and the collapse below discards them.
      .limit(PERIODS * 2),
    supabase
      .from("fundamentals_balance")
      .select("period_end, total_assets, total_debt, total_equity, cash_and_equivalents, current_assets, current_liabilities")
      .eq("symbol", symbol)
      .order("period_end", { ascending: false })
      .limit(PERIODS),
    supabase
      .from("fundamentals_cashflow")
      .select("period_end, operating_cf, capex, free_cash_flow")
      .eq("symbol", symbol)
      .order("period_end", { ascending: false })
      .limit(PERIODS),
  ]);

  const raw = (income.data ?? []) as IncomeRow[];
  return {
    income: oneReportingBasis(raw),
    basis: raw.some((row) => row.is_consolidated === true) ? "consolidated" : "standalone",
    balance: (balance.data ?? []) as BalancePeriod[],
    cashflow: (cashflow.data ?? []) as CashflowPeriod[],
  };
}

/**
 * Year-on-year profit growth for the PEG denominator, from the same two
 * periods Piotroski compares. Null on a non-positive base: a company moving out
 * of a loss has no growth rate, and the division would produce a confident
 * number from a negative denominator.
 */
function profitGrowth(income: IncomePeriod[]): number | null {
  if (income.length < 2) return null;
  const now = income[0].profit_after_tax;
  const then = income[1].profit_after_tax;
  if (typeof now !== "number" || typeof then !== "number" || !(then > 0)) return null;
  return ((now - then) / then) * 100;
}

/** Oldest-first values of one line item, for CAGR. */
const chronological = (income: IncomePeriod[], pick: (period: IncomePeriod) => number | null | undefined) =>
  [...income].reverse().map(pick).filter((value): value is number => typeof value === "number" && Number.isFinite(value));

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
    .select("symbol, market_cap, pe")
    .order("symbol");
  if (universeError) {
    return new Response(JSON.stringify({ error: universeError.message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const universeRows = (universe ?? []) as UniverseRow[];
  const symbols = universeRows.map((row) => row.symbol);
  const marketBySymbol = new Map(universeRows.map((row) => [row.symbol, row]));

  const { data: cursorRow } = await supabase
    .from("sync_cursors").select("cursor").eq("job", JOB).maybeSingle();

  let start = 0;
  if (cursorRow?.cursor) {
    const index = symbols.indexOf(cursorRow.cursor as string);
    if (index === -1) console.error(`cursor symbol ${cursorRow.cursor} no longer in universe; restarting`);
    else start = index + 1;
  }
  const batch = symbols.slice(start, start + BATCH_SIZE);
  const wrapped = start + batch.length >= symbols.length;

  const summary = {
    symbols: batch.length,
    scored: 0,
    /**
     * Symbols with fewer than two comparable periods, or too few criteria to
     * test. Thin fundamentals coverage, not a fault - most of the universe's
     * smaller names sit here until a second annual filing lands.
     */
    tooThin: 0,
    wrapped,
    budgetExhausted: false,
  };
  let writeFailed = 0;
  const writeErrors: string[] = [];

  const observation = new SyncObservation(supabase, JOB);
  await observation.open({ batch, cursorStart: start, universeSize: symbols.length });

  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < batch.length; i += CONCURRENCY) {
    if (Date.now() - started > TIME_BUDGET_MS) {
      summary.budgetExhausted = true;
      break;
    }
    const slice = batch.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      slice.map(async (symbol) => ({ symbol, data: await readSymbol(supabase, symbol) })),
    );

    for (const { symbol, data } of results) {
      const piotroski = piotroskiScore(data.income, data.balance, data.cashflow);
      if (piotroski === null || data.income.length === 0) {
        summary.tooThin++;
        continue;
      }

      const market = marketBySymbol.get(symbol);
      const metrics = qualityMetrics(data.income, data.balance, data.cashflow, {
        market_cap: market?.market_cap ?? null,
        pe: market?.pe ?? null,
        profit_growth_yoy_pct: profitGrowth(data.income),
      });

      // CAGR over however many periods are actually present, not an assumed
      // four: a symbol with three filings has a two-year CAGR, and calling it
      // three-year would overstate the base.
      const revenues = chronological(data.income, (period) => period.revenue);
      const profits = chronological(data.income, (period) => period.profit_after_tax);

      rows.push({
        symbol,
        period_end: data.income[0].period_end,
        basis: data.basis,
        piotroski_score: piotroski.score,
        piotroski_testable: piotroski.testable,
        piotroski_criteria: piotroski.criteria,
        ...metrics,
        revenue_cagr_3y: cagr(revenues, Math.max(1, revenues.length - 1)),
        profit_cagr_3y: cagr(profits, Math.max(1, profits.length - 1)),
      });
    }
  }

  if (rows.length > 0) {
    const failure = await upsertWithRetry(
      () => supabase.from("stock_fundamental_scores").upsert(rows, { onConflict: "symbol,period_end" }),
      "stock_fundamental_scores",
    );
    if (failure) {
      writeFailed++;
      writeErrors.push(failure);
      observation.recordFailure("stock_fundamental_scores", 1);
    } else {
      summary.scored = rows.length;
      observation.recordWrite("stock_fundamental_scores", rows.length);
    }
  }

  const attempted = summary.scored + summary.tooThin;
  if (attempted > 0 && writeFailed === 0) {
    await supabase.from("sync_cursors").upsert(
      {
        job: JOB,
        cursor: wrapped && attempted >= batch.length ? null : batch[attempted - 1],
        updated_at: new Date().toISOString(),
      },
      { onConflict: "job" },
    );
  }

  // A batch where EVERY symbol was too thin is the drift signature here: the
  // fundamentals tables filling up but the score reading none of them, which
  // is what a renamed column or a basis change would look like. Thin coverage
  // on a few symbols is normal and is not this.
  const scoredNothing = summary.scored === 0 && summary.tooThin === batch.length && batch.length > 0;
  const status = writeFailed > 0 ? 500 : 200;

  await observation.close({
    status: status === 200 ? "ok" : "failed",
    detail: { ...summary, writeFailed, writeErrors, scoredNothing },
    error: writeFailed > 0 ? `write failed after retries: ${writeErrors.join("; ")}` : undefined,
  });

  return new Response(JSON.stringify({ ok: status === 200, ...summary, scoredNothing }), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
});

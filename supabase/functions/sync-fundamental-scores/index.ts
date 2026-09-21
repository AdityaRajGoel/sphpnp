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
  alignPeriods,
  cagrOverPeriods,
  oneReportingBasis,
  piotroskiScore,
  qualityMetrics,
  trailingYear,
  yearEarlier,
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
type CashflowRow = CashflowPeriod & { period_type?: "3M" | "12M" | null };

const hasCashFigures = (row: CashflowRow) =>
  [row.operating_cf, row.capex, row.free_cash_flow].some((value) => typeof value === "number" && Number.isFinite(value));
type UniverseRow = { symbol: string; market_cap: number | null; pe: number | null };

type SymbolData = {
  income: IncomeRow[];
  basis: "consolidated" | "standalone";
  balance: BalancePeriod[];
  cashflow: CashflowRow[];
};

async function readSymbol(supabase: SupabaseClient, symbol: string): Promise<SymbolData> {
  const [income, balance, cashflow] = await Promise.all([
    supabase
      .from("fundamentals_income")
      .select("period_end, is_consolidated, source, revenue, total_income, total_expenses, profit_after_tax")
      .eq("symbol", symbol)
      .order("period_end", { ascending: false })
      // Twice the limit, because roughly half the rows are the other reporting
      // basis and the collapse below discards them.
      // Three times: each basis, and a vendor copy of the same quarter (source ranked in oneReportingBasis).
      .limit(PERIODS * 3),
    supabase
      .from("fundamentals_balance")
      .select("period_end, total_assets, total_debt, total_equity, cash_and_equivalents, current_assets, current_liabilities")
      .eq("symbol", symbol)
      .order("period_end", { ascending: false })
      .limit(PERIODS),
    supabase
      .from("fundamentals_cashflow")
      .select("period_end, period_type, operating_cf, capex, free_cash_flow")
      .eq("symbol", symbol)
      .order("period_end", { ascending: false })
      // Both lengths share dates, so twice the limit keeps PERIODS of each.
      .limit(PERIODS * 2),
  ]);

  const raw = (income.data ?? []) as IncomeRow[];
  return {
    income: oneReportingBasis(raw),
    basis: raw.some((row) => row.is_consolidated === true) ? "consolidated" : "standalone",
    balance: (balance.data ?? []) as BalancePeriod[],
    cashflow: (cashflow.data ?? []) as CashflowRow[],
  };
}

/**
 * Year-on-year profit growth for the PEG denominator, from the same two aligned
 * periods Piotroski compares. Null on a non-positive base: a company moving out
 * of a loss has no growth rate, and the division would produce a confident
 * number from a negative denominator.
 */
function profitGrowth(latest: IncomePeriod, prior: IncomePeriod): number | null {
  const now = latest.profit_after_tax;
  const then = prior.profit_after_tax;
  if (typeof now !== "number" || typeof then !== "number" || !(then > 0)) return null;
  return ((now - then) / then) * 100;
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
    /** Rows written, whether or not a Piotroski score was among them. */
    written: 0,
    /** Rows carrying a Piotroski score - needs two aligned periods a year apart. */
    scored: 0,
    /** Rows carrying only the quality ratios, which need a single period. */
    metricsOnly: 0,
    /**
     * Symbols with no period where the income statement and balance sheet
     * describe the same date. Thin coverage, not a fault - the two sources
     * carry different quarters and many symbols simply do not overlap yet.
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
      // Statements joined on date. Reading data.income[0] directly would
      // reintroduce the mismatch alignPeriods exists to prevent - the newest
      // income row is routinely a quarter the balance sheet does not carry.
      // Quarterly cash flow beside quarterly statements; the annual figures are
      // used on their own below, against a full year of income.
      const quarterlyCash = data.cashflow.filter((row) => row.period_type !== "12M");
      const periods = alignPeriods(data.income, data.balance, quarterlyCash);
      if (periods.length === 0) {
        summary.tooThin++;
        continue;
      }

      // The ratios need ONE period; the score needs two a year apart. Gating
      // the ratios behind the score threw away everything computable for the
      // 76 symbols that have an aligned period but no year-apart pair - on the
      // first corrected run that was 245 of 246 symbols written off over a
      // score most of them can never have.
      const latest = periods[0];
      const piotroski = piotroskiScore(data.income, data.balance, quarterlyCash);

      // Growth for the PEG denominator comes from the RATIOS' period and its
      // own anniversary, not from whichever pair the score happened to use -
      // each number stays internally consistent with the period beside it.
      const priorForGrowth = yearEarlier(periods, latest);

      const market = marketBySymbol.get(symbol);
      const marketInputs = {
        // screener_stocks quotes this in crore; qualityMetrics converts.
        market_cap_crore: market?.market_cap ?? null,
        pe: market?.pe ?? null,
        profit_growth_yoy_pct: priorForGrowth ? profitGrowth(latest.income, priorForGrowth.income) : null,
      };
      // Balance-sheet measures from the latest aligned period, with a YEAR of
      // revenue behind EV/sales - one quarter's revenue printed it ~4x too high.
      // The year is anchored to the newest INCOME quarter, not to the aligned
      // period: the balance sheet lands a quarter later than the income
      // statement, and Yahoo carries only four quarters, so anchoring it to the
      // balance date asked for a fifth quarter that does not exist. Enterprise
      // value still uses the latest balance sheet, as it should.
      const trailing = trailingYear(data.income, data.income[0]?.period_end ?? latest.period_end);
      const base = qualityMetrics(trailing ? [trailing] : [], [latest.balance], [], marketInputs);

      // Cash measures from the newest annual cash flow, each against the SAME
      // fiscal year: its four quarters of income and that year-end's balance
      // sheet. Free cash flow and its yield need no income, so they survive a
      // missing quarter; the ratios against profit or revenue do not.
      const annualCash = data.cashflow.find((row) => row.period_type === "12M" && hasCashFigures(row)) ?? null;
      const fiscalYear = annualCash ? trailingYear(data.income, annualCash.period_end) : null;
      const yearEnd = annualCash
        ? data.balance.find((row) => row.period_end === annualCash.period_end && row.total_assets != null) ?? latest.balance
        : latest.balance;
      const cash = annualCash
        ? qualityMetrics(fiscalYear ? [fiscalYear] : [], [yearEnd], [annualCash], marketInputs)
        : null;
      const metrics = cash
        ? {
          ...base,
          accruals_ratio: cash.accruals_ratio,
          cash_conversion: cash.cash_conversion,
          capex_intensity: cash.capex_intensity,
          free_cash_flow: cash.free_cash_flow,
          fcf_yield: cash.fcf_yield,
        }
        : base;

      if (piotroski) summary.scored++;
      else summary.metricsOnly++;

      rows.push({
        symbol,
        period_end: latest.period_end,
        basis: data.basis,
        piotroski_score: piotroski?.score ?? null,
        piotroski_testable: piotroski?.testable ?? null,
        piotroski_criteria: piotroski?.criteria ?? null,
        // The score's own periods, which are usually NOT period_end above.
        piotroski_period_end: piotroski?.period_end ?? null,
        piotroski_compared_with: piotroski?.compared_with ?? null,
        ...metrics,
        // Compounded over the ACTUAL span between the oldest and newest aligned
        // period. These periods are quarterly, so counting them as years turned
        // eight quarters into a "seven-year" CAGR.
        revenue_cagr_3y: cagrOverPeriods(periods, (income) => income.revenue),
        profit_cagr_3y: cagrOverPeriods(periods, (income) => income.profit_after_tax),
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
      summary.written = rows.length;
      observation.recordWrite("stock_fundamental_scores", rows.length);
    }
  }

  const attempted = summary.scored + summary.metricsOnly + summary.tooThin;
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

  // A batch where EVERY symbol failed to align is the drift signature here:
  // the fundamentals tables filling up but nothing joining, which is what a
  // renamed column or a changed period convention would look like. Thin
  // coverage on some symbols is normal and is not this.
  const wroteNothing = rows.length === 0 && summary.tooThin === batch.length && batch.length > 0;
  const status = writeFailed > 0 ? 500 : 200;

  await observation.close({
    status: status === 200 ? "ok" : "failed",
    detail: { ...summary, writeFailed, writeErrors, wroteNothing },
    error: writeFailed > 0 ? `write failed after retries: ${writeErrors.join("; ")}` : undefined,
  });

  return new Response(JSON.stringify({ ok: status === 200, ...summary, wroteNothing }), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
});

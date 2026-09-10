// Fetches each tracked stock's financial statements and profile from IndianAPI
// and stores them in stock_statements / stock_profiles.
//
// Trigger: GitHub Actions (.github/workflows/stock-statements-sync.yml).
// Protected by SYNC_SECRET; writes use the service-role key, like every sync-*.
//
// Stalest first: each run takes the symbols never attempted, then those whose
// last attempt is oldest, skipping any attempted within REFRESH_DAYS. The API
// is metered per request, so a symbol is never re-fetched ahead of one that
// has never been fetched, and a failed symbol waits its turn like any other
// rather than burning quota on every run.
//
// Nothing is stored for a symbol unless /stock names that symbol as its NSE
// code AND the quarterly statement's revenue agrees with /stock's own - both
// endpoints are name searches, and another company's financials under this
// ticker would be worse than none. See _shared/indianapi.ts.

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  STATEMENT_KINDS,
  crossCheckRevenue,
  deriveRoe,
  flattenKeyMetrics,
  parseShareholding,
  parseStatement,
  parseTechnicals,
  verifyIdentity,
  type Statement,
  type StatementKind,
} from "../_shared/indianapi.ts";

const BASE_URL = "https://stock.indianapi.in";
/** Symbols per run. Each costs 1 + STATEMENT_KINDS.length = 6 requests. */
const BATCH_SIZE = Number(Deno.env.get("STATEMENTS_BATCH_SIZE") ?? "6");
/** A symbol attempted more recently than this is not due. */
const REFRESH_DAYS = Number(Deno.env.get("STATEMENTS_REFRESH_DAYS") ?? "7");
/** Supabase kills the worker at 150s; stop well before, as sync-fundamentals does. */
const RUN_BUDGET_MS = 110_000;
const REQUEST_TIMEOUT_MS = 20_000;
const PACING_MS = 300;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sync-secret",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** The API refused us as a client (quota, key) - no later request this run will fare better. */
class ClientRefused extends Error {}

async function call(path: string, params: Record<string, string>, apiKey: string): Promise<unknown> {
  const url = `${BASE_URL}${path}?${new URLSearchParams(params)}`;
  const response = await fetch(url, {
    headers: { "x-api-key": apiKey, Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (response.status === 401 || response.status === 403 || response.status === 429) {
    throw new ClientRefused(`${path} HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`);
  }
  if (!response.ok) throw new Error(`${path} HTTP ${response.status}`);
  await sleep(PACING_MS);
  return response.json();
}

type Outcome =
  | { symbol: string; ok: true; statements: number; verified: boolean }
  | { symbol: string; ok: false; reason: string };

/**
 * One symbol end to end. Tries the ticker first and the company name second:
 * /stock?name= is a search, and a ticker like "M&M" can land on the wrong
 * company where the full name does not.
 */
async function syncSymbol(
  supabase: ReturnType<typeof createClient>,
  symbol: string,
  companyName: string | null,
  apiKey: string,
): Promise<Outcome> {
  let stock: unknown = null;
  let resolvedBy: string | null = null;
  const rejections: string[] = [];
  for (const query of [symbol, companyName].filter((q): q is string => Boolean(q))) {
    const candidate = await call("/stock", { name: query }, apiKey);
    const identity = verifyIdentity(candidate, symbol);
    if (identity.ok) {
      stock = candidate;
      resolvedBy = query;
      break;
    }
    rejections.push(`"${query}" ${identity.reason}`);
  }
  if (!stock || !resolvedBy) return { symbol, ok: false, reason: rejections.join("; ") || "no response" };

  const statements = new Map<StatementKind, Statement>();
  for (const kind of STATEMENT_KINDS) {
    const parsed = parseStatement(await call("/historical_stats", { stock_name: resolvedBy, stats: kind }, apiKey));
    if (parsed) statements.set(kind, parsed);
  }

  // /historical_stats is a name search too. If its quarters disagree with the
  // verified /stock response, every statement from the same query is suspect.
  const quarters = statements.get("quarter_results");
  const check = quarters ? crossCheckRevenue(stock, quarters) : { ok: true as const, verified: false };
  if (!check.ok) return { symbol, ok: false, reason: check.reason };

  const now = new Date().toISOString();
  if (statements.size > 0) {
    const { error } = await supabase.from("stock_statements").upsert(
      [...statements].map(([statement, s]) => ({
        // TTM's period end is a NULL element in the array, not a sentinel date.
        symbol, statement, periods: s.periods, period_ends: s.period_ends,
        rows: s.rows, verified: check.verified, source: "indianapi", fetched_at: now,
      })),
      { onConflict: "symbol,statement" },
    );
    if (error) return { symbol, ok: false, reason: `statements write: ${error.message}` };
  }

  const s = stock as Record<string, unknown>;
  const profile = (s.companyProfile ?? {}) as Record<string, unknown>;
  const annual = statements.get("yoy_results");
  const balance = statements.get("balancesheet");
  const { error: profileErr } = await supabase.from("stock_profiles").upsert({
    symbol,
    company_name: typeof s.companyName === "string" ? s.companyName : null,
    industry: typeof s.industry === "string" ? s.industry : null,
    isin: typeof profile.isInId === "string" ? profile.isInId : null,
    bse_code: typeof profile.exchangeCodeBse === "string" ? profile.exchangeCodeBse : null,
    description: typeof profile.companyDescription === "string" ? profile.companyDescription : null,
    key_metrics: flattenKeyMetrics(s.keyMetrics),
    moving_averages: parseTechnicals(s.stockTechnicalData),
    shareholding: parseShareholding(s.shareholding),
    roe_history: annual && balance ? deriveRoe(annual, balance) : [],
    peers: Array.isArray(profile.peerCompanyList)
      ? (profile.peerCompanyList as Record<string, unknown>[]).map((p) => ({ name: p.companyName ?? null }))
      : [],
    analyst_view: s.analystView ?? null,
    risk_meter: s.riskMeter ?? null,
    source: "indianapi",
    fetched_at: now,
    last_attempt_at: now,
    last_attempt_error: null,
  }, { onConflict: "symbol" });
  if (profileErr) return { symbol, ok: false, reason: `profile write: ${profileErr.message}` };

  return { symbol, ok: true, statements: statements.size, verified: check.verified };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const secret = Deno.env.get("SYNC_SECRET");
  if (!secret || req.headers.get("x-sync-secret") !== secret) return json({ error: "Unauthorized" }, 401);

  const apiKey = Deno.env.get("INDIANAPI_API_KEY");
  if (!apiKey) return json({ error: "INDIANAPI_API_KEY is not set" }, 500);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // An explicit list (e.g. {"symbols":["HDFCBANK"]}) re-syncs just those - for
  // checking a fix without waiting for the rotation to reach them.
  const body = await req.json().catch(() => ({})) as { symbols?: unknown };
  const requested = Array.isArray(body.symbols)
    ? body.symbols.filter((s): s is string => typeof s === "string").map((s) => s.toUpperCase()).slice(0, BATCH_SIZE)
    : null;

  const [{ data: universe, error: uErr }, { data: attempts, error: aErr }] = await Promise.all([
    supabase.from("screener_stocks").select("symbol,name"),
    supabase.from("stock_profiles").select("symbol,last_attempt_at"),
  ]);
  if (uErr || aErr) return json({ error: (uErr ?? aErr)!.message }, 500);

  const names = new Map((universe ?? []).map((r: { symbol: string; name: string | null }) => [r.symbol, r.name]));
  const lastAttempt = new Map((attempts ?? []).map((r: { symbol: string; last_attempt_at: string | null }) => [r.symbol, r.last_attempt_at]));
  const dueBefore = Date.now() - REFRESH_DAYS * 86_400_000;

  const batch = requested ?? [...names.keys()]
    .filter((symbol) => {
      const at = lastAttempt.get(symbol);
      return !at || Date.parse(at) < dueBefore;
    })
    .sort((a, b) => (lastAttempt.get(a) ?? "").localeCompare(lastAttempt.get(b) ?? "") || a.localeCompare(b))
    .slice(0, BATCH_SIZE);

  const started = Date.now();
  const outcomes: Outcome[] = [];
  let refused: string | null = null;
  let budgetExhausted = false;

  for (const symbol of batch) {
    if (Date.now() - started > RUN_BUDGET_MS) { budgetExhausted = true; break; }
    let outcome: Outcome;
    try {
      outcome = await syncSymbol(supabase, symbol, names.get(symbol) ?? null, apiKey);
    } catch (error) {
      if (error instanceof ClientRefused) { refused = error.message; break; }
      outcome = { symbol, ok: false, reason: error instanceof Error ? error.message : String(error) };
    }
    outcomes.push(outcome);
    if (!outcome.ok) {
      // Recorded so the symbol rotates to the back of the queue and the reason
      // is visible, instead of being retried first on every run.
      const { error } = await supabase.from("stock_profiles").upsert(
        { symbol, last_attempt_at: new Date().toISOString(), last_attempt_error: outcome.reason },
        { onConflict: "symbol" },
      );
      if (error) console.error(`recording failure for ${symbol}: ${error.message}`);
      console.error(`sync-stock-statements ${symbol}: ${outcome.reason}`);
    }
  }

  const stored = outcomes.filter((o) => o.ok).length;
  const failed = outcomes.filter((o): o is Extract<Outcome, { ok: false }> => !o.ok);
  // A refusal (quota spent, key rejected) or a batch where nothing stored is an
  // outage the workflow must show; a partial run is not.
  const status = refused || (batch.length > 0 && stored === 0) ? 500 : 200;
  return json({
    ok: status === 200,
    due: batch.length,
    stored,
    unverified: outcomes.filter((o) => o.ok && !o.verified).map((o) => o.symbol),
    failed: failed.map((f) => ({ symbol: f.symbol, reason: f.reason })),
    refused,
    budgetExhausted,
  }, status);
});

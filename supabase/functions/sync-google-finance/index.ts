// Fills the stocks IndianAPI cannot cover with Google Finance, via SerpApi.
//
// Trigger: GitHub Actions (.github/workflows/google-finance-sync.yml).
// Protected by SYNC_SECRET; writes use the service-role key.
//
// SerpApi's free plan is 250 searches a month, so every search is spent on a
// gap, in this order:
//   1. stocks IndianAPI failed on (no NSE code, identity check failed)
//   2. stocks IndianAPI stored without any key metrics (M&M)
//   3. stocks IndianAPI has not reached yet
// A stock read in the last REFRESH_DAYS is skipped. Before searching, the run
// asks SerpApi how many searches the month has left (that call is free) and
// always leaves RESERVE unspent.

import { createClient } from "npm:@supabase/supabase-js@2";
import { financialGrids, parseKeyStats, verifyGoogleFinance } from "../_shared/google-finance.ts";

const PER_RUN = Number(Deno.env.get("SERPAPI_PER_RUN") ?? "8");
const RESERVE = Number(Deno.env.get("SERPAPI_RESERVE") ?? "25");
const REFRESH_DAYS = 30;
const RETRY_DAYS = 7;
const RUN_BUDGET_MS = 110_000;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sync-secret",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

type Profile = {
  symbol: string;
  key_metrics: Record<string, Record<string, number | null>> | null;
  fetched_at: string | null;
  last_attempt_error: string | null;
  google_finance_fetched_at: string | null;
  google_finance_attempted_at: string | null;
};

const hasMetrics = (km: Profile["key_metrics"]) =>
  Boolean(km) && Object.values(km!).some((group) => Object.values(group).some((v) => v !== null));

async function searchesLeft(apiKey: string): Promise<number | null> {
  try {
    const response = await fetch(`https://serpapi.com/account.json?api_key=${encodeURIComponent(apiKey)}`, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) return null;
    const account = await response.json() as { plan_searches_left?: number; total_searches_left?: number };
    return account.total_searches_left ?? account.plan_searches_left ?? null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const secret = Deno.env.get("SYNC_SECRET");
  if (!secret || req.headers.get("x-sync-secret") !== secret) return json({ error: "Unauthorized" }, 401);
  const apiKey = Deno.env.get("SERPAPI_API_KEY");
  if (!apiKey) return json({ error: "SERPAPI_API_KEY is not set" }, 500);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Unknown remaining searches means no spending: guessing risks the month's allowance.
  const left = await searchesLeft(apiKey);
  if (left === null) return json({ error: "could not read SerpApi's remaining searches; spending nothing" }, 500);
  const budget = Math.max(0, Math.min(PER_RUN, left - RESERVE));

  const [{ data: universe, error: uErr }, { data: profiles, error: pErr }, { data: statements, error: sErr }] = await Promise.all([
    supabase.from("screener_stocks").select("symbol"),
    supabase.from("stock_profiles").select("symbol,key_metrics,fetched_at,last_attempt_error,google_finance_fetched_at,google_finance_attempted_at"),
    supabase.from("stock_statements").select("symbol").eq("source", "indianapi"),
  ]);
  if (uErr || pErr || sErr) return json({ error: (uErr ?? pErr ?? sErr)!.message }, 500);

  const bySymbol = new Map(((profiles ?? []) as Profile[]).map((p) => [p.symbol, p]));
  const withStatements = new Set((statements ?? []).map((r: { symbol: string }) => r.symbol));
  const now = Date.now();
  const recent = (iso: string | null, days: number) => iso !== null && now - Date.parse(iso) < days * 86_400_000;

  const priority = (symbol: string): number | null => {
    const p = bySymbol.get(symbol);
    if (p && (recent(p.google_finance_fetched_at, REFRESH_DAYS) || recent(p.google_finance_attempted_at, RETRY_DAYS))) return null;
    if (p?.last_attempt_error) return 1;
    if (p?.fetched_at && !hasMetrics(p.key_metrics)) return 2;
    if (!withStatements.has(symbol)) return 3;
    return null;
  };

  const queue = ((universe ?? []) as { symbol: string }[])
    .map((r) => ({ symbol: r.symbol, rank: priority(r.symbol) }))
    .filter((r): r is { symbol: string; rank: number } => r.rank !== null)
    .sort((a, b) => a.rank - b.rank || a.symbol.localeCompare(b.symbol));

  const started = Date.now();
  const stored: string[] = [];
  const failed: { symbol: string; reason: string }[] = [];

  for (const { symbol } of queue.slice(0, budget)) {
    if (Date.now() - started > RUN_BUDGET_MS) break;
    const attemptedAt = new Date().toISOString();
    let reason: string | null = null;
    try {
      const response = await fetch(
        `https://serpapi.com/search.json?engine=google_finance&q=${encodeURIComponent(`${symbol}:NSE`)}&api_key=${encodeURIComponent(apiKey)}`,
        { signal: AbortSignal.timeout(40_000) },
      );
      const body = await response.json() as Record<string, unknown>;
      if (!response.ok || typeof body.error === "string") {
        reason = `SerpApi: ${typeof body.error === "string" ? body.error : `HTTP ${response.status}`}`;
      } else {
        const identity = verifyGoogleFinance(body, symbol);
        if (!identity.ok) {
          reason = identity.reason;
        } else {
          const grids = Object.entries(financialGrids(body));
          if (grids.length > 0) {
            const { error } = await supabase.from("stock_statements").upsert(
              grids.map(([statement, g]) => ({
                symbol, statement, periods: g.periods, period_ends: g.period_ends, rows: g.rows,
                verified: true, source: "google_finance", fetched_at: attemptedAt,
              })),
              { onConflict: "symbol,statement" },
            );
            if (error) reason = `statements write: ${error.message}`;
          }
          if (!reason) {
            // Only Google's columns: an IndianAPI profile on the same row is left as it is.
            const { error } = await supabase.from("stock_profiles").upsert({
              symbol, google_finance: parseKeyStats(body), google_finance_fetched_at: attemptedAt,
              google_finance_attempted_at: attemptedAt, google_finance_error: null,
            }, { onConflict: "symbol" });
            if (error) reason = `profile write: ${error.message}`;
          }
        }
      }
    } catch (error) {
      reason = error instanceof Error ? error.message : String(error);
    }

    if (reason) {
      failed.push({ symbol, reason });
      await supabase.from("stock_profiles").upsert(
        { symbol, google_finance_attempted_at: attemptedAt, google_finance_error: reason },
        { onConflict: "symbol" },
      );
    } else {
      stored.push(symbol);
    }
  }

  const status = budget > 0 && queue.length > 0 && stored.length === 0 ? 500 : 200;
  return json({ ok: status === 200, searchesLeft: left, budget, queued: queue.length, stored, failed }, status);
});

// Rebuilds stock_fundamentals_summary - the screener's fundamentals columns -
// from what the stock syncs have already stored. Makes no request to any
// provider, so it can run as often as the statements change.
//
// Trigger: GitHub Actions (.github/workflows/screener-fundamentals.yml), after
// the Google Finance and IndianAPI syncs. Protected by SYNC_SECRET.

import { createClient } from "npm:@supabase/supabase-js@2";
import { summariseFundamentals, type SummaryInput } from "../_shared/screener-fundamentals.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sync-secret",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

type Grid = NonNullable<SummaryInput["quarters"]>;
type StatementRow = { symbol: string; statement: string; periods: string[]; period_ends: (string | null)[]; rows: Grid["rows"] };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const secret = Deno.env.get("SYNC_SECRET");
  if (!secret || req.headers.get("x-sync-secret") !== secret) return json({ error: "Unauthorized" }, 401);
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Only the statements the summary reads, in pages: the API caps a response at 1,000 rows.
  const statements: StatementRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from("stock_statements")
      .select("symbol,statement,periods,period_ends,rows")
      .in("statement", ["quarter_results", "balancesheet", "ratios", "gf_income_quarterly", "gf_balance_annual"])
      .order("symbol").range(from, from + 999);
    if (error) return json({ error: `statements read: ${error.message}` }, 500);
    statements.push(...(data ?? []) as StatementRow[]);
    if (!data || data.length < 1000) break;
  }
  const { data: profiles, error: pErr } = await supabase.from("stock_profiles").select("symbol,key_metrics,roe_history,google_finance");
  if (pErr) return json({ error: `profiles read: ${pErr.message}` }, 500);

  const bySymbol = new Map<string, Map<string, Grid>>();
  for (const s of statements) {
    const grids = bySymbol.get(s.symbol) ?? new Map<string, Grid>();
    grids.set(s.statement, { periods: s.periods, period_ends: s.period_ends, rows: s.rows });
    bySymbol.set(s.symbol, grids);
  }
  const profileOf = new Map((profiles ?? []).map((p) => [p.symbol, p]));

  const now = new Date().toISOString();
  const rows = [...bySymbol].map(([symbol, grids]) => {
    const profile = profileOf.get(symbol);
    const input: SummaryInput = grids.has("quarter_results")
      ? {
        source: "indianapi",
        quarters: grids.get("quarter_results"),
        balance: grids.get("balancesheet"),
        ratios: grids.get("ratios"),
        keyMetrics: profile?.key_metrics ?? {},
        roeHistory: profile?.roe_history ?? [],
      }
      : {
        source: "google_finance",
        quarters: grids.get("gf_income_quarterly"),
        balance: grids.get("gf_balance_annual"),
        googleStats: profile?.google_finance ?? undefined,
      };
    return { symbol, ...summariseFundamentals(input), updated_at: now };
  });

  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from("stock_fundamentals_summary").upsert(rows.slice(i, i + 500), { onConflict: "symbol" });
    if (error) return json({ error: `summary write: ${error.message}` }, 500);
  }
  const bySource = rows.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.source]: (acc[r.source] ?? 0) + 1 }), {});
  const filled = (k: keyof (typeof rows)[number]) => rows.filter((r) => r[k] !== null).length;
  return json({ ok: true, stocks: rows.length, bySource, coverage: { roe: filled("roe"), roce: filled("roce"), sales_growth_yoy: filled("sales_growth_yoy"), debt_to_equity: filled("debt_to_equity"), pb: filled("pb"), dividend_yield: filled("dividend_yield") } });
});

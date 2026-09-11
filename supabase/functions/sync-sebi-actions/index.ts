// Finds SEBI enforcement orders and corporate-action filings for each tracked
// stock and stores them in sebi_actions.
//
// Trigger: GitHub Actions (.github/workflows/sebi-actions-sync.yml).
// Protected by SYNC_SECRET; writes use the service-role key.
//
// Four searches per stock - orders, buybacks, open offers, rights issues - on a
// cursor through the universe (sync_cursors job "sebi-actions"), so each run
// is bounded and the whole universe is covered every few days. Each search
// returns SEBI's newest 25 matches; results are kept only when their title
// names the company.

import { createClient } from "npm:@supabase/supabase-js@2";
import { actionsForStock, parseSebiRows, searchName, type SebiAction, type SebiActionCategory } from "../_shared/sebi-actions.ts";

const JOB = "sebi-actions";
const STOCKS_PER_RUN = Number(Deno.env.get("SEBI_ACTIONS_PER_RUN") ?? "20");
const RUN_BUDGET_MS = 110_000;
const PACING_MS = 300;
const LISTING_URL = "https://www.sebi.gov.in/sebiweb/ajax/home/getnewslistinfo.jsp";

const SEARCHES: { category: SebiActionCategory; sid: number; ssid: number }[] = [
  { category: "order", sid: 2, ssid: 9 },
  { category: "buyback", sid: 3, ssid: 22 },
  { category: "open_offer", sid: 3, ssid: 20 },
  { category: "rights_issue", sid: 3, ssid: 16 },
];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sync-secret",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function search(sid: number, ssid: number, query: string): Promise<string> {
  const form = new URLSearchParams({
    nextValue: "1", next: "s", search: query, fromDate: "", toDate: "", fromYear: "", toYear: "",
    deptId: "", sid: String(sid), ssid: String(ssid), smid: "0", ssidhidden: String(ssid), intmid: "-1",
    sText: "", ssText: "", smText: "", doDirect: "-1",
  });
  const response = await fetch(LISTING_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      Referer: `https://www.sebi.gov.in/sebiweb/home/HomeAction.do?doListing=yes&sid=${sid}&ssid=${ssid}&smid=0`,
    },
    body: form,
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) throw new Error(`SEBI search sid=${sid} ssid=${ssid}: HTTP ${response.status}`);
  return response.text();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const secret = Deno.env.get("SYNC_SECRET");
  if (!secret || req.headers.get("x-sync-secret") !== secret) return json({ error: "Unauthorized" }, 401);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const [{ data: universe, error: uErr }, { data: profiles }, { data: cursorRow }] = await Promise.all([
    supabase.from("screener_stocks").select("symbol,name").order("symbol"),
    supabase.from("stock_profiles").select("symbol,company_name"),
    supabase.from("sync_cursors").select("cursor").eq("job", JOB).maybeSingle(),
  ]);
  if (uErr) return json({ error: uErr.message }, 500);

  // IndianAPI's full legal name where we have it: the screener's is often
  // abbreviated ("Life Insurance Corp"), and SEBI titles use the legal name.
  const fullName = new Map((profiles ?? []).filter((p) => p.company_name).map((p) => [p.symbol, p.company_name as string]));
  const stocks = (universe ?? []).map((r: { symbol: string; name: string }) => ({ symbol: r.symbol, name: fullName.get(r.symbol) ?? r.name }));
  const start = cursorRow?.cursor ? stocks.findIndex((s) => s.symbol === cursorRow.cursor) + 1 : 0;
  const batch = stocks.slice(start, start + STOCKS_PER_RUN);

  const started = Date.now();
  const found: (SebiAction & { symbol: string })[] = [];
  const failures: { symbol: string; category: string; reason: string }[] = [];
  let lastDone: string | null = null;

  for (const stock of batch) {
    if (Date.now() - started > RUN_BUDGET_MS) break;
    for (const { category, sid, ssid } of SEARCHES) {
      try {
        const rows = parseSebiRows(await search(sid, ssid, searchName(stock.name)));
        for (const action of actionsForStock(rows, category, stock.name)) found.push({ ...action, symbol: stock.symbol });
      } catch (error) {
        failures.push({ symbol: stock.symbol, category, reason: error instanceof Error ? error.message : String(error) });
      }
      await sleep(PACING_MS);
    }
    lastDone = stock.symbol;
  }

  if (found.length > 0) {
    const now = new Date().toISOString();
    const rows = [...new Map(found.map((a) => [`${a.symbol}|${a.url}`, a])).values()]
      .map((a) => ({ symbol: a.symbol, category: a.category, kind: a.kind, title: a.title, filed_on: a.filed_on, url: a.url, fetched_at: now }));
    const { error } = await supabase.from("sebi_actions").upsert(rows, { onConflict: "symbol,url" });
    if (error) return json({ error: `write: ${error.message}` }, 500);
  }

  // The end of the universe starts the next pass from the top.
  const atEnd = lastDone !== null && stocks.findIndex((s) => s.symbol === lastDone) === stocks.length - 1;
  if (lastDone) {
    await supabase.from("sync_cursors").upsert(
      { job: JOB, cursor: atEnd ? null : lastDone, updated_at: new Date().toISOString() },
      { onConflict: "job" },
    );
  }

  const searches = batch.length * SEARCHES.length;
  const status = searches > 0 && failures.length === searches ? 500 : 200;
  const byCategory = found.reduce<Record<string, number>>((acc, a) => ({ ...acc, [a.category]: (acc[a.category] ?? 0) + 1 }), {});
  return json({ ok: status === 200, stocks: batch.map((s) => s.symbol), found: found.length, byCategory, failures: failures.slice(0, 10), cursor: atEnd ? null : lastDone }, status);
});

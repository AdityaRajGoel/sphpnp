// Automated daily ingestion for the admin-fed market tables.
//
// Feeds:
//   market_flows        <- NSE fiidiiTradeReact (FII + DII cash, gross buy/sell)
//                          fallback: niftytrader (net-only, stored as one-sided)
//                       <- NSE fii_stats_<date>.xls (FII F&O gross buy/sell)
//   corporate_actions   <- NSE corporates-corporateActions (upcoming ex-dates)
//   mf_navs             <- AMFI NAVAll (curated popular schemes, real NAVs)
//
// mf_activity (MF cash buy/sell) is NOT automated - no reliable free source
// for the gross figures - and remains manual via /admin -> Market Data.
//
// Trigger: GitHub Actions cron (see .github/workflows/market-feed.yml) after
// market close. Protected by SYNC_SECRET; writes use the service-role key so
// RLS stays authenticated-only for everyone else. Safe to re-run (upserts).

import { createClient } from "npm:@supabase/supabase-js@2";
import * as XLSX from "npm:xlsx@0.18.5";

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-IN,en;q=0.9",
  Referer: "https://www.nseindia.com/",
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sync-secret",
};

type FlowRow = {
  activity_date: string;
  category: "fii_cash" | "dii_cash" | "fii_fno";
  buy_cr: number;
  sell_cr: number;
};

// "09-Jul-2026" -> "2026-07-09"
const MONTHS: Record<string, string> = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
  Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};
function nseDateToISO(d: string): string | null {
  const m = d?.match(/^(\d{2})-([A-Za-z]{3})-(\d{4})$/);
  if (!m || !MONTHS[m[2]]) return null;
  return `${m[3]}-${MONTHS[m[2]]}-${m[1]}`;
}

async function fetchNseJson(url: string): Promise<unknown> {
  // NSE sometimes wants a cookie warm-up from the homepage first
  const res1 = await fetch(url, { headers: BROWSER_HEADERS });
  if (res1.ok) return res1.json();

  const home = await fetch("https://www.nseindia.com", { headers: BROWSER_HEADERS });
  const cookie = home.headers.get("set-cookie")?.split(";")[0] ?? "";
  const res2 = await fetch(url, { headers: { ...BROWSER_HEADERS, Cookie: cookie } });
  if (!res2.ok) throw new Error(`NSE ${url} -> ${res2.status}`);
  return res2.json();
}

async function fetchFlowsFromNse(): Promise<FlowRow[]> {
  const data = (await fetchNseJson("https://www.nseindia.com/api/fiidiiTradeReact")) as {
    category: string; date: string; buyValue: string; sellValue: string;
  }[];
  const rows: FlowRow[] = [];
  for (const r of data ?? []) {
    const iso = nseDateToISO(r.date);
    if (!iso) continue;
    const category = r.category.includes("FII") ? "fii_cash" : r.category.includes("DII") ? "dii_cash" : null;
    if (!category) continue;
    rows.push({
      activity_date: iso,
      category,
      buy_cr: Math.round(parseFloat(r.buyValue) * 100) / 100,
      sell_cr: Math.round(parseFloat(r.sellValue) * 100) / 100,
    });
  }
  if (rows.length === 0) throw new Error("NSE flows: empty parse");
  return rows;
}

// Fallback: niftytrader publishes net values only. We store them one-sided
// (net buy -> buy_cr, net sell -> sell_cr) so the NET shown on-site is right;
// gross figures get corrected when NSE is reachable again or entered manually.
async function fetchFlowsFromNiftytrader(): Promise<FlowRow[]> {
  const res = await fetch("https://webapi.niftytrader.in/webapi/Resource/fii-dii-activity-data", {
    headers: { "User-Agent": BROWSER_HEADERS["User-Agent"], Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`niftytrader -> ${res.status}`);
  const json = await res.json();
  const latest = json?.resultData?.fii_dii_data?.[0];
  if (!latest?.created_at) throw new Error("niftytrader: empty parse");
  const iso = String(latest.created_at).slice(0, 10);
  const oneSided = (net: number) => ({
    buy_cr: net >= 0 ? Math.abs(net) : 0,
    sell_cr: net < 0 ? Math.abs(net) : 0,
  });
  return [
    { activity_date: iso, category: "fii_cash", ...oneSided(Number(latest.fii_net_value)) },
    { activity_date: iso, category: "dii_cash", ...oneSided(Number(latest.dii_net_value)) },
  ];
}

// FII derivatives stats: daily .xls with gross buy/sell per instrument.
// Sum the four top-level instrument rows (sub-rows like BANKNIFTY FUTURES
// roll up into INDEX FUTURES, so summing them too would double count).
const FNO_CATEGORIES = ["INDEX FUTURES", "STOCK FUTURES", "INDEX OPTIONS", "STOCK OPTIONS"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

async function fetchFiiFnoFlow(activityDateISO: string): Promise<FlowRow> {
  // "2026-07-09" -> "09-Jul-2026"
  const [y, m, d] = activityDateISO.split("-");
  const nseDate = `${d}-${MONTH_NAMES[parseInt(m, 10) - 1]}-${y}`;
  const url = `https://nsearchives.nseindia.com/content/fo/fii_stats_${nseDate}.xls`;
  const res = await fetch(url, { headers: BROWSER_HEADERS });
  if (!res.ok) throw new Error(`fii_stats xls -> ${res.status}`);
  const wb = XLSX.read(await res.arrayBuffer(), { type: "array" });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 }) as unknown[][];

  let buy = 0, sell = 0, matched = 0;
  for (const r of rows) {
    if (FNO_CATEGORIES.includes(String(r?.[0] ?? "").trim().toUpperCase())) {
      buy += parseFloat(String(r[2]));
      sell += parseFloat(String(r[4]));
      matched++;
    }
  }
  if (matched === 0 || !isFinite(buy) || !isFinite(sell)) throw new Error("fii_stats: empty parse");
  return {
    activity_date: activityDateISO,
    category: "fii_fno",
    buy_cr: Math.round(buy * 100) / 100,
    sell_cr: Math.round(sell * 100) / 100,
  };
}

// AMFI daily NAVs for a curated set of widely-held schemes (Direct-Growth).
// Keyed by AMFI scheme code so renames don't break the feed.
const CURATED_SCHEMES: Record<string, string> = {
  "122639": "Parag Parikh Flexi Cap",
  "118825": "Mirae Asset Large Cap",
  "118989": "HDFC Mid Cap",
  "118778": "Nippon India Small Cap",
  "125497": "SBI Small Cap",
  "120716": "UTI Nifty 50 Index",
  "118968": "HDFC Balanced Advantage",
  "120503": "Axis ELSS Tax Saver",
};

type MfNav = { scheme_code: string; scheme_name: string; nav: number; nav_date: string };

async function fetchMfNavs(): Promise<MfNav[]> {
  const res = await fetch("https://portal.amfiindia.com/spages/NAVAll.txt", {
    headers: { "User-Agent": BROWSER_HEADERS["User-Agent"] },
  });
  if (!res.ok) throw new Error(`AMFI -> ${res.status}`);
  const text = await res.text();

  const navs: MfNav[] = [];
  for (const line of text.split("\n")) {
    const parts = line.split(";");
    if (parts.length < 6) continue;
    const code = parts[0].trim();
    const friendly = CURATED_SCHEMES[code];
    if (!friendly) continue;
    const nav = parseFloat(parts[4]);
    const iso = nseDateToISO(parts[5].trim());
    if (!isFinite(nav) || !iso) continue;
    navs.push({ scheme_code: code, scheme_name: friendly, nav, nav_date: iso });
  }
  if (navs.length === 0) throw new Error("AMFI: no curated schemes matched");
  return navs;
}

type CorpAction = {
  company: string;
  action_type: string;
  details: string;
  ex_date: string;
};

const ACTION_TYPE_MAP: [RegExp, string][] = [
  [/dividend/i, "Dividend"],
  [/bonus/i, "Bonus"],
  [/split|sub-division|subdivision/i, "Split"],
  [/buy\s*back|buyback/i, "Buyback"],
  [/rights/i, "Rights"],
  [/agm|annual general/i, "AGM"],
];

async function fetchCorporateActions(): Promise<CorpAction[]> {
  const data = (await fetchNseJson(
    "https://www.nseindia.com/api/corporates-corporateActions?index=equities",
  )) as { comp: string; symbol: string; subject: string; exDate: string; series: string }[];

  const today = new Date().toISOString().slice(0, 10);
  const seen = new Set<string>();
  const actions: CorpAction[] = [];

  for (const r of data ?? []) {
    if (r.series && r.series !== "EQ") continue;
    const iso = nseDateToISO(r.exDate);
    if (!iso || iso < today) continue;
    const type = ACTION_TYPE_MAP.find(([re]) => re.test(r.subject ?? ""))?.[1] ?? "Other";
    // "Dividend - Rs 20 Per Share" -> "₹20/share"
    const details = (r.subject ?? "")
      .replace(/^[a-z\s]+-\s*/i, "")
      .replace(/Rs\.?\s*/i, "₹")
      .replace(/\s*Per Share/i, "/share")
      .trim() || r.subject || type;
    const key = `${r.symbol}|${type}|${iso}`;
    if (seen.has(key)) continue;
    seen.add(key);
    actions.push({ company: r.symbol || r.comp, action_type: type, details: details.slice(0, 120), ex_date: iso });
    if (actions.length >= 20) break;
  }
  if (actions.length === 0) throw new Error("NSE corp actions: empty parse");
  return actions;
}

// Upcoming results dates from NSE's board-meetings feed (purpose contains
// "Results"). Fills the earnings-calendar gap the corporate-actions API
// doesn't cover. Fails soft -> [] so it never blocks the dividend/split sync.
async function fetchResultsCalendar(): Promise<CorpAction[]> {
  try {
    const data = (await fetchNseJson(
      "https://www.nseindia.com/api/corporate-board-meetings?index=equities",
    )) as { bm_symbol: string; bm_date: string; bm_purpose: string; sm_name: string }[];

    const today = new Date().toISOString().slice(0, 10);
    const seen = new Set<string>();
    const rows: CorpAction[] = [];
    for (const r of data ?? []) {
      if (!/results/i.test(r.bm_purpose ?? "")) continue;
      const iso = nseDateToISO(r.bm_date);
      if (!iso || iso < today) continue;
      const key = `${r.bm_symbol}|${iso}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        company: r.bm_symbol || r.sm_name,
        action_type: "Results",
        details: `Financial results · ${(r.sm_name ?? "").slice(0, 60)}`.trim(),
        ex_date: iso,
      });
      if (rows.length >= 20) break;
    }
    return rows;
  } catch {
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const secret = Deno.env.get("SYNC_SECRET");
  if (!secret || req.headers.get("x-sync-secret") !== secret) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const report: Record<string, unknown> = {};

  // ── FII/DII flows ──────────────────────────────────────────────
  try {
    let flows: FlowRow[];
    try {
      flows = await fetchFlowsFromNse();
      report.flows_source = "nse";
    } catch (nseErr) {
      flows = await fetchFlowsFromNiftytrader();
      report.flows_source = "niftytrader (net-only fallback)";
      report.flows_nse_error = String(nseErr);
      console.error("sync-market-feed: NSE flows fetch failed, using niftytrader fallback:", nseErr);
    }
    // FII F&O rides on the same trading date as the cash figures
    try {
      flows.push(await fetchFiiFnoFlow(flows[0].activity_date));
      report.fii_fno = "ok";
    } catch (e) {
      report.fii_fno_error = String(e);
      console.error("sync-market-feed: FII F&O flow fetch failed:", e);
    }
    const { error } = await supabase
      .from("market_flows")
      .upsert(flows, { onConflict: "activity_date,category" });
    if (error) throw error;
    report.flows_upserted = flows.length;
    report.flows_date = flows[0]?.activity_date;
  } catch (e) {
    report.flows_error = String(e);
    console.error("sync-market-feed: flows sync failed:", e);
  }

  // ── Mutual fund NAVs (AMFI) ────────────────────────────────────
  try {
    const navs = await fetchMfNavs();
    // carry forward prev_nav so the UI can show a real day change
    type ExistingNav = { scheme_code: string; nav: number; nav_date: string; prev_nav: number | null };
    const { data: existing } = await supabase
      .from("mf_navs")
      .select("scheme_code, nav, nav_date, prev_nav");
    const prevByCode = new Map(
      ((existing as ExistingNav[] | null) ?? []).map((r) => [r.scheme_code, r]),
    );
    const rows = navs.map((n) => {
      const prev = prevByCode.get(n.scheme_code);
      // new trading day -> yesterday's nav becomes prev; same day re-run -> keep old prev
      const prev_nav = prev ? (prev.nav_date !== n.nav_date ? prev.nav : prev.prev_nav) : null;
      return { ...n, prev_nav };
    });
    const { error } = await supabase.from("mf_navs").upsert(rows, { onConflict: "scheme_code" });
    if (error) throw error;
    report.mf_navs_upserted = rows.length;
  } catch (e) {
    report.mf_navs_error = String(e);
    console.error("sync-market-feed: MF NAV sync failed:", e);
  }

  // ── Corporate actions + upcoming results calendar ──────────────
  try {
    const [actions, results] = await Promise.all([
      fetchCorporateActions(),
      fetchResultsCalendar(),
    ]);
    const merged = [...actions, ...results];
    const { error } = await supabase
      .from("corporate_actions")
      .upsert(merged, { onConflict: "company,action_type,ex_date" });
    if (error) throw error;
    // prune past-dated entries so the list stays fresh
    const today = new Date().toISOString().slice(0, 10);
    await supabase.from("corporate_actions").delete().lt("ex_date", today);
    report.corp_actions_upserted = actions.length;
    report.results_calendar_upserted = results.length;
  } catch (e) {
    report.corp_actions_error = String(e);
    console.error("sync-market-feed: corporate actions sync failed:", e);
  }

  const failed = report.flows_error && report.corp_actions_error;
  return new Response(JSON.stringify(report, null, 2), {
    status: failed ? 500 : 200,
    headers: { ...cors, "Content-Type": "application/json" },
  });
});

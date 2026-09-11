// Market data from NSE, BSE, niftyindices and NSDL, one dataset per call:
//
//   POST { dataset: "index_valuation" | "participant_oi" | "option_chain" | "eq_eod"
//          | "pledges" | "deals" | "nse_ipos" | "fpi" | "week52" | "movers"
//          | "constituents" | "surveillance" | "lot_sizes" | "calendar"
//          | "macro_ingest", backfill?: true, rows?: [...] }
//
// A daily call takes the latest file; `backfill` walks back through dates from
// a cursor (sync_cursors "backfill:<dataset>") and answers `wrapped` when it
// reaches the dataset's history limit. `macro_ingest` stores MoSPI rows the
// GitHub-side collector posts (MoSPI needs legacy TLS the edge cannot do).
//
// Parsers: _shared/market-files.ts, _shared/market-extra.ts, _shared/option-chain.ts.
// Trigger: .github/workflows/market-data-sync.yml. Protected by SYNC_SECRET.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { NSE_HEADERS } from "../_shared/nse.ts";
import { BSE_HEADERS } from "../_shared/bse.ts";
import { istDate } from "../_shared/ipo-status.ts";
import { canonicalIpoKey, ipoAliases } from "../_shared/ipo-parse.ts";
import { symbolResolver } from "../_shared/ticker.ts";
import {
  ddmmyyyy, isoDate, parseAsm, parseBseBhavcopy, parseConstituents, parseDeals, parseFoBan, parseGsm, parseIndexCloseAll,
  parseLotSizes, parseMovers, parseNseBhavdataFull, parseNseIpos, parseParticipantOi, parsePledges, parseWeek52,
  weekdaysBack, yyyymmdd, type DealKind,
} from "../_shared/market-files.ts";
import { parseBseResultsCalendar, parseFpiDaily, parseNseEventCalendar, type MacroMonthly } from "../_shared/market-extra.ts";
import { aroundSpot, contractInfoUrl, INDEX_UNDERLYINGS, optionChainUrl, parseContractInfo, parseOptionChainV3, summariseChain } from "../_shared/option-chain.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sync-secret",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const ARCHIVE = "https://nsearchives.nseindia.com";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const RUN_BUDGET_MS = 90_000;

class NotFound extends Error {}

async function fetchText(url: string, headers: Record<string, string> = NSE_HEADERS): Promise<string> {
  const res = await fetch(url, { headers: { ...headers, Accept: "*/*" }, signal: AbortSignal.timeout(30_000) });
  if (res.status === 404) { await res.body?.cancel(); throw new NotFound(url); }
  if (!res.ok) { await res.body?.cancel(); throw new Error(`HTTP ${res.status} for ${new URL(url).pathname}`); }
  const text = await res.text();
  // NSE answers a missing archive file with an HTML "Resource not found" page and a 200 from some edges.
  if (/^\s*<!DOCTYPE html/i.test(text) && /not found/i.test(text)) throw new NotFound(url);
  return text;
}
const fetchJson = async (url: string, headers: Record<string, string> = NSE_HEADERS) => JSON.parse(await fetchText(url, headers));

async function upsert(sb: SupabaseClient, table: string, rows: Record<string, unknown>[], onConflict: string): Promise<number> {
  for (let i = 0; i < rows.length; i += 1000) {
    const { error } = await sb.from(table).upsert(rows.slice(i, i + 1000), { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  return rows.length;
}

/** The newest weekday file that exists, trying back up to `days` weekdays from today. */
async function latestFile(urlFor: (iso: string) => string, days = 7, headers?: Record<string, string>): Promise<{ date: string; text: string } | null> {
  for (const date of weekdaysBack(istDate(), days)) {
    try { return { date, text: await fetchText(urlFor(date), headers) }; } catch (e) { if (!(e instanceof NotFound)) throw e; }
    await sleep(600);
  }
  return null;
}

type Ctx = { sb: SupabaseClient; started: number };

/** Walk back through dates from the stored cursor, `perCall` files a call, to `limitDays` of history. */
async function backfill(ctx: Ctx, dataset: string, limitDays: number, perCall: number, handle: (date: string) => Promise<number>) {
  const job = `backfill:${dataset}`;
  const { data } = await ctx.sb.from("sync_cursors").select("cursor").eq("job", job).maybeSingle();
  const oldestAllowed = new Date(Date.now() - limitDays * 86_400_000).toISOString().slice(0, 10);
  const from = data?.cursor ? weekdaysBack(data.cursor as string, 2)[1] : istDate();
  let rows = 0, files = 0, missing = 0, last: string | null = data?.cursor ?? null;
  for (const date of weekdaysBack(from, perCall)) {
    if (date < oldestAllowed || Date.now() - ctx.started > RUN_BUDGET_MS) break;
    try { rows += await handle(date); files++; } catch (e) { if (e instanceof NotFound) missing++; else throw e; }
    last = date;
    await ctx.sb.from("sync_cursors").upsert({ job, cursor: last, updated_at: new Date().toISOString() }, { onConflict: "job" });
    await sleep(800);
  }
  return { rows, files, missing, cursor: last, wrapped: !last || last <= oldestAllowed || weekdaysBack(last, 2)[1] < oldestAllowed };
}

// ---------------------------------------------------------------------------

const indexValuationFor = (ctx: Ctx) => async (date: string) =>
  await upsert(ctx.sb, "index_valuation_daily", parseIndexCloseAll(await fetchText(`${ARCHIVE}/content/indices/ind_close_all_${ddmmyyyy(date)}.csv`)), "index_name,trade_date");

const participantOiFor = (ctx: Ctx) => async (date: string) =>
  await upsert(ctx.sb, "participant_oi_daily", parseParticipantOi(await fetchText(`${ARCHIVE}/content/nsccl/fao_participant_oi_${ddmmyyyy(date)}.csv`)), "trade_date,client_type");

async function bseCodes(sb: SupabaseClient): Promise<Map<string, string>> {
  const { data } = await sb.from("stock_profiles").select("symbol,bse_code").not("bse_code", "is", null);
  return new Map((data ?? []).filter((p) => /^\d{6}$/.test(String(p.bse_code))).map((p) => [String(p.bse_code), p.symbol as string]));
}

const eqEodFor = (ctx: Ctx, codes: Map<string, string>) => async (date: string) => {
  const nse = parseNseBhavdataFull(await fetchText(`${ARCHIVE}/products/content/sec_bhavdata_full_${ddmmyyyy(date)}.csv`));
  let rows = await upsert(ctx.sb, "eq_eod", nse, "symbol,exchange,series,trade_date");
  try {
    const bse = parseBseBhavcopy(await fetchText(`https://www.bseindia.com/download/BhavCopy/Equity/BhavCopy_BSE_CM_0_0_0_${yyyymmdd(date)}_F_0000.CSV`, BSE_HEADERS), codes);
    rows += await upsert(ctx.sb, "eq_eod", bse, "symbol,exchange,series,trade_date");
  } catch (e) {
    if (!(e instanceof NotFound)) console.error(`BSE bhavcopy ${date}: ${(e as Error).message}`);
  }
  return rows;
};

async function universeResolver(sb: SupabaseClient) {
  const { data } = await sb.from("screener_stocks").select("symbol,name");
  return symbolResolver((data ?? []) as { symbol: string; name: string }[]);
}

const nseDay = (iso: string) => `${iso.slice(8, 10)}-${iso.slice(5, 7)}-${iso.slice(0, 4)}`;
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

const CONSTITUENT_FILES: Record<string, string> = {
  "NIFTY 50": "ind_nifty50list.csv", "NIFTY NEXT 50": "ind_niftynext50list.csv", "NIFTY 100": "ind_nifty100list.csv",
  "NIFTY 200": "ind_nifty200list.csv", "NIFTY 500": "ind_nifty500list.csv", "NIFTY MIDCAP 150": "ind_niftymidcap150list.csv",
  "NIFTY SMALLCAP 250": "ind_niftysmallcap250list.csv", "NIFTY BANK": "ind_niftybanklist.csv", "NIFTY IT": "ind_niftyitlist.csv",
  "NIFTY AUTO": "ind_niftyautolist.csv", "NIFTY PHARMA": "ind_niftypharmalist.csv", "NIFTY FMCG": "ind_niftyfmcglist.csv",
  "NIFTY METAL": "ind_niftymetallist.csv", "NIFTY REALTY": "ind_niftyrealtylist.csv", "NIFTY ENERGY": "ind_niftyenergylist.csv",
  "NIFTY FINANCIAL SERVICES": "ind_niftyfinancelist.csv", "NIFTY PSU BANK": "ind_niftypsubanklist.csv", "NIFTY MEDIA": "ind_niftymedialist.csv",
  "NIFTY HEALTHCARE": "ind_niftyhealthcarelist.csv", "NIFTY OIL & GAS": "ind_niftyoilgaslist.csv", "NIFTY CONSUMER DURABLES": "ind_niftyconsumerdurableslist.csv",
  "NIFTY PRIVATE BANK": "ind_nifty_privatebanklist.csv",
};

const MACRO_SERIES = new Set(["CPI (Combined)", "IIP (General)", "WPI (All commodities)"]);

// ---------------------------------------------------------------------------

async function run(ctx: Ctx, dataset: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { sb } = ctx;
  const today = istDate();
  switch (dataset) {
    case "index_valuation": {
      if (body.backfill) return await backfill(ctx, dataset, 730, 30, indexValuationFor(ctx));
      const f = await latestFile((d) => `${ARCHIVE}/content/indices/ind_close_all_${ddmmyyyy(d)}.csv`);
      if (!f) return { rows: 0, note: "no file in the last week" };
      return { date: f.date, rows: await upsert(sb, "index_valuation_daily", parseIndexCloseAll(f.text), "index_name,trade_date") };
    }
    case "participant_oi": {
      if (body.backfill) return await backfill(ctx, dataset, 365, 30, participantOiFor(ctx));
      const f = await latestFile((d) => `${ARCHIVE}/content/nsccl/fao_participant_oi_${ddmmyyyy(d)}.csv`);
      if (!f) return { rows: 0, note: "no file in the last week" };
      return { date: f.date, rows: await upsert(sb, "participant_oi_daily", parseParticipantOi(f.text), "trade_date,client_type") };
    }
    case "option_chain": {
      const out: Record<string, unknown>[] = [];
      for (const symbol of INDEX_UNDERLYINGS) {
        const expiries = parseContractInfo(await fetchJson(contractInfoUrl(symbol), { ...NSE_HEADERS, Referer: "https://www.nseindia.com/option-chain" }));
        for (const expiry of expiries.slice(0, 2)) {
          await sleep(1200);
          const chain = parseOptionChainV3(await fetchJson(optionChainUrl(symbol, expiry), { ...NSE_HEADERS, Referer: "https://www.nseindia.com/option-chain" }), expiry);
          if (chain.rows.length === 0) continue;
          const s = summariseChain(chain.rows);
          // NSE's own timestamp dates the snapshot, so a weekend run files it under Friday.
          const tradeDate = (chain.timestamp ? isoDate(chain.timestamp) : null) ?? today;
          out.push({
            trade_date: tradeDate, symbol, expiry: isoDate(expiry), spot: chain.spot,
            pcr: s.pcr, max_pain: s.maxPain, total_call_oi: s.totalCallOI, total_put_oi: s.totalPutOI, call_wall: s.callWall, put_wall: s.putWall,
            strikes: aroundSpot(chain.rows, chain.spot, 25).map((r) => ({ k: r.strike, c: r.callOI, p: r.putOI, dc: r.callChange, dp: r.putChange, ci: r.callIV, pi: r.putIV })),
            captured_at: new Date().toISOString(),
          });
        }
        await sleep(1200);
      }
      return { rows: await upsert(sb, "option_chain_eod", out, "trade_date,symbol,expiry") };
    }
    case "eq_eod": {
      const codes = await bseCodes(sb);
      if (body.backfill) return await backfill(ctx, dataset, 365, 8, eqEodFor(ctx, codes));
      for (const date of weekdaysBack(today, 7)) {
        try { return { date, rows: await eqEodFor(ctx, codes)(date) }; } catch (e) { if (!(e instanceof NotFound)) throw e; }
        await sleep(600);
      }
      return { rows: 0, note: "no file in the last week" };
    }
    case "pledges": {
      const resolve = await universeResolver(sb);
      const rows = parsePledges(await fetchJson("https://www.nseindia.com/api/corporate-pledgedata?index=equities"))
        .map((p) => ({ ...p, symbol: resolve(p.company), fetched_at: new Date().toISOString() }));
      return { rows: await upsert(sb, "pledge_snapshots", rows, "company,shp_date"), matched: rows.filter((r) => r.symbol).length };
    }
    case "deals": {
      const from = nseDay(body.backfill ? daysAgo(364) : daysAgo(10));
      const counts: Record<string, number> = {};
      for (const [kind, option] of [["bulk", "bulk_deals"], ["block", "block_deals"], ["short", "short_selling"]] as [DealKind, string][]) {
        const deals = parseDeals(await fetchJson(`https://www.nseindia.com/api/historicalOR/bulk-block-short-deals?optionType=${option}&from=${from}&to=${nseDay(today)}`), kind);
        counts[kind] = await upsert(sb, "deal_history", deals, "deal_key");
        await sleep(1200);
      }
      return counts;
    }
    case "nse_ipos": {
      const [current, upcoming, past] = [
        await fetchJson("https://www.nseindia.com/api/ipo-current-issue"),
        await fetchJson("https://www.nseindia.com/api/all-upcoming-issues?category=ipo"),
        await fetchJson("https://www.nseindia.com/api/public-past-issues"),
      ];
      const since = daysAgo(730);
      const ipos = parseNseIpos(current, upcoming, past, today).filter((i) => (i.issue_end ?? i.issue_start ?? today) >= since);
      const { data: ours } = await sb.from("ipos").select("slug,name,open_date,price_band_max");
      const entries = [...(ours ?? []), ...ipos.map((i) => ({ name: i.company, open_date: i.issue_start, price_band_max: i.price_band_max }))];
      const aliases = ipoAliases(entries.map((e) => ({ name: String(e.name), open_date: (e.open_date as string | null) ?? null, price_band_max: e.price_band_max === null ? null : Number(e.price_band_max) })));
      const slugByKey = new Map((ours ?? []).map((o) => [canonicalIpoKey(String(o.name), aliases), o.slug as string]));
      const rows = ipos.map((i) => ({ ...i, ipo_slug: slugByKey.get(canonicalIpoKey(i.company, aliases)) ?? null, fetched_at: new Date().toISOString() }));
      return { rows: await upsert(sb, "nse_ipos", rows, "symbol"), matched: rows.filter((r) => r.ipo_slug).length };
    }
    case "fpi": {
      const rows = parseFpiDaily(await fetchText("https://www.fpi.nsdl.co.in/web/Reports/Latest.aspx", { "User-Agent": NSE_HEADERS["User-Agent"] }));
      return { rows: await upsert(sb, "fpi_daily", rows, "report_date,section,category,route"), date: rows[0]?.report_date ?? null };
    }
    case "week52": {
      const f = await latestFile((d) => `${ARCHIVE}/content/CM_52_wk_High_low_${ddmmyyyy(d)}.csv`);
      if (!f) return { rows: 0, note: "no file in the last week" };
      return { date: f.date, rows: await upsert(sb, "week52_levels", parseWeek52(f.text), "symbol,series") };
    }
    case "movers": {
      const snapshots = [
        { kind: "most_active_value", ...parseMovers(await fetchJson("https://www.nseindia.com/api/live-analysis-most-active-securities?index=value"), "value") },
        { kind: "volume_gainers", ...parseMovers(await fetchJson("https://www.nseindia.com/api/live-analysis-volume-gainers"), "volume") },
      ].map((s) => ({ kind: s.kind, as_of: s.as_of, payload: s.movers, fetched_at: new Date().toISOString() }));
      return { rows: await upsert(sb, "market_snapshots", snapshots, "kind") };
    }
    case "constituents": {
      const counts: Record<string, number | string> = {};
      for (const [index, file] of Object.entries(CONSTITUENT_FILES)) {
        try {
          const rows = parseConstituents(await fetchText(`https://www.niftyindices.com/IndexConstituent/${file}`, { "User-Agent": NSE_HEADERS["User-Agent"] }), index)
            .map((r) => ({ ...r, as_of: today }));
          if (rows.length === 0) { counts[index] = "empty"; continue; }
          await sb.from("index_constituents").delete().eq("index_name", index);
          counts[index] = await upsert(sb, "index_constituents", rows, "index_name,symbol");
        } catch (e) {
          counts[index] = e instanceof NotFound ? "not found" : (e as Error).message;
        }
        await sleep(700);
      }
      return counts;
    }
    case "surveillance": {
      // The ban list is published the evening before the trade date it applies to.
      const tomorrow = new Date(`${today}T00:00:00Z`); tomorrow.setUTCDate(tomorrow.getUTCDate() + 3);
      let ban: ReturnType<typeof parseFoBan> = [];
      for (const date of weekdaysBack(tomorrow.toISOString().slice(0, 10), 6)) {
        try { ban = parseFoBan(await fetchText(`${ARCHIVE}/archives/fo/sec_ban/fo_secban_${ddmmyyyy(date)}.csv`)); break; } catch (e) { if (!(e instanceof NotFound)) throw e; }
        await sleep(500);
      }
      const asm = parseAsm(await fetchJson("https://www.nseindia.com/api/reportASM"));
      await sleep(1000);
      const gsm = parseGsm(await fetchJson("https://www.nseindia.com/api/reportGSM"));
      const flags = [...new Map([...ban, ...asm, ...gsm].map((f) => [`${f.symbol}|${f.flag}`, f])).values()];
      if (flags.length === 0) return { rows: 0, note: "nothing listed - kept the previous flags" };
      await sb.from("surveillance_flags").delete().neq("symbol", "");
      return { rows: await upsert(sb, "surveillance_flags", flags, "symbol,flag"), ban: ban.length, asm: asm.length, gsm: gsm.length };
    }
    case "lot_sizes": {
      const rows = parseLotSizes(await fetchText(`${ARCHIVE}/content/fo/fo_mktlots.csv`)).map((r) => ({ ...r, as_of: today }));
      return { rows: await upsert(sb, "fo_lot_sizes", [...new Map(rows.map((r) => [r.symbol, r])).values()], "symbol") };
    }
    case "calendar": {
      const nse = parseNseEventCalendar(await fetchJson("https://www.nseindia.com/api/event-calendar"));
      await sleep(1000);
      const bse = parseBseResultsCalendar(await fetchJson("https://api.bseindia.com/BseIndiaAPI/api/Corpforthresults/w", BSE_HEADERS), await bseCodes(sb));
      const rows = [...new Map([...nse, ...bse].map((e) => [e.event_key, e])).values()];
      await sb.from("corporate_calendar").delete().lt("event_date", daysAgo(60));
      return { rows: await upsert(sb, "corporate_calendar", rows, "event_key"), nse: nse.length, bse: bse.length };
    }
    case "macro_ingest": {
      const rows = (Array.isArray(body.rows) ? body.rows : []).filter((r): r is MacroMonthly =>
        typeof r === "object" && r !== null && MACRO_SERIES.has((r as MacroMonthly).series) &&
        /^\d{4}-\d{2}-01$/.test(String((r as MacroMonthly).period)) && Number.isFinite(Number((r as MacroMonthly).value)))
        .map((r) => ({ series: r.series, period: r.period, value: Number(r.value), change_pct: r.change_pct === null ? null : Number(r.change_pct), source: "mospi", fetched_at: new Date().toISOString() }));
      return { rows: await upsert(sb, "macro_monthly", rows, "series,period,source") };
    }
    default:
      throw new Error(`unknown dataset "${dataset}"`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const secret = Deno.env.get("SYNC_SECRET");
  if (!secret || req.headers.get("x-sync-secret") !== secret) return json({ error: "Unauthorized" }, 401);
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const dataset = typeof body.dataset === "string" ? body.dataset : "";
  const ctx: Ctx = { sb: createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!), started: Date.now() };
  try {
    const result = await run(ctx, dataset, body);
    return json({ ok: true, dataset, backfill: !!body.backfill, ...result });
  } catch (e) {
    return json({ ok: false, dataset, error: (e as Error).message }, 502);
  }
});

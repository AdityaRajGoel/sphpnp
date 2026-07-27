// Daily ingestion of NSE's official end-of-day security-wise bhavcopy, which
// includes delivery quantity and delivery %. This is a PUBLIC archive file that
// NSE publishes for download after market close - we mirror the latest trading
// day only (older dates are pruned each run).
//
//   source: https://archives.nseindia.com/products/content/sec_bhavdata_full_<DDMMYYYY>.csv
//   columns: SYMBOL, SERIES, DATE1, PREV_CLOSE, OPEN_PRICE, HIGH_PRICE, LOW_PRICE,
//            LAST_PRICE, CLOSE_PRICE, AVG_PRICE, TTL_TRD_QNTY, TURNOVER_LACS,
//            NO_OF_TRADES, DELIV_QTY, DELIV_PER
//
// Trigger: GitHub Actions cron (.github/workflows/bhavcopy-sync.yml) after close.
// Protected by SYNC_SECRET; writes use the service-role key. Safe to re-run.

import { createClient } from "npm:@supabase/supabase-js@2";

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  Accept: "text/csv,application/octet-stream,*/*",
  "Accept-Language": "en-IN,en;q=0.9",
  Referer: "https://www.nseindia.com/",
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sync-secret",
};

// Equity-board series worth storing (skip debt/ETF/derivatives-settled noise).
const EQUITY_SERIES = new Set(["EQ", "BE", "BZ", "SM", "ST", "IQ"]);

const MONTHS: Record<string, string> = {
  JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06",
  JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12",
};

const pad2 = (n: number) => String(n).padStart(2, "0");

// "09-JUL-2026" / "09-Jul-2026" -> "2026-07-09"
function nseDateToISO(d: string): string | null {
  const m = d.trim().match(/^(\d{2})-([A-Za-z]{3})-(\d{4})$/);
  if (!m) return null;
  const mon = MONTHS[m[2].toUpperCase()];
  return mon ? `${m[3]}-${mon}-${m[1]}` : null;
}

const num = (s: string): number | null => {
  const v = parseFloat(s.replace(/,/g, "").trim());
  return Number.isFinite(v) ? v : null;
};
const int = (s: string): number | null => {
  const v = num(s);
  return v == null ? null : Math.round(v);
};

type BhavRow = {
  symbol: string; series: string; trade_date: string;
  prev_close: number | null; open: number | null; high: number | null;
  low: number | null; close: number | null; avg_price: number | null;
  ttl_trd_qty: number | null; turnover_lacs: number | null; no_of_trades: number | null;
  deliv_qty: number | null; deliv_per: number | null;
};

// NSE archives live on nsearchives.nseindia.com now; keep the old host as a fallback.
const ARCHIVE_HOSTS = ["https://nsearchives.nseindia.com", "https://archives.nseindia.com"];

// NSE sometimes blocks cloud IPs until a homepage cookie is presented.
async function warmupCookie(): Promise<string> {
  try {
    const home = await fetch("https://www.nseindia.com", { headers: BROWSER_HEADERS });
    return home.headers.get("set-cookie")?.split(";")[0] ?? "";
  } catch {
    return "";
  }
}

async function fetchCsv(url: string, cookie: string): Promise<string | null> {
  const headers = cookie ? { ...BROWSER_HEADERS, Cookie: cookie } : BROWSER_HEADERS;
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    const csv = await res.text();
    return csv.includes("DELIV_PER") || csv.includes("DELIV_QTY") ? csv : null;
  } catch {
    return null;
  }
}

// Walk back from today (skip weekends/holidays) to find the newest published file.
async function fetchLatestBhavcopy(): Promise<{ csv: string; ddmmyyyy: string } | null> {
  const now = new Date();
  let cookie = "";
  let warmedUp = false;

  for (let back = 0; back < 7; back++) {
    const d = new Date(now.getTime() - back * 86400000);
    const dow = d.getUTCDay();
    if (dow === 0 || dow === 6) continue; // Sun/Sat
    const ddmmyyyy = `${pad2(d.getUTCDate())}${pad2(d.getUTCMonth() + 1)}${d.getUTCFullYear()}`;

    for (const host of ARCHIVE_HOSTS) {
      const url = `${host}/products/content/sec_bhavdata_full_${ddmmyyyy}.csv`;
      // First attempt without a cookie; if it fails, warm one up once and retry.
      let csv = await fetchCsv(url, cookie);
      if (!csv && !warmedUp) {
        cookie = await warmupCookie();
        warmedUp = true;
        csv = await fetchCsv(url, cookie);
      }
      if (csv) return { csv, ddmmyyyy };
    }
  }
  return null;
}

function parseBhavcopy(csv: string): BhavRow[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const header = lines[0].split(",").map((h) => h.trim().toUpperCase());
  const col = (name: string) => header.indexOf(name);
  const iSym = col("SYMBOL"), iSer = col("SERIES"), iDate = col("DATE1");
  const iPrev = col("PREV_CLOSE"), iOpen = col("OPEN_PRICE"), iHigh = col("HIGH_PRICE"),
    iLow = col("LOW_PRICE"), iClose = col("CLOSE_PRICE"), iAvg = col("AVG_PRICE"),
    iQty = col("TTL_TRD_QNTY"), iTurn = col("TURNOVER_LACS"), iTrades = col("NO_OF_TRADES"),
    iDQty = col("DELIV_QTY"), iDPer = col("DELIV_PER");
  if (iSym < 0 || iSer < 0) return [];

  const rows: BhavRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(",");
    const series = (c[iSer] ?? "").trim().toUpperCase();
    if (!EQUITY_SERIES.has(series)) continue;
    const iso = nseDateToISO(c[iDate] ?? "");
    if (!iso) continue;
    rows.push({
      symbol: (c[iSym] ?? "").trim(),
      series,
      trade_date: iso,
      prev_close: num(c[iPrev] ?? ""), open: num(c[iOpen] ?? ""), high: num(c[iHigh] ?? ""),
      low: num(c[iLow] ?? ""), close: num(c[iClose] ?? ""), avg_price: num(c[iAvg] ?? ""),
      ttl_trd_qty: int(c[iQty] ?? ""), turnover_lacs: num(c[iTurn] ?? ""), no_of_trades: int(c[iTrades] ?? ""),
      deliv_qty: int(c[iDQty] ?? ""), deliv_per: num(c[iDPer] ?? ""),
    });
  }
  return rows;
}

// ── NSE bulk & block deals (same public archive, same cookie) ───────────────
// Format: Date,Symbol,Security Name,Client Name,Buy/Sell,Quantity Traded,
//         Trade Price / Wght. Avg. Price[,Remarks]
// Client names can contain commas, so split with a quote-aware parser.

type DealRow = {
  trade_date: string; deal_type: "bulk" | "block"; symbol: string;
  security_name: string | null; client_name: string | null; buy_sell: string | null;
  quantity: number | null; price: number | null;
};

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false;
      } else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function parseDeals(csv: string, dealType: "bulk" | "block"): DealRow[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const rows: DealRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const c = splitCsvLine(lines[i]);
    const iso = nseDateToISO(c[0] ?? "");
    const symbol = (c[1] ?? "").trim();
    if (!iso || !symbol) continue; // covers the "NO RECORDS" placeholder row
    rows.push({
      trade_date: iso,
      deal_type: dealType,
      symbol,
      security_name: (c[2] ?? "").trim() || null,
      client_name: (c[3] ?? "").trim() || null,
      buy_sell: (c[4] ?? "").trim().toUpperCase() || null,
      quantity: int(c[5] ?? ""),
      price: num(c[6] ?? ""),
    });
  }
  return rows;
}

async function fetchDealsCsv(file: "bulk" | "block", cookie: string): Promise<string | null> {
  const headers = cookie ? { ...BROWSER_HEADERS, Cookie: cookie } : BROWSER_HEADERS;
  for (const host of ARCHIVE_HOSTS) {
    try {
      const res = await fetch(`${host}/content/equities/${file}.csv`, { headers });
      if (!res.ok) continue;
      const csv = await res.text();
      if (csv.toUpperCase().includes("SYMBOL")) return csv;
    } catch { /* try next host */ }
  }
  return null;
}

// Replace-all sync of bulk+block deals. Fails soft: a deals hiccup must never
// break the bhavcopy sync this function primarily exists for.
async function syncDeals(supabase: ReturnType<typeof createClient>): Promise<{ bulk: number; block: number } | { error: string }> {
  try {
    const cookie = await warmupCookie();
    const [bulkCsv, blockCsv] = await Promise.all([
      fetchDealsCsv("bulk", cookie),
      fetchDealsCsv("block", cookie),
    ]);
    if (!bulkCsv && !blockCsv) return { error: "no deals csv reachable" };
    const rows = [
      ...(bulkCsv ? parseDeals(bulkCsv, "bulk") : []),
      ...(blockCsv ? parseDeals(blockCsv, "block") : []),
    ];
    // Replace everything: the archive files carry only the latest published day.
    await supabase.from("bulk_block_deals").delete().gte("id", 0);
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabase.from("bulk_block_deals").insert(rows.slice(i, i + 500));
      if (error) return { error: `insert: ${error.message}` };
    }
    return {
      bulk: rows.filter((r) => r.deal_type === "bulk").length,
      block: rows.filter((r) => r.deal_type === "block").length,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  // Fail CLOSED: this runs with verify_jwt = false and writes using the
  // service-role key, so a missing SYNC_SECRET must lock the endpoint down
  // rather than leave it open to the internet.
  const secret = Deno.env.get("SYNC_SECRET");
  if (!secret || req.headers.get("x-sync-secret") !== secret) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  try {
    const file = await fetchLatestBhavcopy();
    if (!file) throw new Error("no bhavcopy file found in the last 6 days");

    const rows = parseBhavcopy(file.csv);
    if (rows.length === 0) throw new Error("bhavcopy parsed to 0 rows");
    const tradeDate = rows[0].trade_date;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Upsert in chunks (Supabase caps payload size).
    let upserted = 0;
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error } = await supabase.from("bhavcopy_eod").upsert(chunk, {
        onConflict: "symbol,series,trade_date",
      });
      if (error) throw new Error(`upsert: ${error.message}`);
      upserted += chunk.length;
    }

    // Keep only the latest trading day.
    await supabase.from("bhavcopy_eod").delete().neq("trade_date", tradeDate);

    // Piggyback: bulk & block deals from the same archive (fail-soft).
    const deals = await syncDeals(supabase);

    return new Response(
      JSON.stringify({ success: true, trade_date: tradeDate, rows_upserted: upserted, file: file.ddmmyyyy, deals }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("sync-bhavcopy: sync failed:", e);
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});

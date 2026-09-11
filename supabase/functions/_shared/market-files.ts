// NSE and BSE end-of-day files and market JSON, read into rows for storage.
// Every source here was captured 2026-09-11 (src/test/fixtures/nse-market/):
//
//   ind_close_all_DDMMYYYY.csv          every NSE index: OHLC, P/E, P/B, dividend yield
//   fao_participant_oi_DDMMYYYY.csv     F&O open interest by client, DII, FII, Pro
//   sec_bhavdata_full_DDMMYYYY.csv      every NSE security: OHLC, volume, delivery
//   BhavCopy_BSE_CM_..._YYYYMMDD.CSV    every BSE security (UDiFF layout)
//   /api/corporate-pledgedata           promoter pledges, all companies
//   /api/historicalOR/bulk-block-short-deals   bulk, block and short-selling deals
//   /api/ipo-current-issue, all-upcoming-issues, public-past-issues
//   CM_52_wk_High_low_DDMMYYYY.csv      52-week highs and lows adjusted for corporate actions
//   /api/live-analysis-*                most active by value, volume gainers
//   niftyindices ind_*list.csv          index constituents
//   fo_secban_DDMMYYYY.csv, /api/reportASM, /api/reportGSM, fo_mktlots.csv
//
// Pure: no fetch, no Deno APIs. sync-market-data does the I/O.

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => {
  if (typeof v !== "string" && typeof v !== "number") return null;
  const s = String(v).trim();
  return s && s !== "-" ? s : null;
};

/** "12,479.22", "(227.13)", ".2", "-.44", "2.1386919E7" -> a number; "-", "" -> null. */
export function num(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = str(v);
  if (!s) return null;
  const negative = /^\(.*\)$/.test(s);
  s = s.replace(/[(),\s]/g, "").replace(/^Rs\.?/i, "");
  if (!/^-?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? (negative ? -n : n) : null;
}

/** "10-09-2026", "10-Sep-2026", "10-SEP-2026", "Sep 10, 2026", "2026-09-10" -> "2026-09-10". */
export function isoDate(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(s);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = /^(\d{1,2})[- ]([A-Za-z]{3})[a-z]*[- ](\d{4})/.exec(s);
  if (m && MONTHS[m[2].toLowerCase()]) return `${m[3]}-${MONTHS[m[2].toLowerCase()]}-${m[1].padStart(2, "0")}`;
  m = /^([A-Za-z]{3})[a-z]*\s+(\d{1,2}),\s*(\d{4})/.exec(s);
  if (m && MONTHS[m[1].toLowerCase()]) return `${m[3]}-${MONTHS[m[1].toLowerCase()]}-${m[2].padStart(2, "0")}`;
  return null;
}

/** "11-Sep-2026 16:31:22" (IST) -> ISO timestamp. */
export function istTimestamp(v: unknown): string | null {
  const date = isoDate(v);
  if (!date) return null;
  const t = /(\d{2}):(\d{2})(?::(\d{2}))?/.exec(str(v) ?? "");
  const ms = Date.parse(`${date}T${t?.[1] ?? "00"}:${t?.[2] ?? "00"}:${t?.[3] ?? "00"}+05:30`);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

/** CSV lines to cells, honouring quotes; cells trimmed. */
export function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  for (const line of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cells: string[] = [];
    let cur = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (quoted && line[i + 1] === '"') { cur += '"'; i++; } else quoted = !quoted;
      } else if (ch === "," && !quoted) { cells.push(cur.trim()); cur = ""; } else cur += ch;
    }
    cells.push(cur.trim());
    rows.push(cells);
  }
  return rows;
}

/** Rows of a CSV as objects keyed by its header (header names trimmed). */
function records(text: string, headerMatch: (cells: string[]) => boolean): Record<string, string>[] {
  const rows = csvRows(text);
  const h = rows.findIndex(headerMatch);
  if (h === -1) return [];
  const header = rows[h].map((c) => c.trim());
  return rows.slice(h + 1).map((cells) => Object.fromEntries(header.map((name, i) => [name, cells[i] ?? ""])));
}

// ---------------------------------------------------------------------------
// Index valuation
// ---------------------------------------------------------------------------

export type IndexValuation = {
  index_name: string; trade_date: string;
  open: number | null; high: number | null; low: number | null; close: number | null;
  change_pct: number | null; volume: number | null; turnover_cr: number | null;
  pe: number | null; pb: number | null; div_yield: number | null;
};

export function parseIndexCloseAll(csv: string): IndexValuation[] {
  return records(csv, (c) => c[0] === "Index Name").flatMap((r) => {
    const trade_date = isoDate(r["Index Date"]);
    const index_name = str(r["Index Name"]);
    if (!trade_date || !index_name) return [];
    return [{
      index_name, trade_date,
      open: num(r["Open Index Value"]), high: num(r["High Index Value"]), low: num(r["Low Index Value"]), close: num(r["Closing Index Value"]),
      change_pct: num(r["Change(%)"]), volume: num(r["Volume"]), turnover_cr: num(r["Turnover (Rs. Cr.)"]),
      pe: num(r["P/E"]), pb: num(r["P/B"]), div_yield: num(r["Div Yield"]),
    }];
  });
}

// ---------------------------------------------------------------------------
// Participant-wise open interest
// ---------------------------------------------------------------------------

export type ParticipantOi = {
  trade_date: string; client_type: string;
  fut_idx_long: number | null; fut_idx_short: number | null; fut_stk_long: number | null; fut_stk_short: number | null;
  opt_idx_call_long: number | null; opt_idx_put_long: number | null; opt_idx_call_short: number | null; opt_idx_put_short: number | null;
  opt_stk_call_long: number | null; opt_stk_put_long: number | null; opt_stk_call_short: number | null; opt_stk_put_short: number | null;
  total_long: number | null; total_short: number | null;
};

const PARTICIPANT_COLUMNS: [keyof ParticipantOi, string][] = [
  ["fut_idx_long", "Future Index Long"], ["fut_idx_short", "Future Index Short"],
  ["fut_stk_long", "Future Stock Long"], ["fut_stk_short", "Future Stock Short"],
  ["opt_idx_call_long", "Option Index Call Long"], ["opt_idx_put_long", "Option Index Put Long"],
  ["opt_idx_call_short", "Option Index Call Short"], ["opt_idx_put_short", "Option Index Put Short"],
  ["opt_stk_call_long", "Option Stock Call Long"], ["opt_stk_put_long", "Option Stock Put Long"],
  ["opt_stk_call_short", "Option Stock Call Short"], ["opt_stk_put_short", "Option Stock Put Short"],
  ["total_long", "Total Long Contracts"], ["total_short", "Total Short Contracts"],
];

/** The file's title carries the date ("... as on Sep 10, 2026"). */
export function parseParticipantOi(csv: string): ParticipantOi[] {
  const title = /as on ([A-Za-z]{3}[a-z]* \d{1,2}, \d{4})/.exec(csv)?.[1];
  const trade_date = title ? isoDate(title) : null;
  if (!trade_date) return [];
  return records(csv, (c) => c[0] === "Client Type").flatMap((r) => {
    const client_type = str(r["Client Type"]);
    if (!client_type) return [];
    const row = { trade_date, client_type: client_type === "TOTAL" ? "Total" : client_type } as ParticipantOi;
    for (const [key, col] of PARTICIPANT_COLUMNS) (row as Record<string, unknown>)[key] = num(r[col]);
    return [row];
  });
}

// ---------------------------------------------------------------------------
// Daily prices
// ---------------------------------------------------------------------------

export type EodRow = {
  symbol: string; exchange: "NSE" | "BSE"; series: string; trade_date: string;
  prev_close: number | null; open: number | null; high: number | null; low: number | null; close: number | null;
  volume: number | null; turnover_lacs: number | null; trades: number | null;
  deliv_qty: number | null; deliv_pct: number | null;
};

/** Equity-board series; debt, ETF-settled and derivative-settled series are left out. */
export const EQUITY_SERIES = new Set(["EQ", "BE", "BZ", "SM", "ST", "IQ"]);

/** NSE's sec_bhavdata_full: every security with delivery figures. */
export function parseNseBhavdataFull(csv: string, series: Set<string> = EQUITY_SERIES): EodRow[] {
  const seen = new Set<string>();
  return records(csv, (c) => c[0] === "SYMBOL").flatMap((r) => {
    const symbol = str(r.SYMBOL);
    const s = str(r.SERIES);
    const trade_date = isoDate(r.DATE1);
    if (!symbol || !s || !trade_date || !series.has(s) || seen.has(`${symbol}|${s}|${trade_date}`)) return [];
    seen.add(`${symbol}|${s}|${trade_date}`);
    return [{
      symbol, exchange: "NSE" as const, series: s, trade_date,
      prev_close: num(r.PREV_CLOSE), open: num(r.OPEN_PRICE), high: num(r.HIGH_PRICE), low: num(r.LOW_PRICE), close: num(r.CLOSE_PRICE),
      volume: num(r.TTL_TRD_QNTY), turnover_lacs: num(r.TURNOVER_LACS), trades: num(r.NO_OF_TRADES),
      deliv_qty: num(r.DELIV_QTY), deliv_pct: num(r.DELIV_PER),
    }];
  });
}

/**
 * BSE's UDiFF bhavcopy, for the scrips we track: `symbolOf` maps a BSE scrip
 * code to our NSE symbol, so a stock's two exchanges share one symbol.
 */
export function parseBseBhavcopy(csv: string, symbolOf: Map<string, string>): EodRow[] {
  const seen = new Set<string>();
  return records(csv, (c) => c[0] === "TradDt").flatMap((r) => {
    const symbol = symbolOf.get(str(r.FinInstrmId) ?? "");
    const trade_date = isoDate(r.TradDt);
    // One row per stock and day: a repeated key in one upsert rejects the whole batch.
    if (!symbol || !trade_date || seen.has(`${symbol}|${trade_date}`)) return [];
    seen.add(`${symbol}|${trade_date}`);
    const turnover = num(r.TtlTrfVal);
    return [{
      symbol, exchange: "BSE" as const, series: str(r.SctySrs) ?? "", trade_date,
      prev_close: num(r.PrvsClsgPric), open: num(r.OpnPric), high: num(r.HghPric), low: num(r.LwPric), close: num(r.ClsPric),
      volume: num(r.TtlTradgVol), turnover_lacs: turnover === null ? null : turnover / 1e5, trades: num(r.TtlNbOfTxsExctd),
      deliv_qty: null, deliv_pct: null,
    }];
  });
}

// ---------------------------------------------------------------------------
// Promoter pledges
// ---------------------------------------------------------------------------

export type PledgeRow = {
  company: string; shp_date: string; broadcast_at: string | null;
  promoter_pct: number | null; pledged_shares: number | null; promoter_shares: number | null; total_shares: number | null;
  pledged_pct_of_promoter: number | null; pledged_pct_of_total: number | null;
};

/** Pledges by company (the API names companies, not symbols; the sync resolves them). */
export function parsePledges(raw: unknown): PledgeRow[] {
  const rows = isRecord(raw) && Array.isArray(raw.data) ? raw.data : [];
  const out = new Map<string, PledgeRow>();
  for (const r of rows.filter(isRecord)) {
    const company = str(r.comName);
    const shp_date = isoDate(r.shp);
    if (!company || !shp_date) continue;
    const pledged = num(r.numSharesPledged);
    const promoter = num(r.totPromoterHolding);
    const row: PledgeRow = {
      company, shp_date, broadcast_at: istTimestamp(r.broadcastDt),
      promoter_pct: num(r.percPromoterHolding), pledged_shares: pledged, promoter_shares: promoter, total_shares: num(r.totIssuedShares),
      pledged_pct_of_promoter: pledged !== null && promoter ? (pledged / promoter) * 100 : null,
      pledged_pct_of_total: num(r.percSharesPledged),
    };
    // The latest disclosure for a quarter wins.
    const key = `${company}|${shp_date}`;
    const prev = out.get(key);
    if (!prev || (row.broadcast_at ?? "") > (prev.broadcast_at ?? "")) out.set(key, row);
  }
  return [...out.values()];
}

// ---------------------------------------------------------------------------
// Bulk, block and short-selling deals
// ---------------------------------------------------------------------------

export type DealKind = "bulk" | "block" | "short";
export type Deal = {
  deal_key: string; trade_date: string; kind: DealKind; symbol: string; company: string | null;
  client: string | null; side: "buy" | "sell" | null; quantity: number | null; price: number | null; remarks: string | null;
};

/** Deals carry no id of their own; the key is every field that tells two apart. */
export function parseDeals(raw: unknown, kind: DealKind): Deal[] {
  const rows = isRecord(raw) && Array.isArray(raw.data) ? raw.data : [];
  const out = new Map<string, Deal>();
  for (const r of rows.filter(isRecord)) {
    const short = kind === "short";
    const trade_date = isoDate(short ? r.SS_DATE : r.BD_DT_DATE);
    const symbol = str(short ? r.SS_SYMBOL : r.BD_SYMBOL);
    if (!trade_date || !symbol) continue;
    const client = short ? null : str(r.BD_CLIENT_NAME);
    const sideRaw = short ? "SELL" : str(r.BD_BUY_SELL)?.toUpperCase();
    const side = sideRaw === "BUY" ? "buy" : sideRaw === "SELL" ? "sell" : null;
    const quantity = num(short ? r.SS_QTY : r.BD_QTY_TRD);
    const price = short ? null : num(r.BD_TP_WATP);
    const deal_key = [trade_date, kind, symbol, client ?? "", side ?? "", quantity ?? "", price ?? ""].join("|");
    out.set(deal_key, {
      deal_key, trade_date, kind, symbol, company: str(short ? r.SS_NAME : r.BD_SCRIP_NAME),
      client, side, quantity, price, remarks: short ? null : str(r.BD_REMARKS),
    });
  }
  return [...out.values()];
}

// ---------------------------------------------------------------------------
// IPOs as NSE lists them
// ---------------------------------------------------------------------------

export type NseIpo = {
  symbol: string; company: string; series: string | null; status: "open" | "upcoming" | "closed" | "listed";
  issue_start: string | null; issue_end: string | null; price_band_min: number | null; price_band_max: number | null;
  issue_size_shares: number | null; shares_bid: number | null; subscription_times: number | null;
  issue_price: number | null; listing_date: string | null;
};

/** "Rs.40 to Rs.43" -> [40, 43]; "Rs.100" -> [100, 100]. */
export function priceRange(v: unknown): [number | null, number | null] {
  const nums = (str(v) ?? "").match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  if (nums.length === 0) return [null, null];
  return [Math.min(...nums), Math.max(...nums)];
}

/**
 * The exchange's own record of each IPO: current (with subscription so far),
 * upcoming, and past issues. A symbol seen in several lists keeps the most
 * current view.
 */
export function parseNseIpos(current: unknown, upcoming: unknown, past: unknown, today: string): NseIpo[] {
  const out = new Map<string, NseIpo>();
  const lifecycle = (start: string | null, end: string | null): NseIpo["status"] =>
    start && start > today ? "upcoming" : end && end < today ? "closed" : "open";
  for (const r of (Array.isArray(past) ? past : []).filter(isRecord)) {
    const symbol = str(r.symbol);
    const company = str(r.company);
    if (!symbol || !company) continue;
    const [lo, hi] = priceRange(r.priceRange);
    const listing_date = isoDate(r.listingDate);
    const issue_end = isoDate(r.ipoEndDate);
    out.set(symbol, {
      symbol, company, series: str(r.securityType), status: listing_date && listing_date <= today ? "listed" : lifecycle(isoDate(r.ipoStartDate), issue_end),
      issue_start: isoDate(r.ipoStartDate), issue_end, price_band_min: lo, price_band_max: hi,
      issue_size_shares: null, shares_bid: null, subscription_times: null, issue_price: num(r.issuePrice), listing_date,
    });
  }
  for (const list of [upcoming, current]) {
    for (const r of (Array.isArray(list) ? list : []).filter(isRecord)) {
      const symbol = str(r.symbol);
      const company = str(r.companyName);
      if (!symbol || !company || (r.category !== undefined && str(r.category) !== "Total")) continue;
      const [lo, hi] = priceRange(r.issuePrice);
      const issue_start = isoDate(r.issueStartDate);
      const issue_end = isoDate(r.issueEndDate);
      const prev = out.get(symbol);
      out.set(symbol, {
        symbol, company, series: str(r.series), status: lifecycle(issue_start, issue_end),
        issue_start, issue_end, price_band_min: lo, price_band_max: hi,
        issue_size_shares: num(r.issueSize) ?? num(r.noOfSharesOffered),
        shares_bid: num(r.noOfsharesBid) ?? prev?.shares_bid ?? null,
        subscription_times: num(r.noOfTime) ?? prev?.subscription_times ?? null,
        issue_price: prev?.issue_price ?? null, listing_date: prev?.listing_date ?? null,
      });
    }
  }
  return [...out.values()];
}

// ---------------------------------------------------------------------------
// 52-week levels, movers, constituents, lot sizes
// ---------------------------------------------------------------------------

export type Week52 = { symbol: string; series: string; adj_high: number | null; high_date: string | null; adj_low: number | null; low_date: string | null; as_of: string | null };

/** Adjusted for bonuses, splits and rights; "Effective for 11-Sep-2026" dates the file. */
export function parseWeek52(csv: string): Week52[] {
  const as_of = isoDate(/Effective for ([0-9A-Za-z-]+)/.exec(csv)?.[1]);
  return records(csv, (c) => c[0] === "SYMBOL").flatMap((r) => {
    const symbol = str(r.SYMBOL);
    const series = str(r.SERIES);
    if (!symbol || !series || !EQUITY_SERIES.has(series)) return [];
    return [{ symbol, series, adj_high: num(r.Adjusted_52_Week_High), high_date: isoDate(r["52_Week_High_Date"]), adj_low: num(r.Adjusted_52_Week_Low), low_date: isoDate(r["52_Week_Low_DT"]), as_of }];
  });
}

export type Mover = { symbol: string; name: string | null; price: number | null; change_pct: number | null; value_cr: number | null; volume: number | null; volume_vs_week: number | null };

/** Most active by traded value, or the day's volume gainers, compact. */
export function parseMovers(raw: unknown, kind: "value" | "volume"): { as_of: string | null; movers: Mover[] } {
  const d = isRecord(raw) ? raw : {};
  const rows = Array.isArray(d.data) ? d.data.filter(isRecord) : [];
  return {
    as_of: istTimestamp(d.timestamp) ?? null,
    movers: rows.flatMap((r) => {
      const symbol = str(r.symbol);
      if (!symbol) return [];
      return [kind === "value"
        ? { symbol, name: null, price: num(r.lastPrice), change_pct: num(r.pChange), value_cr: (num(r.totalTradedValue) ?? 0) / 1e7 || null, volume: num(r.totalTradedVolume), volume_vs_week: null }
        : { symbol, name: str(r.companyName), price: num(r.ltp), change_pct: num(r.pChange), value_cr: (num(r.turnover) ?? 0) / 100 || null, volume: num(r.volume), volume_vs_week: num(r.week1volChange) }];
    }),
  };
}

export type Constituent = { index_name: string; symbol: string; company: string | null; industry: string | null; isin: string | null };

export function parseConstituents(csv: string, index_name: string): Constituent[] {
  return records(csv, (c) => c.includes("Symbol")).flatMap((r) => {
    const symbol = str(r.Symbol);
    return symbol ? [{ index_name, symbol, company: str(r["Company Name"]), industry: str(r.Industry), isin: str(r["ISIN Code"]) }] : [];
  });
}

export type LotSize = { symbol: string; underlying: string | null; lot_size: number };

/** The nearest month's lot size per F&O symbol (fo_mktlots.csv). */
export function parseLotSizes(csv: string): LotSize[] {
  return records(csv, (c) => c[0]?.toUpperCase().startsWith("UNDERLYING")).flatMap((r) => {
    const keys = Object.keys(r);
    const symbol = str(r[keys[1]]);
    const lot = keys.slice(2).map((k) => num(r[k])).find((n): n is number => n !== null);
    if (!symbol || symbol.toUpperCase() === "SYMBOL" || !lot) return [];
    return [{ symbol, underlying: str(r[keys[0]]), lot_size: lot }];
  });
}

// ---------------------------------------------------------------------------
// Surveillance: F&O ban, ASM, GSM
// ---------------------------------------------------------------------------

export type SurveillanceFlag = { symbol: string; flag: "fo_ban" | "asm_long" | "asm_short" | "gsm"; stage: string | null; detail: string | null; as_of: string | null };

/** "Securities in Ban For Trade Date 11-SEP-2026:" then "1,BANDHANBNK" lines. */
export function parseFoBan(csv: string): SurveillanceFlag[] {
  const as_of = isoDate(/Trade Date ([0-9A-Za-z-]+)/.exec(csv)?.[1]);
  return csvRows(csv).flatMap((c) => (c.length >= 2 && /^\d+$/.test(c[0]) && c[1]
    ? [{ symbol: c[1], flag: "fo_ban" as const, stage: null, detail: "In the F&O ban period: no new derivative positions", as_of }]
    : []));
}

export function parseAsm(raw: unknown): SurveillanceFlag[] {
  const d = isRecord(raw) ? raw : {};
  return (["longterm", "shortterm"] as const).flatMap((term) => {
    const block = isRecord(d[term]) ? d[term] as Record<string, unknown> : {};
    return (Array.isArray(block.data) ? block.data : []).filter(isRecord).flatMap((r) => {
      const symbol = str(r.symbol);
      return symbol ? [{ symbol, flag: term === "longterm" ? "asm_long" as const : "asm_short" as const, stage: str(r.asmSurvIndicator), detail: str(r.survDesc), as_of: isoDate(r.asmTime) }] : [];
    });
  });
}

export function parseGsm(raw: unknown): SurveillanceFlag[] {
  return (Array.isArray(raw) ? raw : []).filter(isRecord).flatMap((r) => {
    const symbol = str(r.symbol);
    return symbol ? [{ symbol, flag: "gsm" as const, stage: str(r.gsmStage), detail: str(r.survDesc), as_of: isoDate(r.gsmTime) }] : [];
  });
}

// ---------------------------------------------------------------------------
// Dates to fetch
// ---------------------------------------------------------------------------

/** DDMMYYYY, as NSE archive file names spell a date. */
export const ddmmyyyy = (iso: string) => `${iso.slice(8, 10)}${iso.slice(5, 7)}${iso.slice(0, 4)}`;
/** YYYYMMDD, as BSE's file names spell it. */
export const yyyymmdd = (iso: string) => iso.replace(/-/g, "");

/** Weekdays from `from` back to `to`, newest first (holidays are found by a 404, not a calendar). */
export function weekdaysBack(from: string, count: number): string[] {
  const out: string[] = [];
  const d = new Date(`${from}T00:00:00Z`);
  while (out.length < count) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return out;
}

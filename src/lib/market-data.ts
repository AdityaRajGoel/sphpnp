import { supabase } from "@/integrations/supabase/client";
import { INDEX_UNDERLYINGS } from "../../supabase/functions/_shared/option-chain";

/**
 * Reads for the market tables sync-market-data fills (see
 * supabase/migrations/20260911140000_market_data.sql), plus the small pure
 * helpers the Market Pulse page and stock pages use to read them.
 */

const table = (name: string) => supabase.from(name as never) as ReturnType<typeof supabase.from>;

async function rows<T>(query: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as T[];
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IndexValuation = { index_name: string; trade_date: string; close: number | null; change_pct: number | null; pe: number | null; pb: number | null; div_yield: number | null };
export type ParticipantOi = {
  trade_date: string; client_type: string;
  fut_idx_long: number | null; fut_idx_short: number | null; fut_stk_long: number | null; fut_stk_short: number | null;
  opt_idx_call_long: number | null; opt_idx_put_long: number | null; opt_idx_call_short: number | null; opt_idx_put_short: number | null;
  total_long: number | null; total_short: number | null;
};
export type ChainStrike = { k: number; c: number; p: number; dc: number; dp: number; ci: number; pi: number };
export type OptionChainEod = { trade_date: string; symbol: string; expiry: string; spot: number | null; pcr: number | null; max_pain: number | null; total_call_oi: number | null; total_put_oi: number | null; call_wall: number | null; put_wall: number | null; strikes: ChainStrike[] };
export type BuildUp = "long_buildup" | "short_buildup" | "short_covering" | "long_unwinding" | "neutral";
/** One F&O underlying's close from NSE's F&O bhavcopy: the near-month future and the nearest expiry's options. */
export type FoSnapshot = {
  trade_date: string; symbol: string; expiry: string; spot: number | null; pcr: number | null; max_pain: number | null;
  call_wall: number | null; put_wall: number | null; total_call_oi: number | null; total_put_oi: number | null;
  fut_close: number | null; fut_prev_close: number | null; fut_oi: number | null; fut_oi_change: number | null; build_up: BuildUp | null; lot_size: number | null;
};
export type FoChain = FoSnapshot & { strikes: ChainStrike[] };
export type FpiSector = {
  fortnight_end: string; sector: string; equity_net_cr: number | null; debt_net_cr: number | null; other_net_cr: number | null; total_net_cr: number | null;
  equity_net_usd_mn: number | null; total_net_usd_mn: number | null; equity_auc_cr: number | null; total_auc_cr: number | null; total_auc_usd_mn: number | null;
};
export type FpiRow = { report_date: string; section: "cash" | "derivatives"; category: string; route: string; buy_cr: number | null; sell_cr: number | null; net_cr: number | null; net_usd_mn: number | null; buy_contracts: number | null; sell_contracts: number | null; oi_contracts: number | null; oi_cr: number | null };
export type MacroPoint = { series: string; period: string; value: number; change_pct: number | null };
export type Mover = { symbol: string; name: string | null; price: number | null; change_pct: number | null; value_cr: number | null; volume: number | null; volume_vs_week: number | null };
export type Snapshot = { kind: string; as_of: string | null; payload: Mover[] };
export type Deal = { deal_key: string; trade_date: string; kind: "bulk" | "block" | "short"; symbol: string; company: string | null; client: string | null; side: "buy" | "sell" | null; quantity: number | null; price: number | null };
export type SurveillanceFlag = { symbol: string; flag: "fo_ban" | "asm_long" | "asm_short" | "gsm"; stage: string | null; detail: string | null; as_of: string | null };
export type CalendarEvent = { event_key: string; symbol: string | null; company: string; event_date: string; purpose: string; detail: string | null; source: "nse" | "bse" };
export type Constituent = { index_name: string; symbol: string; company: string | null; industry: string | null };
export type Pledge = { shp_date: string; promoter_pct: number | null; pledged_pct_of_promoter: number | null; pledged_pct_of_total: number | null; broadcast_at: string | null };
export type Week52 = { adj_high: number | null; high_date: string | null; adj_low: number | null; low_date: string | null; as_of: string | null };
export type EodPoint = { trade_date: string; exchange: "NSE" | "BSE"; close: number | null; volume: number | null; deliv_pct: number | null; high: number | null; low: number | null };
export type NseIpo = { symbol: string; company: string; status: string; issue_start: string | null; issue_end: string | null; price_band_min: number | null; price_band_max: number | null; issue_size_shares: number | null; shares_bid: number | null; subscription_times: number | null; issue_price: number | null; listing_date: string | null; fetched_at: string };

// ---------------------------------------------------------------------------
// Market-wide loaders
// ---------------------------------------------------------------------------

/** The latest trading day's valuation for every index. */
export async function latestIndexValuations(): Promise<IndexValuation[]> {
  const [latest] = await rows<{ trade_date: string }>(table("index_valuation_daily").select("trade_date").order("trade_date", { ascending: false }).limit(1));
  if (!latest) return [];
  return rows<IndexValuation>(table("index_valuation_daily").select("index_name,trade_date,close,change_pct,pe,pb,div_yield").eq("trade_date", latest.trade_date).order("index_name"));
}

/** One index's valuation history, oldest first. */
export async function indexValuationHistory(indexName: string): Promise<IndexValuation[]> {
  return rows<IndexValuation>(table("index_valuation_daily").select("index_name,trade_date,close,change_pct,pe,pb,div_yield").eq("index_name", indexName).order("trade_date").limit(1000));
}

export async function indexConstituents(indexName: string): Promise<Constituent[]> {
  const upper = indexName.toUpperCase();
  return rows<Constituent>(table("index_constituents").select("index_name,symbol,company,industry").eq("index_name", upper).order("symbol"));
}

export async function participantOi(days = 60): Promise<ParticipantOi[]> {
  return rows<ParticipantOi>(table("participant_oi_daily").select("*").order("trade_date", { ascending: false }).limit(days * 5));
}

/** The latest end-of-day chain per index underlying and expiry (stocks are read through latestFoSnapshots). */
export async function latestOptionChains(): Promise<OptionChainEod[]> {
  const all = await rows<OptionChainEod>(table("option_chain_eod").select("*").in("symbol", INDEX_UNDERLYINGS).order("trade_date", { ascending: false }).limit(40));
  const latest = all[0]?.trade_date;
  return all.filter((c) => c.trade_date === latest).sort((a, b) => a.symbol.localeCompare(b.symbol) || a.expiry.localeCompare(b.expiry));
}

const SNAPSHOT_COLUMNS = "trade_date,symbol,expiry,spot,pcr,max_pain,call_wall,put_wall,total_call_oi,total_put_oi,fut_close,fut_prev_close,fut_oi,fut_oi_change,build_up,lot_size";

/** Every F&O underlying's latest close from the F&O bhavcopy, without strikes (about 220 rows). */
export async function latestFoSnapshots(): Promise<FoSnapshot[]> {
  const [latest] = await rows<{ trade_date: string }>(table("option_chain_eod").select("trade_date").not("build_up", "is", null).order("trade_date", { ascending: false }).limit(1));
  if (!latest) return [];
  const all = await rows<FoSnapshot>(table("option_chain_eod").select(SNAPSHOT_COLUMNS).eq("trade_date", latest.trade_date).not("build_up", "is", null).order("symbol").order("expiry").limit(1000));
  // An index has a row per expiry; keep its nearest.
  return [...new Map(all.map((r) => [r.symbol, r] as const).reverse()).values()].sort((a, b) => a.symbol.localeCompare(b.symbol));
}

/** One underlying's latest chain with strikes, nearest expiry first. */
export async function latestFoChain(symbol: string): Promise<FoChain | null> {
  const [row] = await rows<FoChain>(table("option_chain_eod").select(`${SNAPSHOT_COLUMNS},strikes`).eq("symbol", symbol).order("trade_date", { ascending: false }).order("expiry").limit(1));
  return row ?? null;
}

/** One underlying's daily snapshots, oldest first, one per trading day (its nearest expiry). */
export async function foHistory(symbol: string, days = 90): Promise<FoSnapshot[]> {
  const data = await rows<FoSnapshot>(table("option_chain_eod").select(SNAPSHOT_COLUMNS).eq("symbol", symbol).order("trade_date", { ascending: false }).order("expiry").limit(days * 2));
  const byDay = new Map<string, FoSnapshot>();
  for (const r of data) if (!byDay.has(r.trade_date)) byDay.set(r.trade_date, r);
  return [...byDay.values()].slice(0, days).reverse();
}

/** NSDL's fortnightly sector-wise FPI flows for the last year, oldest fortnight first. */
export async function fpiSectors(): Promise<FpiSector[]> {
  const since = new Date(Date.now() - 400 * 86_400_000).toISOString().slice(0, 10);
  return rows<FpiSector>(table("fpi_sector_fortnightly").select("fortnight_end,sector,equity_net_cr,debt_net_cr,other_net_cr,total_net_cr,equity_net_usd_mn,total_net_usd_mn,equity_auc_cr,total_auc_cr,total_auc_usd_mn").gte("fortnight_end", since).order("fortnight_end").order("sector").limit(1000));
}

export async function fpiDaily(days = 60): Promise<FpiRow[]> {
  return rows<FpiRow>(table("fpi_daily").select("*").order("report_date", { ascending: false }).limit(days * 30));
}

export async function macroSeries(): Promise<MacroPoint[]> {
  return rows<MacroPoint>(table("macro_monthly").select("series,period,value,change_pct").order("period"));
}

export async function marketSnapshots(): Promise<Snapshot[]> {
  return rows<Snapshot>(table("market_snapshots").select("kind,as_of,payload"));
}

export async function recentDeals(limit = 200): Promise<Deal[]> {
  return rows<Deal>(table("deal_history").select("deal_key,trade_date,kind,symbol,company,client,side,quantity,price").order("trade_date", { ascending: false }).limit(limit));
}

export async function surveillanceFlags(): Promise<SurveillanceFlag[]> {
  return rows<SurveillanceFlag>(table("surveillance_flags").select("*").order("symbol"));
}

export async function upcomingEvents(from: string, days = 30): Promise<CalendarEvent[]> {
  const to = new Date(Date.parse(`${from}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
  return rows<CalendarEvent>(table("corporate_calendar").select("*").gte("event_date", from).lte("event_date", to).order("event_date").limit(400));
}

/** The tracked universe, to link a symbol only when the site has a page for it. */
export async function trackedSymbols(): Promise<Set<string>> {
  const data = await rows<{ symbol: string }>(table("screener_stocks").select("symbol"));
  return new Set(data.map((d) => d.symbol));
}

// ---------------------------------------------------------------------------
// Per-stock loaders
// ---------------------------------------------------------------------------

export type StockMarketData = {
  flags: SurveillanceFlag[];
  pledge: Pledge | null;
  indices: string[];
  lotSize: number | null;
  week52: Week52 | null;
  events: CalendarEvent[];
  deals: Deal[];
  eod: EodPoint[];
};

export async function loadStockMarketData(symbol: string, today: string): Promise<StockMarketData> {
  const [flags, pledges, indices, lots, w52, events, deals, eod] = await Promise.all([
    rows<SurveillanceFlag>(table("surveillance_flags").select("*").eq("symbol", symbol)),
    rows<Pledge>(table("pledge_snapshots").select("shp_date,promoter_pct,pledged_pct_of_promoter,pledged_pct_of_total,broadcast_at").eq("symbol", symbol).order("shp_date", { ascending: false }).limit(1)),
    rows<{ index_name: string }>(table("index_constituents").select("index_name").eq("symbol", symbol)),
    rows<{ lot_size: number }>(table("fo_lot_sizes").select("lot_size").eq("symbol", symbol).limit(1)),
    rows<Week52>(table("week52_levels").select("adj_high,high_date,adj_low,low_date,as_of").eq("symbol", symbol).eq("series", "EQ").limit(1)),
    rows<CalendarEvent>(table("corporate_calendar").select("*").eq("symbol", symbol).gte("event_date", today).order("event_date").limit(10)),
    rows<Deal>(table("deal_history").select("deal_key,trade_date,kind,symbol,company,client,side,quantity,price").eq("symbol", symbol).order("trade_date", { ascending: false }).limit(50)),
    rows<EodPoint>(table("eq_eod").select("trade_date,exchange,close,volume,deliv_pct,high,low").eq("symbol", symbol).in("series", ["EQ", "BE", "A", "B", "T", "X", "XT", "Z", "M", "MT"]).order("trade_date", { ascending: false }).limit(600)),
  ]);
  return {
    flags,
    pledge: pledges[0] ?? null,
    indices: indices.map((i) => i.index_name).sort(indexOrder),
    lotSize: lots[0]?.lot_size ?? null,
    week52: w52[0] ?? null,
    events,
    deals,
    eod: eod.reverse(),
  };
}

export async function nseIpoFor(slug: string): Promise<NseIpo | null> {
  const [row] = await rows<NseIpo>(table("nse_ipos").select("*").eq("ipo_slug", slug).limit(1));
  return row ?? null;
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

const BROAD = ["NIFTY 50", "NIFTY NEXT 50", "NIFTY 100", "NIFTY 200", "NIFTY 500", "NIFTY MIDCAP 150", "NIFTY SMALLCAP 250"];
/** Broad indices first, in size order; sectoral after, alphabetically. */
export function indexOrder(a: string, b: string): number {
  const ia = BROAD.indexOf(a.toUpperCase());
  const ib = BROAD.indexOf(b.toUpperCase());
  if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  return a.localeCompare(b);
}

export type ValuationStats = { current: number; mean: number; sd: number; min: number; max: number; percentile: number; zone: "cheap" | "fair" | "expensive" };

/**
 * Where today's value sits in its own history: the mean and standard
 * deviation, and the share of days it was lower. More than a standard
 * deviation above the mean reads as expensive, below as cheap. For dividend
 * yield the reading inverts - a high yield is the cheap end.
 */
export function valuationStats(values: (number | null)[], inverted = false): ValuationStats | null {
  const v = values.filter((x): x is number => x !== null && Number.isFinite(x) && x > 0);
  if (v.length < 20) return null;
  const current = v[v.length - 1];
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length);
  // Against the days before today: "higher than 97% of past days".
  const past = v.slice(0, -1);
  const percentile = (past.filter((x) => x < current).length / past.length) * 100;
  const z = sd > 0 ? (current - mean) / sd : 0;
  const high = inverted ? z < -1 : z > 1;
  const low = inverted ? z > 1 : z < -1;
  return { current, mean, sd, min: Math.min(...v), max: Math.max(...v), percentile, zone: high ? "expensive" : low ? "cheap" : "fair" };
}

/** Net contracts: long minus short. */
export const net = (long: number | null, short: number | null) => (long === null || short === null ? null : long - short);

/** Long share of a participant's positions, as a percentage. */
export const longShare = (long: number | null, short: number | null) =>
  long === null || short === null || long + short === 0 ? null : (long / (long + short)) * 100;

/** The equity sub-total's net FPI investment per reporting day, oldest first. */
export function fpiEquityNet(rows: FpiRow[]): { date: string; net_cr: number }[] {
  return rows
    .filter((r) => r.section === "cash" && r.category === "Equity" && r.route === "Sub-total" && r.net_cr !== null)
    .map((r) => ({ date: r.report_date, net_cr: r.net_cr! }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export const BUILD_UP_LABEL: Record<BuildUp, string> = {
  long_buildup: "Long build-up", short_buildup: "Short build-up", short_covering: "Short covering", long_unwinding: "Long unwinding", neutral: "Neutral",
};
/** Long build-up and short covering push prices up; short build-up and long unwinding push them down. */
export const BUILD_UP_TONE: Record<BuildUp, "up" | "down" | "flat"> = {
  long_buildup: "up", short_covering: "up", short_buildup: "down", long_unwinding: "down", neutral: "flat",
};

/** Percentage change, or null when either side is missing or the base is zero. */
export const pctChange = (now: number | null, before: number | null) => (now === null || before === null || before === 0 ? null : (now / before - 1) * 100);

/** The future's open-interest change as a share of the day before's open interest. */
export const oiChangePct = (s: Pick<FoSnapshot, "fut_oi" | "fut_oi_change">) => {
  if (s.fut_oi === null || s.fut_oi_change === null) return null;
  const before = s.fut_oi - s.fut_oi_change;
  return before > 0 ? (s.fut_oi_change / before) * 100 : null;
};

/** How many underlyings closed in each build-up. */
export function buildUpCounts(snaps: FoSnapshot[]): Record<BuildUp, number> {
  const out: Record<BuildUp, number> = { long_buildup: 0, short_buildup: 0, short_covering: 0, long_unwinding: 0, neutral: 0 };
  for (const s of snaps) if (s.build_up) out[s.build_up]++;
  return out;
}

/** Each sector's net equity flow for one fortnight, biggest buying first; the grand total is left out. */
export function sectorFlowsFor(rows: FpiSector[], fortnight: string): FpiSector[] {
  return rows.filter((r) => r.fortnight_end === fortnight && r.sector !== "Total" && r.equity_net_cr !== null)
    .sort((a, b) => (b.equity_net_cr ?? 0) - (a.equity_net_cr ?? 0));
}

/** Net equity flow per fortnight across all sectors (the report's grand total), oldest first. */
export function fpiFortnightTotals(rows: FpiSector[]): { fortnight: string; equity: number; total: number | null }[] {
  return rows.filter((r) => r.sector === "Total" && r.equity_net_cr !== null)
    .map((r) => ({ fortnight: r.fortnight_end, equity: r.equity_net_cr!, total: r.total_net_cr }))
    .sort((a, b) => a.fortnight.localeCompare(b.fortnight));
}

/** Crore written short: 12,345 -> "12,345 Cr"; a lakh crore as "1.2L Cr". */
export const crore = (v: number | null) =>
  v === null ? "—" : Math.abs(v) >= 100000 ? `${(v / 100000).toFixed(2)}L Cr` : `${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })} Cr`;

/** Contracts in lakh: 3,460,539 -> "34.6 L". */
export const lakhs = (v: number | null) => (v === null ? "—" : Math.abs(v) >= 100000 ? `${(v / 100000).toFixed(1)} L` : v.toLocaleString("en-IN"));

export const SURVEILLANCE_LABEL: Record<SurveillanceFlag["flag"], string> = {
  fo_ban: "F&O ban", asm_long: "Long-term ASM", asm_short: "Short-term ASM", gsm: "GSM",
};

export const istToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

export const shortDate = (iso: string | null) =>
  iso ? new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "—";

// ---------------------------------------------------------------------------
// Global markets (EODHD)
// ---------------------------------------------------------------------------

export type GlobalBar = { ticker: string; trade_date: string; close: number };

/** A year of daily closes for every global ticker, oldest first (paged past the 1,000-row cap). */
export async function globalMarkets(): Promise<GlobalBar[]> {
  const since = new Date(Date.now() - 370 * 86_400_000).toISOString().slice(0, 10);
  const out: GlobalBar[] = [];
  for (let from = 0; from < 20_000; from += 1000) {
    const page = await rows<GlobalBar>(table("global_markets_daily").select("ticker,trade_date,close").gte("trade_date", since).order("trade_date").order("ticker").range(from, from + 999));
    out.push(...page);
    if (page.length < 1000) break;
  }
  return out;
}

export type GlobalSummary = { ticker: string; close: number; date: string; day: number | null; month: number | null; year: number | null; spark: number[] };

/** Last close with its one-day, one-month and one-year change, and a 3-month sparkline. */
export function summariseGlobal(bars: GlobalBar[], ticker: string): GlobalSummary | null {
  const series = bars.filter((b) => b.ticker === ticker);
  if (series.length === 0) return null;
  const last = series[series.length - 1];
  const change = (daysBack: number) => {
    const cutoff = new Date(Date.parse(`${last.trade_date}T00:00:00Z`) - daysBack * 86_400_000).toISOString().slice(0, 10);
    const base = [...series].reverse().find((b) => b.trade_date <= cutoff);
    return base && base.close > 0 ? (last.close / base.close - 1) * 100 : null;
  };
  const prev = series.length > 1 ? series[series.length - 2] : null;
  return {
    ticker, close: last.close, date: last.trade_date,
    day: prev && prev.close > 0 ? (last.close / prev.close - 1) * 100 : null,
    month: change(30), year: change(365),
    spark: series.slice(-65).map((b) => b.close),
  };
}

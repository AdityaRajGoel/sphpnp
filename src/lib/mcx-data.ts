/**
 * MCX commodity futures as stored from MCX's own market watch and bhavcopy
 * (mcx_futures_daily; see supabase/functions/_shared/mcx.ts), for /commodities
 * and /commodity-research.
 */
import { supabase } from "@/integrations/supabase/client";

export type McxQuote = {
  symbol: string; trade_date: string; expiry: string; unit: string;
  open: number | null; high: number | null; low: number | null; close: number; prev_close: number | null;
  change_pct: number | null; volume: number; oi: number; value_lacs: number | null; ltt: string;
};

const table = (name: string) => supabase.from(name as never) as ReturnType<typeof supabase.from>;
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const toQuote = (r: Record<string, unknown>): McxQuote => ({
  symbol: String(r.symbol), trade_date: String(r.trade_date), expiry: String(r.expiry), unit: String(r.unit ?? ""),
  open: num(r.open), high: num(r.high), low: num(r.low), close: Number(r.close), prev_close: num(r.prev_close),
  change_pct: num(r.change_pct), volume: Number(r.volume) || 0, oi: Number(r.oi) || 0, value_lacs: num(r.value_lacs), ltt: String(r.ltt),
});

/**
 * Each commodity's most-held contract on its latest trading day, most traded (by
 * value) first. Contracts with no open interest and no volume (dormant agri and
 * steel contracts) are left out: a price nobody trades at is not a quote.
 */
export async function mcxBoard(): Promise<McxQuote[]> {
  const { data, error } = await table("mcx_active_latest").select("*");
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(toQuote)
    .filter((q) => q.oi > 0 || q.volume > 0)
    .sort((a, b) => (b.value_lacs ?? 0) - (a.value_lacs ?? 0));
}

/** Every contract of one commodity on one trading day, nearest expiry first: the term structure. */
export async function mcxContracts(symbol: string, tradeDate: string): Promise<McxQuote[]> {
  const { data, error } = await table("mcx_futures_daily").select("*").eq("symbol", symbol).eq("trade_date", tradeDate).order("expiry");
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(toQuote);
}

/** Daily closes of the most-held contract since `since`, oldest first, in the shape globalHistory returns. */
export async function mcxSeries(symbol: string, since = "2012-01-01"): Promise<{ ticker: string; trade_date: string; close: number }[]> {
  const { data, error } = await supabase.rpc("mcx_active_series" as never, { p_symbol: symbol, p_since: since } as never);
  if (error) throw new Error(error.message);
  return ((data ?? []) as [string, number, string][]).map(([trade_date, close]) => ({ ticker: `MCX:${symbol}`, trade_date, close: Number(close) }));
}

const NAMES: Record<string, string> = {
  GOLD: "Gold", GOLDM: "Gold Mini", GOLDGUINEA: "Gold Guinea", GOLDPETAL: "Gold Petal", GOLDTEN: "Gold Ten",
  SILVER: "Silver", SILVERM: "Silver Mini", SILVERMIC: "Silver Micro", SILVER100: "Silver 100",
  CRUDEOIL: "Crude oil", CRUDEOILM: "Crude oil Mini", NATURALGAS: "Natural gas", NATGASMINI: "Natural gas Mini",
  COPPER: "Copper", ZINC: "Zinc", ZINCMINI: "Zinc Mini", ALUMINIUM: "Aluminium", ALUMINI: "Aluminium Mini",
  LEAD: "Lead", LEADMINI: "Lead Mini", NICKEL: "Nickel", MENTHAOIL: "Mentha oil", CARDAMOM: "Cardamom",
  KAPAS: "Cotton (Kapas)", COTTON: "Cotton", ELECDMBL: "Electricity (base load)",
};
export const mcxName = (symbol: string) => NAMES[symbol] ?? symbol.charAt(0) + symbol.slice(1).toLowerCase();

/** MCX's quotation unit ("10 GRMS", "1 KGS", "1 BBL") as reader text ("per 10 g"). */
export function mcxUnit(unit: string): string {
  const m = /^([\d.]+)\s*([A-Za-z]+)/.exec(unit.trim());
  if (!m) return "";
  const n = m[1] === "1" ? "" : `${m[1]} `;
  const u = m[2].toUpperCase();
  const word = u.startsWith("GRM") || u === "GM" || u === "GRAMS" ? "g" : u.startsWith("KG") ? "kg" : u === "BBL" ? "barrel" : u === "MMBTU" ? "mmBtu" : u === "MT" ? "tonne" : u === "BALES" || u === "BALE" ? "bale" : u === "MWH" ? "MWh" : m[2].toLowerCase();
  return `per ${n}${word}`;
}

export const contractMonth = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

import { supabase } from "@/integrations/supabase/client";

/**
 * F&O contract facts for the margin calculator: NSE's current lot size for
 * every underlying (fo_lot_sizes, refreshed by sync-market-data) and the last
 * end-of-day spot from the option-chain snapshot, to pre-fill a price.
 */
export type FoContract = { symbol: string; underlying: string; lot_size: number; spot: number | null; spot_date: string | null; isIndex: boolean };

const table = (name: string) => supabase.from(name as never) as unknown as ReturnType<typeof supabase.from>;

export const INDEX_SYMBOLS = new Set(["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY", "NIFTYNXT50", "SENSEX", "BANKEX"]);

export async function getFoContracts(): Promise<FoContract[]> {
  const [lots, chains] = await Promise.all([
    table("fo_lot_sizes").select("symbol,underlying,lot_size").order("symbol").limit(1000),
    table("option_chain_eod").select("symbol,spot,trade_date").order("trade_date", { ascending: false }).limit(2000),
  ]);
  if (lots.error) throw new Error(lots.error.message);
  const spots = new Map<string, { spot: number; date: string }>();
  for (const row of (chains.data ?? []) as unknown as { symbol: string; spot: number | null; trade_date: string }[]) {
    if (row.spot !== null && !spots.has(row.symbol)) spots.set(row.symbol, { spot: Number(row.spot), date: row.trade_date });
  }
  return ((lots.data ?? []) as unknown as { symbol: string; underlying: string | null; lot_size: number }[])
    .filter((l) => Number(l.lot_size) > 0)
    .map((l) => ({
      symbol: l.symbol,
      underlying: l.underlying ?? l.symbol,
      lot_size: Number(l.lot_size),
      spot: spots.get(l.symbol)?.spot ?? null,
      spot_date: spots.get(l.symbol)?.date ?? null,
      isIndex: INDEX_SYMBOLS.has(l.symbol),
    }))
    .sort((a, b) => Number(b.isIndex) - Number(a.isIndex) || a.symbol.localeCompare(b.symbol));
}

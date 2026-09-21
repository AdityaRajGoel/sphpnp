import { supabase } from "@/integrations/supabase/client";

/** One open-market insider trade, as the board needs it. */
export type BoardTrade = { symbol: string; category: string | null; transaction: string; mode: string | null; value: number | null };

export type InsiderNet = { symbol: string; bought: number; sold: number; net: number; promoterNet: number; trades: number };

const isPromoter = (c: string | null) => /promoter/i.test(c ?? "");

/**
 * Net insider money per company, open-market trades only: ESOP exercises, gifts
 * and inter-se transfers move shares without anyone judging the price.
 * Returns the biggest net buyers and net sellers, largest first.
 */
export function insiderBoard(trades: BoardTrade[], top = 8): { buying: InsiderNet[]; selling: InsiderNet[] } {
  const bySymbol = new Map<string, InsiderNet>();
  for (const t of trades) {
    if (!t.value || t.value <= 0 || !/^market/i.test(t.mode ?? "")) continue;
    const side = t.transaction === "buy" ? 1 : t.transaction === "sell" ? -1 : 0;
    if (!side) continue;
    const row = bySymbol.get(t.symbol) ?? { symbol: t.symbol, bought: 0, sold: 0, net: 0, promoterNet: 0, trades: 0 };
    if (side > 0) row.bought += t.value; else row.sold += t.value;
    row.net += side * t.value;
    if (isPromoter(t.category)) row.promoterNet += side * t.value;
    row.trades++;
    bySymbol.set(t.symbol, row);
  }
  const all = [...bySymbol.values()];
  return {
    buying: all.filter((r) => r.net > 0).sort((a, b) => b.net - a.net).slice(0, top),
    selling: all.filter((r) => r.net < 0).sort((a, b) => a.net - b.net).slice(0, top),
  };
}

/** Open-market insider trades of the last `days` days, across every tracked stock. */
export async function recentInsiderTrades(days = 30): Promise<BoardTrade[]> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("nse_insider_trades")
    .select("symbol, category, transaction, mode, value")
    .gte("traded_to", since)
    .in("transaction", ["buy", "sell"])
    .ilike("mode", "market%")
    .limit(1000);
  if (error) throw new Error(error.message);
  return (data ?? []) as BoardTrade[];
}

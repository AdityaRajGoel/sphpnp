import { supabase } from "@/integrations/supabase/client";
import { indexValuationHistory } from "@/lib/market-data";
import type { BoardGroup, BoardRow } from "../../supabase/functions/_shared/world-markets";

export type { BoardGroup, BoardRow };
export type WorldBoard = { generated_at: string; groups: Record<BoardGroup, BoardRow[]>; failed: string[] };

/** The world/sector/ETF board. Throws when the function is unreachable so the section can say so. */
export async function getWorldBoard(): Promise<WorldBoard> {
  const { data, error } = await supabase.functions.invoke("fetch-world-markets", { body: {} });
  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error(data?.error ?? "World markets are unavailable");
  return data as WorldBoard;
}

export type ClosePoint = { date: string; close: number };

/** About six months of sessions, the window the regime's rules read. */
const INDEX_SESSIONS = 130;

/**
 * Daily closes for an NSE index by its NSE name ("Nifty FMCG", "India VIX"),
 * from index_valuation_daily - NSE's own file, loaded every evening. Yahoo's
 * ^CNX* symbols stopped resolving, which silently emptied inputs that used them.
 * Empty on failure, so one missing series costs one input, not the section.
 */
export async function getIndexCloses(indexName: string): Promise<ClosePoint[]> {
  const history = await indexValuationHistory(indexName).catch(() => []);
  return history
    .slice(-INDEX_SESSIONS)
    .map((row) => ({ date: row.trade_date, close: Number(row.close) }))
    .filter((p) => Number.isFinite(p.close) && p.close > 0);
}

import { supabase } from "@/integrations/supabase/client";
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

/** Daily closes for one symbol through fetch-stock-chart (indices pass as ^SYMBOL). */
export async function getCloses(symbol: string, range: "3mo" | "6mo" = "6mo"): Promise<ClosePoint[]> {
  const { data, error } = await supabase.functions.invoke("fetch-stock-chart", { body: { symbol, range } });
  if (error || !data?.success) return [];
  return ((data.dataPoints ?? []) as { t: number; c: number }[])
    .filter((p) => Number.isFinite(p.c) && p.c > 0)
    .map((p) => ({ date: new Date(p.t).toISOString().slice(0, 10), close: p.c }));
}

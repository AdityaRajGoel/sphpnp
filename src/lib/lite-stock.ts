/**
 * The lighter stock page: every NSE stock outside the screener universe, from
 * NSE's own data - the securities list (nse_securities) and the daily bhavcopy
 * with delivery (eq_eod). No financial statements; the screener's 750 have those.
 */
import { supabase } from "@/integrations/supabase/client";

export type Security = { symbol: string; name: string; series: string; board: "main" | "sme"; listing_date: string | null; isin: string | null; face_value: number | null };
export type EodBar = { trade_date: string; open: number | null; high: number | null; low: number | null; close: number; prev_close: number | null; volume: number | null; deliv_pct: number | null; turnover_lacs: number | null };

const table = (name: string) => supabase.from(name as never) as ReturnType<typeof supabase.from>;
const n = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));

export async function loadSecurity(symbol: string): Promise<Security | null> {
  const { data, error } = await table("nse_securities").select("symbol,name,series,board,listing_date,isin,face_value").eq("symbol", symbol).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Security | null) ?? null;
}

/** A year of NSE daily bars, oldest first (about 250 rows, under the row cap). */
export async function loadEodHistory(symbol: string): Promise<EodBar[]> {
  const since = new Date(Date.now() - 372 * 86_400_000).toISOString().slice(0, 10);
  const { data, error } = await table("eq_eod").select("trade_date,open,high,low,close,prev_close,volume,deliv_pct,turnover_lacs")
    .eq("symbol", symbol).eq("exchange", "NSE").gte("trade_date", since).order("trade_date").limit(400);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[])
    .map((r) => ({ trade_date: String(r.trade_date), open: n(r.open), high: n(r.high), low: n(r.low), close: Number(r.close), prev_close: n(r.prev_close), volume: n(r.volume), deliv_pct: n(r.deliv_pct), turnover_lacs: n(r.turnover_lacs) }))
    .filter((b) => Number.isFinite(b.close) && b.close > 0);
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Figures for the page, from the bars alone. */
export function summarise(bars: EodBar[]) {
  const last = bars.at(-1) ?? null;
  if (!last) return null;
  const prev = last.prev_close ?? bars.at(-2)?.close ?? null;
  const highs = bars.map((b) => b.high ?? b.close), lows = bars.map((b) => b.low ?? b.close);
  const recent = bars.slice(-21, -1);
  const avgVolume = avg(recent.map((b) => b.volume ?? 0).filter((v) => v > 0));
  return {
    last,
    change: prev ? last.close - prev : null,
    changePct: prev ? ((last.close - prev) / prev) * 100 : null,
    high52: Math.max(...highs),
    low52: Math.min(...lows),
    avgDelivery20: avg(bars.slice(-20).map((b) => b.deliv_pct).filter((v): v is number => v !== null)),
    avgVolume20: avgVolume,
    volumeVsAvg: avgVolume && last.volume ? last.volume / avgVolume : null,
  };
}

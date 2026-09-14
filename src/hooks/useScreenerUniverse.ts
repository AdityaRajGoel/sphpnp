import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { currentStocks, type ScreenerStock } from "@/hooks/useScreenerStocks";
import { getFundamentalsSummaries, type FundamentalsSummary } from "@/lib/screener-fundamentals";
import { getRiskSummaries, type RiskSummary } from "@/lib/screener-risk";
import { getScoreSummaries, type ScoreSummary } from "@/lib/screener-scores";
import { buildMetricRows, type MetricRow } from "@/lib/screener-metrics";

/**
 * The whole tracked universe as joined metric rows, for surfaces that are not
 * the screener: the stock page's research profile and Market Pulse's breadth.
 *
 * Quotes come straight from the cached screener_stocks table rather than the
 * refreshing edge function - these surfaces describe the day, they do not tick.
 * A failing source leaves its part of each row null instead of failing the
 * whole universe, the same rule every per-stock panel follows.
 */
async function loadUniverse(): Promise<Map<string, MetricRow>> {
  const [quotes, fundamentals, risk, scores] = await Promise.all([
    supabase.from("screener_stocks").select("*").then(({ data, error }) => {
      if (error) throw new Error(error.message);
      return currentStocks(((data ?? []) as unknown as ScreenerStock[]).map((s) => ({
        ...s,
        sector: s.sector || "General",
        price: Number(s.price) || 0,
        change_pct: Number(s.change_pct) || 0,
        volume: Number(s.volume) || 0,
        pe: Number(s.pe) || 0,
        market_cap: Number(s.market_cap) || 0,
        high_52: Number(s.high_52) || 0,
        low_52: Number(s.low_52) || 0,
      })));
    }),
    getFundamentalsSummaries().catch(() => new Map<string, FundamentalsSummary>()),
    getRiskSummaries().catch(() => new Map<string, RiskSummary>()),
    getScoreSummaries().catch(() => new Map<string, ScoreSummary>()),
  ]);
  return buildMetricRows(quotes, fundamentals, risk, scores);
}

export function useScreenerUniverse() {
  return useQuery({ queryKey: ["screener-universe"], queryFn: loadUniverse, staleTime: 10 * 60_000 });
}

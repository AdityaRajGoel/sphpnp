import { supabase } from "@/integrations/supabase/client";
import { UNIVERSE_SOURCES, fetchUniverseFile } from "@/lib/universe-file";

/**
 * The screener's composite-score view (stock_fundamental_scores_latest), built
 * from stored statements by sync-fundamental-scores.
 *
 * Units follow the table, and they are mixed: fcf_yield, payout_ratio and the
 * accruals ratio are FRACTIONS (0.05 is 5%), the three-year CAGRs are already
 * percentages. The metric registry converts; nothing else should.
 *
 * A Piotroski score is only meaningful beside the number of criteria that could
 * be tested - 6 of 8 is a different statement from 6 of 9 - so the two always
 * travel together.
 */
export type ScoreSummary = {
  symbol: string;
  period_end: string;
  piotroski_score: number | null;
  piotroski_testable: number | null;
  net_debt_to_equity: number | null;
  accruals_ratio: number | null;
  cash_conversion: number | null;
  capex_intensity: number | null;
  fcf_yield: number | null;
  ev_to_sales: number | null;
  peg: number | null;
  payout_ratio: number | null;
  revenue_cagr_3y: number | null;
  profit_cagr_3y: number | null;
};

export const SCORE_FIELDS = UNIVERSE_SOURCES.scores.select;

export async function getScoreSummaries(): Promise<Map<string, ScoreSummary>> {
  const file = await fetchUniverseFile();
  if (file) return new Map((file.scores as unknown as ScoreSummary[]).map((row) => [row.symbol, row]));
  const { data, error } = await (supabase.from("stock_fundamental_scores_latest" as never) as ReturnType<typeof supabase.from>)
    .select(SCORE_FIELDS)
    .limit(1000);
  if (error) throw new Error(error.message);
  return new Map(((data ?? []) as unknown as ScoreSummary[]).map((row) => [row.symbol, row]));
}

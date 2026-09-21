import { useQuery } from "@tanstack/react-query";
import { FileBarChart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { resultsSummary, type IncomeRow } from "../../../supabase/functions/_shared/results-summary";

/** The latest quarter in one line, against the same quarter a year earlier. */
export default function LatestResults({ symbol }: { symbol: string }) {
  const { data } = useQuery({
    queryKey: ["latest-results", symbol],
    queryFn: async () => {
      const since = new Date(Date.now() - 500 * 86_400_000).toISOString().slice(0, 10);
      const { data, error } = await supabase.from("fundamentals_income" as never)
        .select("period_end,is_consolidated,source,revenue,profit_after_tax")
        .eq("symbol", symbol).gte("period_end", since).limit(60);
      if (error) throw new Error(error.message);
      return resultsSummary((data ?? []) as IncomeRow[]);
    },
    staleTime: 60 * 60_000,
  });
  if (!data) return null;
  const tone = (v: number | null) => (v === null ? "" : v >= 0 ? "text-secondary" : "text-destructive");
  return (
    <p className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border bg-card px-4 py-3 text-sm">
      <FileBarChart className="h-4 w-4 shrink-0 text-secondary" aria-hidden="true" />
      <span className="font-semibold">Latest results · {data.label}</span>
      <span className="text-muted-foreground">({data.basis})</span>
      <span>Revenue {`₹${Math.round(data.revenue / 1e7).toLocaleString("en-IN")} Cr`}{data.revenue_yoy !== null && <b className={`ml-1 ${tone(data.revenue_yoy)}`}>{data.revenue_yoy >= 0 ? "+" : ""}{data.revenue_yoy.toFixed(1)}%</b>}</span>
      {data.profit !== null && <span>Profit {`₹${Math.round(data.profit / 1e7).toLocaleString("en-IN")} Cr`}{data.profit_yoy !== null && <b className={`ml-1 ${tone(data.profit_yoy)}`}>{data.profit_yoy >= 0 ? "+" : ""}{data.profit_yoy.toFixed(1)}%</b>}</span>}
      {data.net_margin !== null && <span>Margin {data.net_margin.toFixed(1)}%</span>}
      <span className="text-xs text-muted-foreground">YoY vs the same quarter last year</span>
    </p>
  );
}

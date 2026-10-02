import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { breadthHistory, indexCloses, shortDate } from "@/lib/market-data";
import { monthlyReturns } from "@/lib/seasonality";
import { heatStep } from "@/lib/sector-heatmap";
import { CHART, EmptyState, SectionHeading, axisTick, divergingFill, tooltipStyle } from "./chart-kit";

const SESSIONS = 120;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** A month moves more than a day: neutral inside ±0.5%, then steps at 2% and 5%. */
const MONTH_CUTS = [0.5, 2, 5] as const;
const dayLabel = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

function AdvanceDeclineChart() {
  const history = useQuery({ queryKey: ["breadth-history", SESSIONS], queryFn: () => breadthHistory(SESSIONS), staleTime: 30 * 60_000 });
  // Declines drawn below zero so each day reads as one bar either side of the axis.
  const data = useMemo(() => (history.data ?? []).map((d) => ({ ...d, below: -d.declines })), [history.data]);

  return (
    <Card className="min-w-0 p-4 sm:p-5">
      <h3 className="font-semibold">Advances and declines, last {SESSIONS} sessions</h3>
      <p className="text-xs text-muted-foreground">Every NSE stock in the EQ and BE series, close against the previous close.</p>
      {history.isLoading ? (
        <Skeleton className="mt-4 h-64 w-full" />
      ) : data.length === 0 ? (
        <div className="mt-4"><EmptyState text="The daily history fills in after the next market-data sync." /></div>
      ) : (
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} stackOffset="sign" barCategoryGap={1} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={CHART.grid} strokeDasharray="3 3" />
              <XAxis dataKey="trade_date" tick={axisTick} tickFormatter={dayLabel} minTickGap={40} tickLine={false} axisLine={false} />
              <YAxis tick={axisTick} tickFormatter={(v: number) => Math.abs(v).toLocaleString("en-IN")} width={44} tickLine={false} axisLine={false} />
              <ReferenceLine y={0} stroke={CHART.axis} />
              <Tooltip
                {...tooltipStyle}
                labelFormatter={(iso: string) => shortDate(iso)}
                formatter={(value: number, name: string) => [Math.abs(value).toLocaleString("en-IN"), name]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} formatter={(label: string) => <span style={{ color: "hsl(var(--foreground))" }}>{label}</span>} />
              <Bar dataKey="advances" name="Advances" stackId="day" fill={CHART.up} maxBarSize={8} isAnimationActive={false} />
              <Bar dataKey="below" name="Declines" stackId="day" fill={CHART.down} maxBarSize={8} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

function MonthlyReturnsGrid() {
  const closes = useQuery({ queryKey: ["index-closes", "Nifty 50"], queryFn: () => indexCloses("Nifty 50"), staleTime: 6 * 60 * 60_000 });
  const returns = useMemo(() => monthlyReturns(closes.data ?? []), [closes.data]);
  const years = [...new Set(returns.map((r) => r.year))].sort((a, b) => b - a);
  const cell = (year: number, month: number) => returns.find((r) => r.year === year && r.month === month);

  return (
    <Card className="min-w-0 p-4 sm:p-5">
      <h3 className="font-semibold">Nifty 50, month by month</h3>
      <p className="text-xs text-muted-foreground">
        Change in the month's last close against the month before. With {returns.length} months of history this shows what happened, not a seasonal pattern.
      </p>
      {closes.isLoading ? (
        <Skeleton className="mt-4 h-40 w-full" />
      ) : returns.length === 0 ? (
        <div className="mt-4"><EmptyState text="Index history is not available right now." /></div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] border-separate border-spacing-0.5 text-xs">
            <caption className="sr-only">Nifty 50 monthly change by year</caption>
            <thead className="text-muted-foreground">
              <tr>
                <th scope="col" className="px-1 py-1 text-left font-medium">Year</th>
                {MONTHS.map((m) => <th key={m} scope="col" className="px-1 py-1 text-center font-medium">{m}</th>)}
              </tr>
            </thead>
            <tbody>
              {years.map((year) => (
                <tr key={year}>
                  <th scope="row" className="px-1 py-1 text-left font-medium tabular-nums">{year}</th>
                  {MONTHS.map((m, month) => {
                    const r = cell(year, month);
                    return (
                      <td
                        key={m}
                        className="rounded-sm px-1 py-1.5 text-center tabular-nums"
                        style={{ background: r ? divergingFill(heatStep(r.pct, MONTH_CUTS)) : undefined }}
                        title={r?.toDate ? "Month to date" : undefined}
                      >
                        {r ? `${r.pct >= 0 ? "+" : ""}${r.pct.toFixed(1)}%${r.toDate ? "*" : ""}` : ""}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted-foreground">* Month to date. Source: NSE index closes.</p>
        </div>
      )}
    </Card>
  );
}

/** Market Pulse: breadth day by day, and the Nifty's months side by side. */
export default function MarketHistorySection() {
  return (
    <section aria-labelledby="market-history" className="scroll-mt-24">
      <SectionHeading id="market-history" title="Breadth and months over time" subtitle="How many stocks rose or fell each day, and how the Nifty 50 moved each month." />
      {/* One above the other: the twelve-month grid needs the full width. */}
      <div className="mt-4 grid gap-4">
        <AdvanceDeclineChart />
        <MonthlyReturnsGrid />
      </div>
    </section>
  );
}

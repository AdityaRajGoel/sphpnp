import { useMemo, useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { Card } from "@/components/ui/card";
import { useStockMarketData } from "@/hooks/useStockMarketData";
import { shortDate } from "@/lib/market-data";
import { CHART, axisTick, tooltipStyle } from "@/components/markets/chart-kit";

const RANGES = [{ label: "3M", days: 63 }, { label: "6M", days: 126 }, { label: "1Y", days: 252 }, { label: "All", days: 10_000 }];

/**
 * The exchange's own record of the stock, day by day: NSE's closing price,
 * how much of each day's volume was taken for delivery rather than traded
 * intraday, and BSE's close beside NSE's.
 */
export default function ExchangeHistory({ symbol }: { symbol: string }) {
  const { data } = useStockMarketData(symbol);
  const [days, setDays] = useState(126);
  const series = useMemo(() => {
    const nse = (data?.eod ?? []).filter((p) => p.exchange === "NSE");
    const bse = new Map((data?.eod ?? []).filter((p) => p.exchange === "BSE").map((p) => [p.trade_date, p.close]));
    return nse.slice(-days).map((p) => ({ date: p.trade_date, close: p.close, bse: bse.get(p.trade_date) ?? null, delivery: p.deliv_pct, volume: p.volume }));
  }, [data, days]);
  if (series.length < 5) return null;
  const last = series[series.length - 1];
  const avgDelivery = series.filter((s) => s.delivery !== null).reduce((a, s, _, arr) => a + s.delivery! / arr.length, 0);

  return (
    <Card className="min-w-0 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
        <div>
          <h2 className="text-xl font-bold">Price &amp; delivery on the exchange</h2>
          <p className="text-xs text-muted-foreground">
            NSE bhavcopy to {shortDate(last.date)} · delivery {last.delivery?.toFixed(1) ?? "—"}% today vs {avgDelivery.toFixed(1)}% average
            {last.bse !== null ? ` · BSE close ₹${last.bse.toLocaleString("en-IN")}` : ""}
          </p>
        </div>
        <div className="flex bg-muted rounded-lg p-1" role="group" aria-label="Range">
          {RANGES.map((r) => (
            <button key={r.label} type="button" aria-pressed={days === r.days} onClick={() => setDays(r.days)}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${days === r.days ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
          <XAxis dataKey="date" tick={axisTick} tickLine={false} axisLine={false} minTickGap={36} tickFormatter={(d: string) => shortDate(d).replace(/ \d{4}$/, "")} />
          <YAxis yAxisId="price" tick={axisTick} tickLine={false} axisLine={false} width={56} domain={["auto", "auto"]} tickFormatter={(v: number) => `₹${v.toLocaleString("en-IN")}`} />
          <YAxis yAxisId="pct" orientation="right" domain={[0, 100]} tick={axisTick} tickLine={false} axisLine={false} width={36} tickFormatter={(v: number) => `${v}%`} />
          <Tooltip {...tooltipStyle} labelFormatter={(d: string) => shortDate(d)}
            formatter={(v: unknown, name: string) => (typeof v !== "number" ? "—" : name === "Delivery" ? `${v.toFixed(1)}%` : `₹${v.toLocaleString("en-IN")}`)} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar yAxisId="pct" dataKey="delivery" name="Delivery" fill={CHART.gold} fillOpacity={0.45} maxBarSize={6} />
          <Line yAxisId="price" dataKey="close" name="NSE close" stroke={CHART.primary} strokeWidth={2} dot={false} connectNulls />
          {series.some((s) => s.bse !== null) && <Line yAxisId="price" dataKey="bse" name="BSE close" stroke={CHART.accent} strokeWidth={1} strokeDasharray="3 3" dot={false} connectNulls />}
        </ComposedChart>
      </ResponsiveContainer>
      <p className="mt-2 text-xs text-muted-foreground">High delivery with a rising price suggests buyers holding rather than trading the move.</p>
    </Card>
  );
}

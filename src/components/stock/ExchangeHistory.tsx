import { useMemo, useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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
      {/* Price and delivery share the x-axis but not a y-axis: one panel each,
          hover linked by syncId. A second y-scale on one plot invents a
          correlation from wherever the two scales happen to line up. */}
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={series} syncId={`exh-${symbol}`} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={CHART.grid} vertical={false} />
          <XAxis dataKey="date" hide />
          <YAxis tick={axisTick} tickLine={false} axisLine={false} width={64} domain={["auto", "auto"]} tickFormatter={(v: number) => `₹${v.toLocaleString("en-IN")}`} />
          <Tooltip {...tooltipStyle} labelFormatter={(d: string) => shortDate(d)}
            formatter={(v: unknown) => (typeof v !== "number" ? "—" : `₹${v.toLocaleString("en-IN")}`)} />
          {/* NSE only: BSE's close tracks it within paise, so a second line just
              muddied the first. The subtitle states the BSE close. */}
          <Line dataKey="close" name="NSE close" stroke={CHART.primary} strokeWidth={2} dot={false} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="mt-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Delivery, % of volume</p>
      <ResponsiveContainer width="100%" height={110}>
        <ComposedChart data={series} syncId={`exh-${symbol}`} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={CHART.grid} vertical={false} />
          <XAxis dataKey="date" tick={axisTick} tickLine={false} axisLine={false} minTickGap={36} tickFormatter={(d: string) => shortDate(d).replace(/ \d{4}$/, "")} />
          <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tick={axisTick} tickLine={false} axisLine={false} width={64} tickFormatter={(v: number) => `${v}%`} />
          <Tooltip {...tooltipStyle} labelFormatter={(d: string) => shortDate(d)}
            formatter={(v: unknown) => (typeof v !== "number" ? "—" : `${v.toFixed(1)}%`)} />
          <Bar dataKey="delivery" name="Delivery" fill={CHART.series[0]} maxBarSize={6} radius={[2, 2, 0, 0]} />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="mt-2 text-xs text-muted-foreground">High delivery with a rising price suggests buyers holding rather than trading the move.</p>
    </Card>
  );
}

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART, axisTick, tooltipStyle } from "@/components/markets/chart-kit";
import { monthTicks } from "@/lib/index-performance";
import { shortDate } from "@/lib/market-data";
import type { EodBar } from "@/lib/lite-stock";

const rupees = (v: number) => `₹${v.toLocaleString("en-IN", { maximumFractionDigits: v < 100 ? 2 : 0 })}`;
const month = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" });

/** A year of daily NSE closes for the lighter stock page. */
export default function LiteStockChart({ bars }: { bars: EodBar[] }) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={bars} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="lite-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART.primary} stopOpacity={0.25} />
              <stop offset="100%" stopColor={CHART.primary} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={CHART.grid} strokeDasharray="3 3" />
          <XAxis dataKey="trade_date" ticks={monthTicks(bars.map((b) => b.trade_date), 6)} tick={axisTick} tickFormatter={month} tickLine={false} axisLine={false} />
          <YAxis domain={["auto", "auto"]} tick={axisTick} tickFormatter={rupees} width={64} tickLine={false} axisLine={false} />
          <Tooltip {...tooltipStyle} labelFormatter={(iso: string) => shortDate(iso)} formatter={(v: number) => [rupees(v), "Close"]} />
          <Area dataKey="close" type="monotone" stroke={CHART.primary} strokeWidth={1.75} fill="url(#lite-fill)" isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

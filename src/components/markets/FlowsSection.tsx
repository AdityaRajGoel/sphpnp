import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { crore, fpiDaily, fpiEquityNet, fpiSectors, macroSeries, shortDate, type FpiRow, type MacroPoint } from "@/lib/market-data";
import { CHART, axisTick, tooltipStyle, SectionHeading, EmptyState } from "./chart-kit";
import SectorFlows from "./SectorFlows";

const signedCr = (v: number | null) => (v === null ? "—" : `${v >= 0 ? "+" : "−"}₹${crore(Math.abs(v))}`);
const month = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" });

function FpiView({ rows }: { rows: FpiRow[] }) {
  const latestDate = rows[0]?.report_date;
  const latest = rows.filter((r) => r.report_date === latestDate);
  const cash = latest.filter((r) => r.section === "cash");
  const derivatives = latest.filter((r) => r.section === "derivatives");
  const history = fpiEquityNet(rows);
  const equity = cash.find((r) => r.category === "Equity" && r.route === "Sub-total");

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="min-w-0 p-4">
        <div className="text-xs text-muted-foreground">Foreign investors in equity, {shortDate(latestDate ?? null)}</div>
        <div className={`text-3xl font-bold tabular-nums mt-1 ${equity?.net_cr !== undefined && equity.net_cr !== null && equity.net_cr >= 0 ? "text-secondary" : "text-destructive"}`}>{signedCr(equity?.net_cr ?? null)}</div>
        <div className="text-xs text-muted-foreground">{equity?.net_usd_mn !== null && equity?.net_usd_mn !== undefined ? `${equity.net_usd_mn >= 0 ? "+" : "−"}$${Math.abs(equity.net_usd_mn).toFixed(1)} million` : ""}</div>
        <table className="w-full text-xs mt-4">
          <caption className="sr-only">Net FPI investment by category and route</caption>
          <thead><tr className="border-b text-muted-foreground"><th className="py-1.5 text-left font-medium">Category</th><th className="py-1.5 text-right font-medium">Bought</th><th className="py-1.5 text-right font-medium">Sold</th><th className="py-1.5 text-right font-medium">Net</th></tr></thead>
          <tbody>
            {cash.filter((r) => r.route === "Sub-total" || r.route === "Total").map((r) => (
              <tr key={`${r.category}|${r.route}`} className="border-b last:border-0">
                <td className="py-1.5">{r.category}</td>
                <td className="py-1.5 text-right tabular-nums">{crore(r.buy_cr)}</td>
                <td className="py-1.5 text-right tabular-nums">{crore(r.sell_cr)}</td>
                <td className={`py-1.5 text-right tabular-nums font-semibold ${r.net_cr !== null && r.net_cr >= 0 ? "text-secondary" : "text-destructive"}`}>{signedCr(r.net_cr)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card className="min-w-0 p-4 lg:col-span-2">
        <h3 className="font-semibold">Daily net FPI investment in equity</h3>
        <p className="text-xs text-muted-foreground mb-3">NSDL, ₹ crore; green is buying, red is selling</p>
        {history.length < 2 ? <EmptyState text="The daily history builds as NSDL publishes each day." /> : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={history} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="date" tick={axisTick} tickLine={false} axisLine={false} minTickGap={24} tickFormatter={(d: string) => shortDate(d).replace(/ \d{4}$/, "")} />
              <YAxis tick={axisTick} tickLine={false} axisLine={false} width={56} tickFormatter={(v: number) => `${(v / 1000).toFixed(1)}K`} />
              <Tooltip {...tooltipStyle} labelFormatter={(d: string) => shortDate(d)} formatter={(v: unknown) => (typeof v === "number" ? signedCr(v) : "—")} />
              <ReferenceLine y={0} stroke={CHART.axis} />
              <Bar dataKey="net_cr" name="Net" maxBarSize={18}>{history.map((h) => <Cell key={h.date} fill={h.net_cr >= 0 ? CHART.up : CHART.down} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
        {derivatives.length > 0 && (
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-xs min-w-[520px]">
              <caption className="text-left text-xs font-semibold pb-1">FPI derivatives, {shortDate(latestDate ?? null)}</caption>
              <thead><tr className="border-b text-muted-foreground"><th className="py-1.5 text-left font-medium">Product</th><th className="py-1.5 text-right font-medium">Bought</th><th className="py-1.5 text-right font-medium">Sold</th><th className="py-1.5 text-right font-medium">Net</th><th className="py-1.5 text-right font-medium">Open interest</th></tr></thead>
              <tbody>
                {derivatives.map((r) => (
                  <tr key={r.category} className="border-b last:border-0">
                    <td className="py-1.5">{r.category}</td>
                    <td className="py-1.5 text-right tabular-nums">{crore(r.buy_cr)}</td>
                    <td className="py-1.5 text-right tabular-nums">{crore(r.sell_cr)}</td>
                    <td className={`py-1.5 text-right tabular-nums ${r.net_cr !== null && r.net_cr >= 0 ? "text-secondary" : "text-destructive"}`}>{signedCr(r.net_cr)}</td>
                    <td className="py-1.5 text-right tabular-nums">{crore(r.oi_cr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

const MACRO: { series: string; title: string; measure: string }[] = [
  { series: "CPI (Combined)", title: "Retail inflation (CPI)", measure: "Year-on-year change in the consumer price index" },
  { series: "WPI (All commodities)", title: "Wholesale inflation (WPI)", measure: "Year-on-year change in the wholesale price index" },
  { series: "IIP (General)", title: "Industrial output (IIP)", measure: "Year-on-year growth in industrial production" },
];

/** Months between a series' latest period and now: a gap past three means the publisher has not released newer figures. */
const monthsBehind = (period: string) => {
  const [y, m] = period.split("-").map(Number);
  const now = new Date();
  return (now.getUTCFullYear() - y) * 12 + (now.getUTCMonth() + 1 - m);
};

function MacroView({ points }: { points: MacroPoint[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {MACRO.map((m) => {
        const data = points.filter((p) => p.series === m.series && p.change_pct !== null).map((p) => ({ period: p.period, change: p.change_pct }));
        const last = data[data.length - 1];
        return (
          <Card key={m.series} className="min-w-0 p-4">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="font-semibold text-sm">{m.title}</h3>
              {last && <span className="text-xs text-muted-foreground">{month(last.period)}</span>}
            </div>
            <div className="text-2xl font-bold tabular-nums">{last?.change !== undefined && last.change !== null ? `${last.change.toFixed(2)}%` : "—"}</div>
            <p className="text-xs text-muted-foreground mb-2">{m.measure}</p>
            {last && monthsBehind(last.period) > 3 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">The latest month MoSPI's data service publishes; newer figures appear once it releases them.</p>
            )}
            {data.length < 2 ? <EmptyState text="Collected monthly from MoSPI." /> : (
              <ResponsiveContainer width="100%" height={120}>
                <LineChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <XAxis dataKey="period" tick={axisTick} tickLine={false} axisLine={false} minTickGap={24} tickFormatter={month} />
                  <YAxis tick={axisTick} tickLine={false} axisLine={false} width={32} tickFormatter={(v: number) => `${v}%`} />
                  <Tooltip {...tooltipStyle} labelFormatter={(d: string) => month(d)} formatter={(v: unknown) => (typeof v === "number" ? `${v.toFixed(2)}%` : "—")} />
                  <ReferenceLine y={0} stroke={CHART.grid} />
                  <Line dataKey="change" name={m.title} stroke={CHART.accent} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>
        );
      })}
    </div>
  );
}

/** Money flows and the economy: NSDL's daily and sector-wise FPI flows, and MoSPI's CPI, WPI and IIP. */
export default function FlowsSection() {
  const fpi = useQuery({ queryKey: ["fpi-daily"], queryFn: () => fpiDaily(90), staleTime: 10 * 60_000 });
  const sectors = useQuery({ queryKey: ["fpi-sectors"], queryFn: fpiSectors, staleTime: 60 * 60_000 });
  const macro = useQuery({ queryKey: ["macro-monthly"], queryFn: macroSeries, staleTime: 60 * 60_000 });
  const hasFpi = useMemo(() => (fpi.data ?? []).length > 0, [fpi.data]);
  return (
    <section id="flows" aria-labelledby="flows-heading" className="scroll-mt-28 space-y-4">
      <SectionHeading id="flows-heading" title="Flows & the economy" subtitle="Foreign portfolio investment from NSDL, daily and by sector each fortnight; inflation and industrial output from MoSPI." />
      {fpi.isLoading ? <Skeleton className="h-60 w-full" /> : hasFpi ? <FpiView rows={fpi.data!} /> : <EmptyState text="FPI flows appear after the first daily collection from NSDL." />}
      {sectors.isLoading ? <Skeleton className="h-80 w-full" /> : (sectors.data ?? []).length > 0 ? <SectorFlows rows={sectors.data!} /> : <EmptyState text="Sector-wise flows appear after the first fortnightly collection from NSDL." />}
      {macro.isLoading ? <Skeleton className="h-40 w-full" /> : <MacroView points={macro.data ?? []} />}
    </section>
  );
}

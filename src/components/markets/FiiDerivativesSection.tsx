import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { segmentItem, segmentTrack } from "@/components/ui/segmented";
import { CHART, SectionHeading, axisTick, tooltipStyle } from "@/components/markets/chart-kit";
import { fiiDerivativesLatest, fiiDerivativesMonthly, shortDate } from "@/lib/market-data";

const INSTRUMENTS = [
  { key: "INDEX FUTURES", label: "Index futures" },
  { key: "STOCK FUTURES", label: "Stock futures" },
  { key: "INDEX OPTIONS", label: "Index options" },
  { key: "STOCK OPTIONS", label: "Stock options" },
] as const;

const crore = (v: number) => `₹${Math.abs(v).toLocaleString("en-IN", { maximumFractionDigits: 0 })} Cr`;
const signed = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${crore(v)}`;
const tone = (v: number) => (v > 0 ? "text-secondary" : v < 0 ? "text-destructive" : "text-muted-foreground");
const monthLabel = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });
const label = (key: string) => INSTRUMENTS.find((i) => i.key === key)?.label ?? key;

/**
 * FII activity in derivatives from NSE's daily FII statistics, kept since Dec
 * 2014: the latest session per instrument, and net buying by month for one
 * instrument at a time (options premiums and futures notionals are not summed).
 */
export default function FiiDerivativesSection() {
  const latest = useQuery({ queryKey: ["fii-deriv-latest"], queryFn: fiiDerivativesLatest, staleTime: 60 * 60_000 });
  const monthly = useQuery({ queryKey: ["fii-deriv-monthly"], queryFn: fiiDerivativesMonthly, staleTime: 6 * 60 * 60_000 });
  const [instrument, setInstrument] = useState<(typeof INSTRUMENTS)[number]["key"]>("INDEX FUTURES");

  const series = useMemo(() => (monthly.data ?? []).filter((m) => m.instrument === instrument), [monthly.data, instrument]);
  const years = useMemo(() => {
    const byYear = new Map<string, number>();
    for (const m of series) byYear.set(m.month.slice(0, 4), (byYear.get(m.month.slice(0, 4)) ?? 0) + m.net_cr);
    return [...byYear.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [series]);
  const yearTicks = useMemo(() => series.filter((m) => m.month.endsWith("-01")).map((m) => m.month).filter((_, i, a) => a.length <= 8 || i % 2 === 0), [series]);
  const day = latest.data?.[0]?.trade_date;

  if (!latest.isLoading && !latest.data?.length) return null;

  return (
    <section aria-labelledby="fii-derivatives" className="mt-10">
      <SectionHeading id="fii-derivatives" title="FIIs in futures and options" subtitle={`NSE's daily FII derivatives statistics${series.length ? `, since ${monthLabel(series[0].month)}` : ""}. Values in ₹ crore; open interest in contracts.`} />

      {latest.isLoading ? <Skeleton className="mt-4 h-40 w-full" /> : (
        <Card className="mt-4 overflow-x-auto p-0">
          <table className="w-full text-sm">
            <caption className="px-4 pt-3 text-left text-xs text-muted-foreground">{day ? shortDate(day) : ""}</caption>
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2.5 text-left font-medium">Instrument</th>
                <th scope="col" className="hidden px-4 py-2.5 text-right font-medium sm:table-cell">Bought</th>
                <th scope="col" className="hidden px-4 py-2.5 text-right font-medium sm:table-cell">Sold</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Net</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Open interest</th>
              </tr>
            </thead>
            <tbody>
              {INSTRUMENTS.map(({ key }) => {
                const r = latest.data?.find((x) => x.instrument === key);
                if (!r) return null;
                const net = r.buy_cr - r.sell_cr;
                return (
                  <tr key={key} className="border-t">
                    <th scope="row" className="px-4 py-2.5 text-left font-normal">{label(key)}</th>
                    <td className="hidden whitespace-nowrap px-4 py-2.5 text-right tabular-nums sm:table-cell">{crore(r.buy_cr)}</td>
                    <td className="hidden whitespace-nowrap px-4 py-2.5 text-right tabular-nums sm:table-cell">{crore(r.sell_cr)}</td>
                    <td className={`whitespace-nowrap px-4 py-2.5 text-right font-semibold tabular-nums ${tone(net)}`}>{signed(net)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">{r.oi_contracts.toLocaleString("en-IN")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold">Net by month: {label(instrument).toLowerCase()}</h3>
        <div role="group" aria-label="Instrument" className={`${segmentTrack} max-w-full overflow-x-auto`}>
          {INSTRUMENTS.map((i) => <button key={i.key} type="button" aria-pressed={instrument === i.key} className={segmentItem(instrument === i.key)} onClick={() => setInstrument(i.key)}>{i.label}</button>)}
        </div>
      </div>
      {monthly.isLoading ? <Skeleton className="mt-3 h-72 w-full" /> : (
        <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_16rem]">
          <Card className="min-w-0 p-4 sm:p-5">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} stroke={CHART.grid} strokeDasharray="3 3" />
                  <XAxis dataKey="month" ticks={yearTicks} tick={axisTick} tickFormatter={(m: string) => m.slice(0, 4)} tickLine={false} axisLine={false} />
                  <YAxis tick={axisTick} tickFormatter={(v: number) => `${(v / 1000).toLocaleString("en-IN")}k`} width={48} tickLine={false} axisLine={false} />
                  <ReferenceLine y={0} stroke={CHART.axis} />
                  <Tooltip {...tooltipStyle} labelFormatter={(m: string) => monthLabel(m)} formatter={(v: number) => [signed(v), "FII net"]} />
                  <Bar dataKey="net_cr" isAnimationActive={false}>
                    {series.map((m) => <Cell key={m.month} fill={m.net_cr >= 0 ? CHART.up : CHART.down} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card className="max-h-[21rem] overflow-auto p-0">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted text-xs text-muted-foreground">
                <tr><th scope="col" className="px-4 py-2 text-left font-medium">Year</th><th scope="col" className="px-4 py-2 text-right font-medium">FII net</th></tr>
              </thead>
              <tbody>
                {years.map(([y, net]) => (
                  <tr key={y} className="border-t">
                    <th scope="row" className="px-4 py-2 text-left font-normal">{y}</th>
                    <td className={`whitespace-nowrap px-4 py-2 text-right font-semibold tabular-nums ${tone(net)}`}>{signed(net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </section>
  );
}

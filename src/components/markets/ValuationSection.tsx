import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Area, CartesianGrid, ComposedChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowUpDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  indexConstituents, indexOrder, indexValuationHistory, latestIndexValuations, shortDate, trackedSymbols, valuationStats,
  type IndexValuation,
} from "@/lib/market-data";
import { CHART, axisTick, tooltipStyle, SectionHeading, EmptyState } from "./chart-kit";

type Metric = "pe" | "pb" | "div_yield";
const METRIC_LABEL: Record<Metric, string> = { pe: "P/E", pb: "P/B", div_yield: "Dividend yield" };
const ZONE_STYLE = {
  expensive: "bg-destructive/10 text-destructive border-destructive/30",
  fair: "bg-muted text-foreground border-border",
  cheap: "bg-secondary/10 text-secondary border-secondary/30",
};
const fmt = (v: number | null, metric: Metric) => (v === null ? "—" : metric === "div_yield" ? `${v.toFixed(2)}%` : v.toFixed(2));

/**
 * "Is the market expensive?": an index's P/E, P/B or dividend yield over time
 * against its own average and one standard deviation either side, every
 * NSE index's valuation today, and the stocks in the selected index.
 */
export default function ValuationSection() {
  const [index, setIndex] = useState("Nifty 50");
  const [metric, setMetric] = useState<Metric>("pe");
  const [sortKey, setSortKey] = useState<"index_name" | Metric | "change_pct">("index_name");
  const [asc, setAsc] = useState(true);

  const latest = useQuery({ queryKey: ["index-valuation-latest"], queryFn: latestIndexValuations, staleTime: 10 * 60_000 });
  const history = useQuery({ queryKey: ["index-valuation", index], queryFn: () => indexValuationHistory(index), staleTime: 10 * 60_000 });
  const members = useQuery({ queryKey: ["index-constituents", index], queryFn: () => indexConstituents(index), staleTime: 60 * 60_000 });
  const tracked = useQuery({ queryKey: ["tracked-symbols"], queryFn: trackedSymbols, staleTime: 60 * 60_000 });

  const points = useMemo(() => history.data ?? [], [history.data]);
  const stats = useMemo(() => valuationStats(points.map((p) => p[metric]), metric === "div_yield"), [points, metric]);
  const chartData = points.map((p) => ({ date: p.trade_date, value: p[metric], close: p.close }));

  const table = useMemo(() => {
    const rows = [...(latest.data ?? [])].filter((r) => r.pe !== null || r.pb !== null);
    return rows.sort((a, b) => {
      if (sortKey === "index_name") return (asc ? 1 : -1) * indexOrder(a.index_name, b.index_name);
      const va = a[sortKey] ?? -Infinity;
      const vb = b[sortKey] ?? -Infinity;
      return asc ? va - vb : vb - va;
    });
  }, [latest.data, sortKey, asc]);

  const sortBy = (key: typeof sortKey) => { if (key === sortKey) setAsc(!asc); else { setSortKey(key); setAsc(key === "index_name"); } };
  const selected = latest.data?.find((r) => r.index_name === index);

  return (
    <section id="valuation" aria-labelledby="valuation-heading" className="scroll-mt-28 space-y-4">
      <SectionHeading id="valuation-heading" title="Is the market expensive?" subtitle="Index valuations from NSE's daily index file, against each index's own history." />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="min-w-0 p-4 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="min-w-0">
              <h3 className="font-semibold truncate">{index} · {METRIC_LABEL[metric]}</h3>
              <p className="text-xs text-muted-foreground">
                {points.length > 0 ? `${shortDate(points[0].trade_date)} to ${shortDate(points[points.length - 1].trade_date)} · band is the average ± 1 standard deviation` : "History fills in as the daily file is collected"}
              </p>
            </div>
            <div className="flex bg-muted rounded-lg p-1" role="group" aria-label="Valuation measure">
              {(Object.keys(METRIC_LABEL) as Metric[]).map((m) => (
                <button key={m} type="button" aria-pressed={metric === m} onClick={() => setMetric(m)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${metric === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                  {METRIC_LABEL[m]}
                </button>
              ))}
            </div>
          </div>
          {history.isLoading ? <Skeleton className="h-[280px] w-full" /> : chartData.length < 2 ? (
            <EmptyState text="The valuation history is being collected from NSE's archive; the chart appears once a few days are stored." />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="date" tick={axisTick} tickLine={false} axisLine={false} minTickGap={40} tickFormatter={(d: string) => shortDate(d).replace(/^\d+ /, "")} />
                <YAxis tick={axisTick} tickLine={false} axisLine={false} width={44} domain={["auto", "auto"]} />
                <Tooltip {...tooltipStyle} labelFormatter={(d: string) => shortDate(d)} formatter={(v: unknown) => (typeof v === "number" ? fmt(v, metric) : "—")} />
                {stats && (
                  <>
                    <ReferenceLine y={stats.mean + stats.sd} stroke={metric === "div_yield" ? CHART.up : CHART.down} strokeDasharray="4 4" label={{ value: "+1σ", fill: CHART.axis, fontSize: 10, position: "insideTopLeft" }} />
                    <ReferenceLine y={stats.mean} stroke={CHART.axis} strokeDasharray="2 4" label={{ value: "avg", fill: CHART.axis, fontSize: 10, position: "insideTopLeft" }} />
                    <ReferenceLine y={stats.mean - stats.sd} stroke={metric === "div_yield" ? CHART.down : CHART.up} strokeDasharray="4 4" label={{ value: "−1σ", fill: CHART.axis, fontSize: 10, position: "insideBottomLeft" }} />
                  </>
                )}
                <Area dataKey="value" name={METRIC_LABEL[metric]} stroke={CHART.primary} fill={CHART.primary} fillOpacity={0.08} strokeWidth={2} dot={false} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="min-w-0 p-4 space-y-4">
          <div>
            <div className="text-xs text-muted-foreground">{index} today{selected ? ` · ${shortDate(selected.trade_date)}` : ""}</div>
            <div className="text-3xl font-bold tabular-nums mt-1">{fmt(stats?.current ?? selected?.[metric] ?? null, metric)}</div>
            {stats && (
              <span className={`inline-block mt-2 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${ZONE_STYLE[stats.zone]}`}>
                {stats.zone[0].toUpperCase() + stats.zone.slice(1)} vs its history
              </span>
            )}
          </div>
          {stats ? (
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-xs text-muted-foreground">Average</dt><dd className="font-semibold tabular-nums">{fmt(stats.mean, metric)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Higher than</dt><dd className="font-semibold tabular-nums">{stats.percentile.toFixed(0)}% of days</dd></div>
              <div><dt className="text-xs text-muted-foreground">Low</dt><dd className="font-semibold tabular-nums">{fmt(stats.min, metric)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">High</dt><dd className="font-semibold tabular-nums">{fmt(stats.max, metric)}</dd></div>
            </dl>
          ) : <p className="text-xs text-muted-foreground">The reading needs at least 20 trading days of history.</p>}
          {selected && (
            <dl className="grid grid-cols-3 gap-2 border-t pt-3 text-sm">
              <div><dt className="text-xs text-muted-foreground">P/E</dt><dd className="font-semibold tabular-nums">{fmt(selected.pe, "pe")}</dd></div>
              <div><dt className="text-xs text-muted-foreground">P/B</dt><dd className="font-semibold tabular-nums">{fmt(selected.pb, "pb")}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Yield</dt><dd className="font-semibold tabular-nums">{fmt(selected.div_yield, "div_yield")}</dd></div>
            </dl>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="min-w-0 p-0 overflow-hidden lg:col-span-2">
          <div className="max-h-[440px] overflow-auto">
            <table className="w-full text-sm min-w-[560px]">
              <caption className="sr-only">Every NSE index's valuation on the latest trading day; choose an index to chart it</caption>
              <thead className="sticky top-0 bg-card z-10">
                <tr className="border-b text-left">
                  {([["index_name", "Index"], ["change_pct", "Change"], ["pe", "P/E"], ["pb", "P/B"], ["div_yield", "Yield"]] as const).map(([key, label]) => (
                    <th key={key} scope="col" className={`p-3 font-medium ${key === "index_name" ? "" : "text-right"}`}>
                      <button type="button" onClick={() => sortBy(key)} className="inline-flex items-center gap-1 hover:text-foreground text-muted-foreground">
                        {label} <ArrowUpDown className="w-3 h-3" aria-hidden="true" />
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {latest.isLoading && <tr><td colSpan={5} className="p-3"><Skeleton className="h-6 w-full" /></td></tr>}
                {table.map((r: IndexValuation) => (
                  <tr key={r.index_name} className={`border-b last:border-0 cursor-pointer transition-colors ${r.index_name === index ? "bg-primary/5" : "hover:bg-muted/40"}`} onClick={() => setIndex(r.index_name)}>
                    <td className="p-3">
                      <button type="button" className="text-left font-medium hover:text-primary focus-visible:outline-none focus-visible:underline" onClick={() => setIndex(r.index_name)} aria-pressed={r.index_name === index}>
                        {r.index_name}
                      </button>
                    </td>
                    <td className={`p-3 text-right tabular-nums ${r.change_pct === null ? "text-muted-foreground" : r.change_pct >= 0 ? "text-secondary" : "text-destructive"}`}>
                      {r.change_pct === null ? "—" : `${r.change_pct >= 0 ? "+" : ""}${r.change_pct.toFixed(2)}%`}
                    </td>
                    <td className="p-3 text-right tabular-nums">{fmt(r.pe, "pe")}</td>
                    <td className="p-3 text-right tabular-nums">{fmt(r.pb, "pb")}</td>
                    <td className="p-3 text-right tabular-nums">{fmt(r.div_yield, "div_yield")}</td>
                  </tr>
                ))}
                {!latest.isLoading && table.length === 0 && <tr><td colSpan={5}><EmptyState text="Index valuations appear after the first nightly collection." /></td></tr>}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="min-w-0 p-4">
          <h3 className="font-semibold text-sm mb-1">Stocks in {index}</h3>
          <p className="text-xs text-muted-foreground mb-3">{members.data?.length ? `${members.data.length} constituents, from niftyindices.com` : "Constituent lists are published for the main NSE indices."}</p>
          <div className="max-h-[360px] overflow-auto">
            <ul className="flex flex-wrap gap-1.5">
              {(members.data ?? []).map((m) => (
                <li key={m.symbol}>
                  {tracked.data?.has(m.symbol) ? (
                    <Link to={`/stock/${encodeURIComponent(m.symbol)}`} title={[m.company, m.industry].filter(Boolean).join(" · ")}
                      className="inline-block rounded-md border px-2 py-0.5 text-xs font-medium hover:border-primary hover:text-primary transition-colors">
                      {m.symbol}
                    </Link>
                  ) : (
                    <span title={[m.company, m.industry].filter(Boolean).join(" · ")} className="inline-block rounded-md border border-dashed px-2 py-0.5 text-xs text-muted-foreground">{m.symbol}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>
    </section>
  );
}

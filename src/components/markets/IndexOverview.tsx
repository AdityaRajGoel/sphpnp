import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { segmentItem, segmentTrack } from "@/components/ui/segmented";
import { loadIndexHistory } from "@/lib/market-lists";
import { shortDate, valuationStats } from "@/lib/market-data";
import { monthTicks, trailingReturns, yearRange } from "@/lib/index-performance";
import { CHART, EmptyState, axisTick, tooltipStyle } from "./chart-kit";

export type IndexMover = { symbol: string; name: string; change_pct: number | null; linked: boolean };

const RANGES = [{ key: "6M", days: 182 }, { key: "1Y", days: 365 }, { key: "All", days: Infinity }] as const;
type RangeKey = (typeof RANGES)[number]["key"];

const pct = (v: number | null) => (v === null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`);
const tone = (v: number | null) => (v === null ? "text-muted-foreground" : v >= 0 ? "text-secondary" : "text-destructive");
const level = (v: number) => v.toLocaleString("en-IN", { maximumFractionDigits: 2 });
const monthLabel = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" });

function MoverList({ title, movers }: { title: string; movers: IndexMover[] }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      <ol className="mt-2 divide-y">
        {movers.map((m) => (
          <li key={m.symbol} className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
            {m.linked
              ? <Link to={`/stock/${encodeURIComponent(m.symbol)}`} className="truncate hover:text-secondary hover:underline underline-offset-4">{m.name}</Link>
              : <span className="truncate">{m.name}</span>}
            <span className={`shrink-0 tabular-nums font-medium ${tone(m.change_pct)}`}>{pct(m.change_pct)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * The index itself, above its constituents: level, returns, 52-week range, a
 * price chart and its P/E against its own history, from NSE's daily index file
 * (index_valuation_daily), plus today's biggest movers inside it.
 */
export default function IndexOverview({ indexName, title, movers }: { indexName: string; title: string; movers: IndexMover[] }) {
  const history = useQuery({ queryKey: ["index-history", indexName], queryFn: () => loadIndexHistory(indexName), staleTime: 60 * 60_000 });
  const [range, setRange] = useState<RangeKey>("1Y");

  const days = useMemo(() => history.data ?? [], [history.data]);
  const returns = useMemo(() => trailingReturns(days), [days]);
  const yr = useMemo(() => yearRange(days), [days]);
  const pe = useMemo(() => valuationStats(days.map((d) => d.pe)), [days]);
  const last = days.filter((d) => d.close !== null).at(-1);
  const prev = days.filter((d) => d.close !== null).at(-2);
  const dayPct = last?.close && prev?.close ? (last.close / prev.close - 1) * 100 : null;

  const series = useMemo(() => {
    const span = RANGES.find((r) => r.key === range)!.days;
    if (!last || !Number.isFinite(span)) return days;
    const cutoff = new Date(Date.parse(`${last.trade_date}T00:00:00Z`) - span * 86_400_000).toISOString().slice(0, 10);
    return days.filter((d) => d.trade_date >= cutoff);
  }, [days, range, last]);

  const ranked = movers.filter((m) => m.change_pct !== null).sort((a, b) => b.change_pct! - a.change_pct!);
  const gainers = ranked.filter((m) => m.change_pct! > 0).slice(0, 5);
  const losers = ranked.filter((m) => m.change_pct! < 0).reverse().slice(0, 5);

  if (history.isLoading) return <Skeleton className="mt-6 h-[28rem] w-full" />;
  if (!last?.close) return <div className="mt-6"><EmptyState text={`No daily closes stored for the ${title} yet.`} /></div>;

  const position = yr && yr.high > yr.low ? ((yr.last - yr.low) / (yr.high - yr.low)) * 100 : 50;

  return (
    <section aria-labelledby="index-overview" className="mt-6 space-y-4">
      <h2 id="index-overview" className="sr-only">{title} today</h2>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-1">
          <p className="text-sm text-muted-foreground">{title} · close {shortDate(last.trade_date)}</p>
          <p className="mt-1 text-4xl font-bold tabular-nums tracking-tight">{level(last.close)}</p>
          <p className={`mt-1 text-lg font-semibold tabular-nums ${tone(dayPct)}`}>{pct(dayPct)} <span className="text-sm font-normal text-muted-foreground">on the day</span></p>

          {yr && (
            <div className="mt-5">
              <div className="flex justify-between text-xs text-muted-foreground"><span>52-week low</span><span>52-week high</span></div>
              <div className="relative mt-1.5 h-1.5 rounded-full bg-muted" role="img" aria-label={`Close sits ${position.toFixed(0)}% of the way from the 52-week low to the high`}>
                <span className="absolute top-1/2 h-3.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-foreground" style={{ left: `${position}%` }} />
              </div>
              <div className="mt-1.5 flex justify-between text-sm tabular-nums">
                <span title={shortDate(yr.lowDate)}>{level(yr.low)}</span>
                <span title={shortDate(yr.highDate)}>{level(yr.high)}</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {yr.fromHigh > -0.05 ? "At its 52-week high." : `${Math.abs(yr.fromHigh).toFixed(1)}% below the 52-week high of ${shortDate(yr.highDate)}.`}
              </p>
            </div>
          )}

          <dl className="mt-5 grid grid-cols-3 gap-2 border-t pt-4 text-sm">
            <div><dt className="text-xs text-muted-foreground">P/E</dt><dd className="font-semibold tabular-nums">{last.pe?.toFixed(2) ?? "—"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">P/B</dt><dd className="font-semibold tabular-nums">{last.pb?.toFixed(2) ?? "—"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Div. yield</dt><dd className="font-semibold tabular-nums">{last.div_yield ? `${last.div_yield.toFixed(2)}%` : "—"}</dd></div>
          </dl>
        </Card>

        <Card className="min-w-0 p-4 sm:p-5 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-semibold">{title} closing level</h3>
            <div role="group" aria-label="Chart range" className={segmentTrack}>
              {RANGES.map((r) => (
                <button key={r.key} type="button" aria-pressed={range === r.key} className={segmentItem(range === r.key)} onClick={() => setRange(r.key)}>{r.key}</button>
              ))}
            </div>
          </div>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="index-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART.primary} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={CHART.primary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={CHART.grid} strokeDasharray="3 3" />
                <XAxis dataKey="trade_date" ticks={monthTicks(series.map((d) => d.trade_date))} tick={axisTick} tickFormatter={monthLabel} tickLine={false} axisLine={false} />
                <YAxis domain={["auto", "auto"]} tick={axisTick} tickFormatter={(v: number) => v.toLocaleString("en-IN", { maximumFractionDigits: 0 })} width={56} tickLine={false} axisLine={false} />
                <Tooltip {...tooltipStyle} labelFormatter={(iso: string) => shortDate(iso)} formatter={(v: number) => [level(v), "Close"]} />
                <Area dataKey="close" type="monotone" stroke={CHART.primary} strokeWidth={2} fill="url(#index-fill)" connectNulls isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6" aria-label="Returns">
            {returns.map((r) => (
              <li key={r.key} className="rounded-md border px-2 py-1.5 text-center">
                <span className="block text-[0.6875rem] text-muted-foreground">{r.label}</span>
                <span className={`block text-sm font-semibold tabular-nums ${tone(r.pct)}`}>{pct(r.pct)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {pe && (
          <Card className="min-w-0 p-4 sm:p-5 lg:col-span-2">
            <h3 className="font-semibold">P/E ratio since {shortDate(days[0].trade_date)}</h3>
            <p className="text-sm text-muted-foreground">
              {pe.current.toFixed(2)} today, higher than on {pe.percentile.toFixed(0)}% of earlier trading days. Range {pe.min.toFixed(1)}–{pe.max.toFixed(1)}, average {pe.mean.toFixed(1)}.
            </p>
            <div className="mt-4 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={days} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} stroke={CHART.grid} strokeDasharray="3 3" />
                  <XAxis dataKey="trade_date" ticks={monthTicks(days.map((d) => d.trade_date))} tick={axisTick} tickFormatter={monthLabel} tickLine={false} axisLine={false} />
                  <YAxis domain={["auto", "auto"]} tick={axisTick} width={40} tickLine={false} axisLine={false} />
                  <ReferenceLine y={pe.mean} stroke={CHART.muted} strokeDasharray="4 4" label={{ value: "average", fill: CHART.axis, fontSize: 11, position: "insideTopRight" }} />
                  <Tooltip {...tooltipStyle} labelFormatter={(iso: string) => shortDate(iso)} formatter={(v: number) => [v.toFixed(2), "P/E"]} />
                  <Line dataKey="pe" type="monotone" stroke={CHART.accent} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}
        {(gainers.length > 0 || losers.length > 0) && (
          <Card className={`p-4 sm:p-5 ${pe ? "" : "lg:col-span-3"}`}>
            <h3 className="font-semibold">Biggest moves inside the index</h3>
            <p className="text-xs text-muted-foreground">Latest session, from each stock's last quote.</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              {gainers.length > 0 && <MoverList title="Up most" movers={gainers} />}
              {losers.length > 0 && <MoverList title="Down most" movers={losers} />}
            </div>
          </Card>
        )}
      </div>
    </section>
  );
}

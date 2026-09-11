import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { GLOBAL_TICKERS, type GlobalTicker } from "../../../supabase/functions/_shared/eodhd";
import { globalMarkets, shortDate, summariseGlobal, type GlobalSummary } from "@/lib/market-data";
import { CHART, axisTick, tooltipStyle, SectionHeading, EmptyState } from "./chart-kit";

const GROUPS: GlobalTicker["group"][] = ["US", "Europe", "Asia", "Currency", "Commodity", "Crypto"];

const price = (v: number, unit: GlobalTicker["unit"]) =>
  unit === "rupees" ? `₹${v.toFixed(2)}` : unit === "dollars" ? `$${v.toLocaleString("en-US", { maximumFractionDigits: v < 100 ? 2 : 0 })}` : v.toLocaleString("en-IN", { maximumFractionDigits: 2 });
const pct = (v: number | null) => (v === null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`);
const tone = (v: number | null) => (v === null ? "text-muted-foreground" : v >= 0 ? "text-secondary" : "text-destructive");

function Spark({ values, up }: { values: number[]; up: boolean }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const points = values.map((v, i) => `${(i / (values.length - 1)) * 100},${max === min ? 50 : 100 - ((v - min) / (max - min)) * 100}`).join(" ");
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-8 w-full" aria-hidden="true">
      <polyline points={points} fill="none" stroke={up ? CHART.up : CHART.down} strokeWidth="3" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/**
 * How the rest of the world closed before India opens: US, European and
 * Asian indices, the rupee and the dollar, gold, silver, oil and bitcoin.
 * End-of-day closes, collected each weekday morning.
 */
export default function GlobalCuesSection() {
  const { data, isLoading } = useQuery({ queryKey: ["global-markets"], queryFn: globalMarkets, staleTime: 30 * 60_000 });
  const [selected, setSelected] = useState("GSPC.INDX");
  const summaries = useMemo(() => new Map(GLOBAL_TICKERS.map((t) => [t.ticker, summariseGlobal(data ?? [], t.ticker)])), [data]);
  const pick = GLOBAL_TICKERS.find((t) => t.ticker === selected) ?? GLOBAL_TICKERS[0];
  const series = (data ?? []).filter((b) => b.ticker === pick.ticker).map((b) => ({ date: b.trade_date, close: b.close }));
  const chosen = summaries.get(pick.ticker);
  const latest = [...summaries.values()].filter((s): s is GlobalSummary => s !== null).map((s) => s.date).sort().pop();

  return (
    <section id="global" aria-labelledby="global-heading" className="scroll-mt-28 space-y-4">
      <SectionHeading id="global-heading" title="Global cues" subtitle={`How world markets, the rupee and commodities closed${latest ? ` · to ${shortDate(latest)}` : ""}. Click one to chart its year.`} />
      {isLoading ? <Skeleton className="h-64 w-full" /> : (data ?? []).length === 0 ? (
        <EmptyState text="Global markets are collected each weekday morning." />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="min-w-0 space-y-4 lg:col-span-2">
            {GROUPS.map((group) => {
              const tickers = GLOBAL_TICKERS.filter((t) => t.group === group);
              return (
                <div key={group}>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{group}</h3>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {tickers.map((t) => {
                      const s = summaries.get(t.ticker);
                      return (
                        <button key={t.ticker} type="button" onClick={() => setSelected(t.ticker)} aria-pressed={selected === t.ticker}
                          className={`min-w-0 rounded-xl border bg-card p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected === t.ticker ? "border-primary ring-1 ring-primary/40" : "hover:border-primary/40"}`}>
                          <div className="truncate text-xs font-semibold text-muted-foreground">{t.name}</div>
                          {s ? (
                            <>
                              <div className="mt-0.5 flex items-baseline justify-between gap-2">
                                <span className="truncate text-base font-bold tabular-nums">{price(s.close, t.unit)}</span>
                                <span className={`text-xs font-semibold tabular-nums ${tone(s.day)}`}>{pct(s.day)}</span>
                              </div>
                              <Spark values={s.spark} up={(s.spark[s.spark.length - 1] ?? 0) >= (s.spark[0] ?? 0)} />
                            </>
                          ) : <div className="text-sm text-muted-foreground">Awaiting data</div>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <Card className="min-w-0 p-4">
            <h3 className="font-semibold">{pick.name}</h3>
            {chosen && (
              <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
                <div><dt className="text-xs text-muted-foreground">1 day</dt><dd className={`font-semibold tabular-nums ${tone(chosen.day)}`}>{pct(chosen.day)}</dd></div>
                <div><dt className="text-xs text-muted-foreground">1 month</dt><dd className={`font-semibold tabular-nums ${tone(chosen.month)}`}>{pct(chosen.month)}</dd></div>
                <div><dt className="text-xs text-muted-foreground">1 year</dt><dd className={`font-semibold tabular-nums ${tone(chosen.year)}`}>{pct(chosen.year)}</dd></div>
              </dl>
            )}
            {series.length < 2 ? <EmptyState text="History appears after the first collection." /> : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={series} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                  <XAxis dataKey="date" tick={axisTick} tickLine={false} axisLine={false} minTickGap={40} tickFormatter={(d: string) => shortDate(d).replace(/^\d+ /, "")} />
                  <YAxis tick={axisTick} tickLine={false} axisLine={false} width={56} domain={["auto", "auto"]} tickFormatter={(v: number) => v.toLocaleString("en-IN", { maximumFractionDigits: 0 })} />
                  <Tooltip {...tooltipStyle} labelFormatter={(d: string) => shortDate(d)} formatter={(v: unknown) => (typeof v === "number" ? price(v, pick.unit) : "—")} />
                  <Area dataKey="close" name={pick.name} stroke={(chosen?.year ?? 0) >= 0 ? CHART.up : CHART.down} fill={(chosen?.year ?? 0) >= 0 ? CHART.up : CHART.down} fillOpacity={0.1} strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
            <p className="mt-2 text-xs text-muted-foreground">End-of-day closes. Brent is tracked through the BNO ETF.</p>
          </Card>
        </div>
      )}
    </section>
  );
}

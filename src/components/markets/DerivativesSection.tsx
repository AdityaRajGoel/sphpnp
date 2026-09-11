import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { lakhs, latestFoChain, latestFoSnapshots, latestOptionChains, longShare, net, participantOi, pctChange, shortDate, trackedSymbols, type FoSnapshot, type OptionChainEod, type ParticipantOi } from "@/lib/market-data";
import { CHART, axisTick, tooltipStyle, SectionHeading, EmptyState } from "./chart-kit";
import FoBuildUp, { BuildUpBadge } from "./FoBuildUp";

const PARTICIPANTS = ["FII", "DII", "Pro", "Client"];
const PARTICIPANT_LABEL: Record<string, string> = { FII: "Foreign institutions", DII: "Domestic institutions", Pro: "Proprietary traders", Client: "Retail & other clients" };

function Positioning({ rows }: { rows: ParticipantOi[] }) {
  const latestDate = rows[0]?.trade_date;
  const latest = rows.filter((r) => r.trade_date === latestDate);
  const history = useMemo(() => {
    const dates = [...new Set(rows.map((r) => r.trade_date))].sort();
    return dates.map((d) => {
      const fii = rows.find((r) => r.trade_date === d && r.client_type === "FII");
      return { date: d, net: fii ? net(fii.fut_idx_long, fii.fut_idx_short) : null, longPct: fii ? longShare(fii.fut_idx_long, fii.fut_idx_short) : null };
    });
  }, [rows]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="min-w-0 p-4 lg:col-span-2">
        <h3 className="font-semibold">Who is long and short index futures</h3>
        <p className="text-xs text-muted-foreground mb-3">Open contracts by participant on {shortDate(latestDate ?? null)} (NSE participant-wise open interest)</p>
        <ul className="space-y-3">
          {PARTICIPANTS.map((p) => {
            const r = latest.find((x) => x.client_type === p);
            if (!r) return null;
            const share = longShare(r.fut_idx_long, r.fut_idx_short);
            const netIdx = net(r.fut_idx_long, r.fut_idx_short);
            return (
              <li key={p}>
                <div className="flex flex-wrap justify-between gap-2 text-sm mb-1">
                  <span className="font-medium">{PARTICIPANT_LABEL[p]}</span>
                  <span className="tabular-nums text-muted-foreground">
                    Long {lakhs(r.fut_idx_long)} · Short {lakhs(r.fut_idx_short)} ·{" "}
                    <strong className={netIdx !== null && netIdx >= 0 ? "text-secondary" : "text-destructive"}>
                      net {netIdx !== null && netIdx >= 0 ? "long" : "short"} {lakhs(netIdx === null ? null : Math.abs(netIdx))}
                    </strong>
                  </span>
                </div>
                <div className="flex h-3 rounded-full overflow-hidden bg-muted" role="img" aria-label={`${PARTICIPANT_LABEL[p]}: ${share?.toFixed(0) ?? "?"}% of index futures long`}>
                  <div className="bg-secondary" style={{ width: `${share ?? 0}%` }} />
                  <div className="bg-destructive/70 flex-1" />
                </div>
              </li>
            );
          })}
        </ul>
        {latest.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-xs min-w-[620px]">
              <caption className="sr-only">All positions by participant</caption>
              <thead><tr className="border-b text-muted-foreground">
                <th className="p-2 text-left font-medium">Participant</th>
                <th className="p-2 text-right font-medium">Stock fut. long</th><th className="p-2 text-right font-medium">Stock fut. short</th>
                <th className="p-2 text-right font-medium">Index calls long</th><th className="p-2 text-right font-medium">Index puts long</th>
                <th className="p-2 text-right font-medium">Index calls short</th><th className="p-2 text-right font-medium">Index puts short</th>
              </tr></thead>
              <tbody>
                {latest.map((r) => (
                  <tr key={r.client_type} className="border-b last:border-0">
                    <td className="p-2 font-medium">{r.client_type}</td>
                    {[r.fut_stk_long, r.fut_stk_short, r.opt_idx_call_long, r.opt_idx_put_long, r.opt_idx_call_short, r.opt_idx_put_short].map((v, i) => (
                      <td key={i} className="p-2 text-right tabular-nums">{lakhs(v)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Card className="min-w-0 p-4">
        <h3 className="font-semibold">Foreign institutions' index futures</h3>
        <p className="text-xs text-muted-foreground mb-3">Share of their index-futures positions that are long, by day</p>
        {history.length < 2 ? <EmptyState text="The history builds up day by day." /> : (
          <ResponsiveContainer width="100%" height={230}>
            <LineChart data={history} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="date" tick={axisTick} tickLine={false} axisLine={false} minTickGap={30} tickFormatter={(d: string) => shortDate(d).replace(/ \d{4}$/, "")} />
              <YAxis domain={[0, 100]} tick={axisTick} tickLine={false} axisLine={false} width={36} tickFormatter={(v: number) => `${v}%`} />
              <Tooltip {...tooltipStyle} labelFormatter={(d: string) => shortDate(d)} formatter={(v: unknown) => (typeof v === "number" ? `${v.toFixed(1)}% long` : "—")} />
              <ReferenceLine y={50} stroke={CHART.axis} strokeDasharray="3 3" />
              <Line dataKey="longPct" name="Long share" stroke={CHART.primary} strokeWidth={2} dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
}

type ChainProps = { chains: OptionChainEod[]; snapshots: FoSnapshot[]; symbol: string; onSymbol: (symbol: string) => void };

function ChainView({ chains, snapshots, symbol, onSymbol }: ChainProps) {
  const nearest = useMemo(() => {
    const bySymbol = new Map<string, OptionChainEod>();
    for (const c of chains) if (!bySymbol.has(c.symbol) || c.expiry < bySymbol.get(c.symbol)!.expiry) bySymbol.set(c.symbol, c);
    return [...bySymbol.values()];
  }, [chains]);
  const isIndex = nearest.some((c) => c.symbol === symbol);
  const stock = useQuery({ queryKey: ["fo-chain", symbol], queryFn: () => latestFoChain(symbol), enabled: !isIndex && !!symbol, staleTime: 10 * 60_000 });
  const snapshot = snapshots.find((s) => s.symbol === symbol) ?? null;
  const chain: (OptionChainEod & Partial<FoSnapshot>) | null | undefined = isIndex ? { ...snapshot, ...nearest.find((c) => c.symbol === symbol)! } : stock.data ?? (stock.isLoading ? undefined : nearest[0]);
  const stockSymbols = useMemo(() => snapshots.map((s) => s.symbol).filter((s) => !nearest.some((c) => c.symbol === s)), [snapshots, nearest]);
  if (chain === undefined) return <Skeleton className="h-64 w-full" />;
  if (!chain) return <EmptyState text="End-of-day option chains are stored after each close." />;
  const data = chain.strikes.map((s) => ({ strike: s.k, calls: s.c, puts: s.p }));
  const basis = chain.fut_close != null && chain.spot !== null ? chain.fut_close - chain.spot : null;
  const futMove = pctChange(chain.fut_close ?? null, chain.fut_prev_close ?? null);

  return (
    <div id="fo-chain" className="grid grid-cols-1 gap-4 lg:grid-cols-3 scroll-mt-28">
      <Card className="min-w-0 p-4 space-y-3">
        <h3 className="font-semibold">Option chain at the close</h3>
        <div className="grid grid-cols-2 gap-2">
          {nearest.map((c) => (
            <button key={c.symbol} type="button" onClick={() => onSymbol(c.symbol)} aria-pressed={c.symbol === chain.symbol}
              className={`rounded-lg border p-2 text-left transition-colors ${c.symbol === chain.symbol ? "border-primary bg-primary/5" : "hover:border-primary/50"}`}>
              <div className="text-xs font-semibold">{c.symbol}</div>
              <div className="text-sm tabular-nums">PCR <strong className={c.pcr !== null && c.pcr >= 1 ? "text-secondary" : "text-destructive"}>{c.pcr?.toFixed(2) ?? "—"}</strong></div>
            </button>
          ))}
        </div>
        {stockSymbols.length > 0 && (
          <label className="block text-xs text-muted-foreground">
            Any F&amp;O stock
            <select value={isIndex ? "" : chain.symbol} onChange={(e) => e.target.value && onSymbol(e.target.value)}
              className="mt-1 block w-full rounded-md border bg-background px-2 py-1.5 text-sm text-foreground">
              <option value="">Choose a stock…</option>
              {stockSymbols.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        )}
        <dl className="grid grid-cols-2 gap-3 text-sm border-t pt-3">
          <div><dt className="text-xs text-muted-foreground">Spot</dt><dd className="font-semibold tabular-nums">{chain.spot?.toLocaleString("en-IN") ?? "—"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Expiry</dt><dd className="font-semibold">{shortDate(chain.expiry)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Max pain</dt><dd className="font-semibold tabular-nums">{chain.max_pain?.toLocaleString("en-IN") ?? "—"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Put-call ratio</dt><dd className="font-semibold tabular-nums">{chain.pcr?.toFixed(2) ?? "—"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Resistance (call OI)</dt><dd className="font-semibold tabular-nums text-destructive">{chain.call_wall?.toLocaleString("en-IN") ?? "—"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Support (put OI)</dt><dd className="font-semibold tabular-nums text-secondary">{chain.put_wall?.toLocaleString("en-IN") ?? "—"}</dd></div>
          {chain.fut_close != null && (
            <>
              <div><dt className="text-xs text-muted-foreground">Near-month future</dt><dd className="font-semibold tabular-nums">{chain.fut_close.toLocaleString("en-IN")} <span className="text-xs font-normal text-muted-foreground">{basis !== null ? `(${basis >= 0 ? "+" : ""}${basis.toFixed(1)} basis)` : ""}</span></dd></div>
              <div><dt className="text-xs text-muted-foreground">Build-up</dt><dd><BuildUpBadge value={chain.build_up ?? null} /> <span className="text-xs tabular-nums text-muted-foreground">{futMove === null ? "" : `${futMove >= 0 ? "+" : ""}${futMove.toFixed(2)}%`}</span></dd></div>
            </>
          )}
        </dl>
        <p className="text-xs text-muted-foreground">A PCR above 1 means more puts are open than calls - often read as support below the market.</p>
      </Card>
      <Card className="min-w-0 p-4 lg:col-span-2">
        <h3 className="font-semibold">{chain.symbol} open interest by strike</h3>
        <p className="text-xs text-muted-foreground mb-3">Calls (resistance) and puts (support) open at each strike, {shortDate(chain.trade_date)} close</p>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={0}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
            <XAxis dataKey="strike" tick={axisTick} tickLine={false} axisLine={false} minTickGap={16} />
            <YAxis tick={axisTick} tickLine={false} axisLine={false} width={48} tickFormatter={lakhs} />
            <Tooltip {...tooltipStyle} formatter={(v: unknown) => (typeof v === "number" ? lakhs(v) : "—")} labelFormatter={(k) => `Strike ${Number(k).toLocaleString("en-IN")}`} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {chain.spot !== null && <ReferenceLine x={data.reduce((b, d) => (Math.abs(d.strike - chain.spot!) < Math.abs(b - chain.spot!) ? d.strike : b), data[0]?.strike ?? 0)} stroke={CHART.primary} strokeDasharray="4 4" label={{ value: "spot", fill: CHART.axis, fontSize: 10, position: "insideTopRight" }} />}
            <Bar dataKey="calls" name="Call OI" fill={CHART.down} maxBarSize={14} />
            <Bar dataKey="puts" name="Put OI" fill={CHART.up} maxBarSize={14} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

/** F&O positioning: participant-wise open interest, the day's closing option chains and every F&O stock's build-up. */
export default function DerivativesSection() {
  const oi = useQuery({ queryKey: ["participant-oi"], queryFn: () => participantOi(90), staleTime: 10 * 60_000 });
  const chains = useQuery({ queryKey: ["option-chain-eod"], queryFn: latestOptionChains, staleTime: 10 * 60_000 });
  const snapshots = useQuery({ queryKey: ["fo-snapshots"], queryFn: latestFoSnapshots, staleTime: 10 * 60_000 });
  const tracked = useQuery({ queryKey: ["tracked-symbols"], queryFn: trackedSymbols, staleTime: 60 * 60_000 });
  const [symbol, setSymbol] = useState("NIFTY");
  const select = (next: string) => {
    setSymbol(next);
    document.getElementById("fo-chain")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <section id="derivatives" aria-labelledby="derivatives-heading" className="scroll-mt-28 space-y-4">
      <SectionHeading id="derivatives-heading" title="F&O positioning" subtitle="How institutions, prop desks and retail are positioned, and where option writers see support and resistance." />
      {oi.isLoading ? <Skeleton className="h-64 w-full" /> : (oi.data ?? []).length === 0 ? <EmptyState text="Participant positions are collected after each close." /> : <Positioning rows={oi.data!} />}
      {chains.isLoading ? <Skeleton className="h-64 w-full" /> : <ChainView chains={chains.data ?? []} snapshots={snapshots.data ?? []} symbol={symbol} onSymbol={setSymbol} />}
      {snapshots.isLoading ? <Skeleton className="h-64 w-full" /> : (snapshots.data ?? []).length > 0 && (
        <FoBuildUp snapshots={snapshots.data!} tracked={tracked.data ?? new Set()} selected={symbol} onSelect={select} />
      )}
    </section>
  );
}

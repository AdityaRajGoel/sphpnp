import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  SURVEILLANCE_LABEL, istToday, lakhs, marketSnapshots, recentDeals, shortDate, surveillanceFlags, trackedSymbols, upcomingEvents,
  type Deal, type Mover,
} from "@/lib/market-data";
import { SectionHeading, EmptyState } from "./chart-kit";

function SymbolLink({ symbol, tracked }: { symbol: string; tracked: Set<string> | undefined }) {
  return tracked?.has(symbol)
    ? <Link to={`/stock/${encodeURIComponent(symbol)}`} className="font-semibold hover:text-primary hover:underline underline-offset-2">{symbol}</Link>
    : <span className="font-semibold">{symbol}</span>;
}

const pct = (v: number | null) => (v === null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`);

function MoverList({ title, note, movers, tracked, mode }: { title: string; note: string; movers: Mover[]; tracked?: Set<string>; mode: "value" | "volume" }) {
  return (
    <Card className="min-w-0 p-0 overflow-hidden">
      <div className="p-4 pb-2">
        <h3 className="font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground">{note}</p>
      </div>
      <table className="w-full text-sm">
        <caption className="sr-only">{title}</caption>
        <tbody>
          {movers.slice(0, 10).map((m) => (
            <tr key={m.symbol} className="border-t">
              <td className="px-4 py-2"><SymbolLink symbol={m.symbol} tracked={tracked} />{m.name && <div className="text-xs text-muted-foreground truncate max-w-[180px]">{m.name}</div>}</td>
              <td className="px-2 py-2 text-right tabular-nums">{m.price?.toLocaleString("en-IN") ?? "—"}</td>
              <td className={`px-2 py-2 text-right tabular-nums ${m.change_pct === null ? "" : m.change_pct >= 0 ? "text-secondary" : "text-destructive"}`}>{pct(m.change_pct)}</td>
              <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                {mode === "value" ? (m.value_cr === null ? "—" : `₹${m.value_cr.toLocaleString("en-IN", { maximumFractionDigits: 0 })} Cr`) : (m.volume_vs_week === null ? "—" : `${m.volume_vs_week.toFixed(0)}× wk avg`)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

const DEAL_LABEL: Record<Deal["kind"], string> = { bulk: "Bulk", block: "Block", short: "Short sale" };

function DealsTable({ deals, tracked }: { deals: Deal[]; tracked?: Set<string> }) {
  const [kind, setKind] = useState<Deal["kind"] | "all">("all");
  const shown = deals.filter((d) => kind === "all" || d.kind === kind).slice(0, 60);
  return (
    <Card className="min-w-0 p-0 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 pb-2">
        <div>
          <h3 className="font-semibold">Bulk, block &amp; short deals</h3>
          <p className="text-xs text-muted-foreground">Large trades reported to NSE, newest first</p>
        </div>
        <div className="flex bg-muted rounded-lg p-1" role="group" aria-label="Deal type">
          {(["all", "bulk", "block", "short"] as const).map((k) => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold capitalize transition-colors ${kind === k ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              {k === "short" ? "Short" : k}
            </button>
          ))}
        </div>
      </div>
      <div className="max-h-[420px] overflow-auto">
        <table className="w-full text-sm min-w-[640px]">
          <caption className="sr-only">Recent bulk, block and short-selling deals</caption>
          <thead className="sticky top-0 bg-card"><tr className="border-y text-left text-xs text-muted-foreground">
            <th className="px-4 py-2 font-medium">Date</th><th className="px-2 py-2 font-medium">Stock</th><th className="px-2 py-2 font-medium">Client</th>
            <th className="px-2 py-2 font-medium">Type</th><th className="px-2 py-2 text-right font-medium">Quantity</th><th className="px-4 py-2 text-right font-medium">Price</th>
          </tr></thead>
          <tbody>
            {shown.map((d) => (
              <tr key={d.deal_key} className="border-b last:border-0">
                <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">{shortDate(d.trade_date)}</td>
                <td className="px-2 py-2"><SymbolLink symbol={d.symbol} tracked={tracked} /></td>
                <td className="px-2 py-2 max-w-[240px] truncate" title={d.client ?? ""}>{d.client ?? "—"}</td>
                <td className="px-2 py-2 whitespace-nowrap">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${d.side === "buy" ? "bg-secondary/10 text-secondary" : "bg-destructive/10 text-destructive"}`}>
                    {DEAL_LABEL[d.kind]}{d.kind !== "short" && d.side ? ` ${d.side}` : ""}
                  </span>
                </td>
                <td className="px-2 py-2 text-right tabular-nums">{lakhs(d.quantity)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{d.price === null ? "—" : `₹${d.price.toLocaleString("en-IN")}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && <EmptyState text="No deals stored yet for this type." />}
      </div>
    </Card>
  );
}

/** The day's activity: most active stocks, volume spikes, large deals, surveillance lists and the week's corporate events. */
export default function ActivitySection() {
  const today = istToday();
  const tracked = useQuery({ queryKey: ["tracked-symbols"], queryFn: trackedSymbols, staleTime: 60 * 60_000 });
  const snaps = useQuery({ queryKey: ["market-snapshots"], queryFn: marketSnapshots, staleTime: 5 * 60_000 });
  const deals = useQuery({ queryKey: ["recent-deals"], queryFn: () => recentDeals(300), staleTime: 10 * 60_000 });
  const flags = useQuery({ queryKey: ["surveillance"], queryFn: surveillanceFlags, staleTime: 30 * 60_000 });
  const events = useQuery({ queryKey: ["calendar", today], queryFn: () => upcomingEvents(today, 30), staleTime: 30 * 60_000 });

  const byKind = (kind: string) => snaps.data?.find((s) => s.kind === kind);
  const ban = (flags.data ?? []).filter((f) => f.flag === "fo_ban");
  const surveillance = useMemo(() => (flags.data ?? []).filter((f) => f.flag !== "fo_ban"), [flags.data]);
  const trackedFlags = surveillance.filter((f) => tracked.data?.has(f.symbol));

  return (
    <section id="activity" aria-labelledby="activity-heading" className="scroll-mt-28 space-y-4">
      <SectionHeading id="activity-heading" title="Today's activity" subtitle="Where the money traded, the deals behind it, and the stocks under exchange surveillance." />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {snaps.isLoading ? <><Skeleton className="h-72" /><Skeleton className="h-72" /></> : (
          <>
            <MoverList title="Most active by value" note={`NSE${byKind("most_active_value")?.as_of ? `, ${new Date(byKind("most_active_value")!.as_of!).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}` : ""}`} movers={byKind("most_active_value")?.payload ?? []} tracked={tracked.data} mode="value" />
            <MoverList title="Volume shockers" note="Volume against the stock's one-week average" movers={byKind("volume_gainers")?.payload ?? []} tracked={tracked.data} mode="volume" />
          </>
        )}
      </div>

      {deals.isLoading ? <Skeleton className="h-72" /> : <DealsTable deals={deals.data ?? []} tracked={tracked.data} />}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="min-w-0 p-4">
          <h3 className="font-semibold">F&amp;O ban list</h3>
          <p className="text-xs text-muted-foreground mb-3">No fresh derivative positions allowed{ban[0]?.as_of ? ` for ${shortDate(ban[0].as_of)}` : ""}</p>
          {ban.length === 0 ? <p className="text-sm text-muted-foreground">No stock is in the ban period.</p> : (
            <ul className="flex flex-wrap gap-1.5">{ban.map((b) => <li key={b.symbol} className="rounded-md border border-destructive/40 bg-destructive/5 px-2 py-0.5 text-xs font-semibold text-destructive"><SymbolLink symbol={b.symbol} tracked={tracked.data} /></li>)}</ul>
          )}
        </Card>
        <Card className="min-w-0 p-0 overflow-hidden lg:col-span-2">
          <div className="p-4 pb-2">
            <h3 className="font-semibold">Exchange surveillance (ASM / GSM)</h3>
            <p className="text-xs text-muted-foreground">{surveillance.length} stocks under additional or graded surveillance, {trackedFlags.length} of them tracked here; tracked stocks first</p>
          </div>
          <div className="max-h-[300px] overflow-auto">
            <table className="w-full text-sm min-w-[520px]">
              <caption className="sr-only">Stocks under ASM and GSM surveillance</caption>
              <tbody>
                {[...trackedFlags, ...surveillance.filter((f) => !tracked.data?.has(f.symbol))].map((f) => (
                  <tr key={`${f.symbol}|${f.flag}`} className="border-t">
                    <td className="px-4 py-2"><SymbolLink symbol={f.symbol} tracked={tracked.data} /></td>
                    <td className="px-2 py-2 whitespace-nowrap"><span className="rounded-full bg-brand-orange/10 px-2 py-0.5 text-[11px] font-semibold text-brand-orange">{SURVEILLANCE_LABEL[f.flag]}{f.stage ? ` · ${f.stage}` : ""}</span></td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{f.detail ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card className="min-w-0 p-0 overflow-hidden">
        <div className="p-4 pb-2">
          <h3 className="font-semibold">Corporate calendar</h3>
          <p className="text-xs text-muted-foreground">Board meetings and results dates announced to NSE and BSE for the next 30 days</p>
        </div>
        <div className="max-h-[380px] overflow-auto">
          <table className="w-full text-sm min-w-[560px]">
            <caption className="sr-only">Upcoming board meetings and results</caption>
            <tbody>
              {(events.data ?? []).map((e) => (
                <tr key={e.event_key} className="border-t">
                  <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">{shortDate(e.event_date)}</td>
                  <td className="px-2 py-2">{e.symbol ? <SymbolLink symbol={e.symbol} tracked={tracked.data} /> : null} <span className="text-xs text-muted-foreground">{e.company}</span></td>
                  <td className="px-4 py-2">{e.purpose}{e.detail && e.detail !== e.purpose ? <span className="text-xs text-muted-foreground"> · {e.detail}</span> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!events.isLoading && (events.data ?? []).length === 0 && <EmptyState text="No events announced for the next 30 days yet." />}
        </div>
      </Card>
    </section>
  );
}

import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import LiveIndicator from "@/components/ui/live-indicator";
import { getWorldBoard, type BoardGroup, type BoardRow } from "@/lib/world-markets";
import { CHART, SectionHeading, EmptyState } from "./chart-kit";

const TABS: { id: BoardGroup; label: string; note: string }[] = [
  { id: "world", label: "World indices", note: "Main index of 40 markets. Changes over 1, 5, 21 and 62 sessions." },
  { id: "sectors", label: "Indian sectors", note: "NSE sector and size indices, plus India VIX." },
  { id: "etfs", label: "ETFs", note: "Flow is an ESTIMATE: the day's traded value signed by its direction. Exchanges do not publish daily ETF creations." },
];

type SortKey = "day" | "week" | "month" | "quarter";

const pct = (v: number | null) => (v === null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`);
const tone = (v: number | null) => (v === null ? "text-muted-foreground" : v >= 0 ? "text-secondary" : "text-destructive");

function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const up = values[values.length - 1] >= values[0];
  const points = values.map((v, i) => `${(i / (values.length - 1)) * 100},${max === min ? 50 : 100 - ((v - min) / (max - min)) * 100}`).join(" ");
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-6 w-20" aria-hidden="true">
      <polyline points={points} fill="none" stroke={up ? CHART.up : CHART.down} strokeWidth="3" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Heat strip: the day's move per market, strongest first - a world map without the map. */
export function HeatStrip({ rows }: { rows: BoardRow[] }) {
  const sorted = [...rows].filter((r) => r.day !== null).sort((a, b) => b.day! - a.day!);
  const scale = Math.max(1, ...sorted.map((r) => Math.abs(r.day!)));
  // A bare country code is ambiguous once a country has two indices ("IN +0.6", "IN +0.2").
  const perCountry = new Map<string, number>();
  for (const r of sorted) if (r.country) perCountry.set(r.country, (perCountry.get(r.country) ?? 0) + 1);
  const label = (r: BoardRow) =>
    r.country && perCountry.get(r.country) === 1 ? r.country : r.name.replace(/^BSE /, "").split(" ")[0];
  return (
    <div className="flex flex-wrap gap-1" role="list" aria-label="Day's change by market">
      {sorted.map((r) => {
        // Capped at 0.5: stronger fills failed contrast with the text in both
        // themes (dark text on the light theme, light text on the dark one).
        const alpha = 0.12 + 0.38 * Math.min(1, Math.abs(r.day!) / scale);
        return (
          <span
            key={r.symbol}
            role="listitem"
            title={`${r.name}: ${pct(r.day)}`}
            className="rounded px-1.5 py-1 text-[11px] font-semibold tabular-nums text-foreground"
            style={{ background: `hsl(var(${r.day! >= 0 ? "--secondary" : "--destructive"}) / ${alpha})` }}
          >
            {label(r)} {r.day! >= 0 ? "+" : ""}{r.day!.toFixed(1)}
          </span>
        );
      })}
    </div>
  );
}

/**
 * The world, India's sectors and India's ETFs on one board - the per-country
 * index table worldmonitor carries, widened to sectors and BeES ETF flow
 * estimates for an Indian reader.
 */
export default function WorldMarketsSection() {
  const { data, isLoading, error } = useQuery({ queryKey: ["world-board"], queryFn: getWorldBoard, staleTime: 15 * 60_000, retry: 1 });
  const [tab, setTab] = useState<BoardGroup>("world");
  const [sort, setSort] = useState<SortKey>("day");
  // World markets can be read in their own currency or as a dollar holder saw them.
  const [inUsd, setInUsd] = useState(false);
  const usd = inUsd && tab === "world";
  const ret = (r: BoardRow, k: SortKey) => (usd ? r.usd?.[k] ?? null : r[k]);
  const rows = useMemo(() => {
    const list = data?.groups[tab] ?? [];
    const value = (r: BoardRow) => (usd ? r.usd?.[sort] ?? null : r[sort]);
    return [...list].sort((a, b) => (value(b) ?? -Infinity) - (value(a) ?? -Infinity));
  }, [data, tab, sort, usd]);
  const active = TABS.find((t) => t.id === tab)!;
  const regions = [...new Set(rows.map((r) => r.region).filter(Boolean))] as string[];

  return (
    <section id="world" aria-labelledby="world-heading" className="scroll-mt-28 space-y-4">
      <SectionHeading id="world-heading" title="World board" subtitle="Global indices, Indian sectors and ETFs from their latest closes.">
        <div role="tablist" aria-label="Board" className="flex gap-1 rounded-lg bg-muted p-1">
          {TABS.map((t) => (
            <button key={t.id} role="tab" type="button" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${tab === t.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </SectionHeading>

      {isLoading ? <Skeleton className="h-72 w-full" /> : error || !data ? (
        <EmptyState text="The world board is not reachable right now." />
      ) : (
        <>
          {tab === "world" && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {usd ? "Returns in US dollars: each market's move plus its currency's move against the dollar." : "Returns in each market's own currency."}
              </p>
              <div role="group" aria-label="Currency of returns" className="flex gap-1 rounded-lg bg-muted p-1">
                {([false, true] as const).map((v) => (
                  <button key={String(v)} type="button" aria-pressed={inUsd === v} onClick={() => setInUsd(v)} className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${inUsd === v ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                    {v ? "USD" : "Local"}
                  </button>
                ))}
              </div>
            </div>
          )}
          {tab === "world" && <Card className="p-3"><HeatStrip rows={usd ? rows.map((r) => ({ ...r, day: r.usd?.day ?? null })) : rows} /></Card>}
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <caption className="sr-only">{active.label}</caption>
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2.5 text-left font-medium">{tab === "world" ? "Market" : tab === "etfs" ? "ETF" : "Index"}</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Last</th>
                  {(["day", "week", "month", "quarter"] as SortKey[]).map((k) => (
                    <th key={k} scope="col" aria-sort={sort === k ? "descending" : undefined} className="px-3 py-2.5 text-right font-medium">
                      <button type="button" onClick={() => setSort(k)} className={`-my-2 inline-flex min-h-8 min-w-8 items-center justify-end hover:text-foreground ${sort === k ? "text-foreground" : ""}`}>{{ day: "1D", week: "1W", month: "1M", quarter: "3M" }[k]}</button>
                    </th>
                  ))}
                  {tab === "etfs" && <th scope="col" className="px-3 py-2.5 text-right font-medium" title="Estimated from traded value and direction">Est. flow</th>}
                  <th scope="col" className="px-3 py-2.5 text-right font-medium" title="Latest volume against the 20-session average">Vol ×</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">1M</th>
                </tr>
              </thead>
              <tbody>
                {(tab === "world" ? regions : [""]).map((region) => (
                  <Fragment key={region || "all"}>
                    {region && <tr className="border-t bg-muted/20"><th colSpan={8} scope="rowgroup" className="px-4 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{region}</th></tr>}
                    {rows.filter((r) => !region || r.region === region).map((r) => (
                      <tr key={r.symbol} className="border-t hover:bg-muted/30">
                        <td className="px-4 py-2"><span className="font-semibold">{r.name}</span>{r.country && <span className="ml-2 text-xs text-muted-foreground">{r.country}</span>}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {r.last.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                          {tab === "world" && r.currency && <span className="ml-1 text-[10px] text-muted-foreground">{r.currency}</span>}
                        </td>
                        {(["day", "week", "month", "quarter"] as SortKey[]).map((k) => (
                          <td key={k} className={`px-3 py-2 text-right tabular-nums ${tone(ret(r, k))}`}>{pct(ret(r, k))}</td>
                        ))}
                        {tab === "etfs" && <td className={`px-3 py-2 text-right tabular-nums ${tone(r.est_flow_cr)}`}>{r.est_flow_cr === null ? "—" : `${r.est_flow_cr >= 0 ? "+" : "−"}₹${Math.abs(r.est_flow_cr).toFixed(1)} Cr`}</td>}
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{r.volume_ratio === null ? "—" : `${r.volume_ratio.toFixed(1)}×`}</td>
                        <td className="px-4 py-2"><div className="flex justify-end"><Spark values={r.spark} /></div></td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </Card>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <LiveIndicator updatedAt={data.generated_at} />
            <span>{active.note}{data.failed.length > 0 && ` ${data.failed.length} symbols did not answer.`}</span>
          </p>
        </>
      )}
    </section>
  );
}

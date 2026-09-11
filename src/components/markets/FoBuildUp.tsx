import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { BUILD_UP_LABEL, BUILD_UP_TONE, buildUpCounts, oiChangePct, pctChange, shortDate, type BuildUp, type FoSnapshot } from "@/lib/market-data";

const FILTERS: BuildUp[] = ["long_buildup", "short_covering", "short_buildup", "long_unwinding"];
const TONE_CLASS = { up: "text-secondary", down: "text-destructive", flat: "text-muted-foreground" } as const;
const BADGE_CLASS = { up: "bg-secondary/15 text-secondary", down: "bg-destructive/15 text-destructive", flat: "bg-muted text-muted-foreground" } as const;

type SortKey = "oi" | "price" | "pcr" | "symbol";
const signedPct = (v: number | null) => (v === null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`);
const tone = (v: number | null) => (v === null ? "text-muted-foreground" : v >= 0 ? "text-secondary" : "text-destructive");

export function BuildUpBadge({ value }: { value: BuildUp | null }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  return <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${BADGE_CLASS[BUILD_UP_TONE[value]]}`}>{BUILD_UP_LABEL[value]}</span>;
}

type Props = { snapshots: FoSnapshot[]; tracked: Set<string>; selected: string; onSelect: (symbol: string) => void };

/**
 * Every F&O underlying at the close: the near-month future's move and its
 * open-interest change, read together as the day's positioning, beside the
 * nearest expiry's put-call ratio and max pain. A row charts its option chain.
 */
export default function FoBuildUp({ snapshots, tracked, selected, onSelect }: Props) {
  const [filter, setFilter] = useState<BuildUp | "all">("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("oi");
  const [showAll, setShowAll] = useState(false);
  const counts = useMemo(() => buildUpCounts(snapshots), [snapshots]);

  const rows = useMemo(() => {
    const q = query.trim().toUpperCase();
    const list = snapshots
      .filter((s) => (filter === "all" || s.build_up === filter) && (!q || s.symbol.includes(q)))
      .map((s) => ({ ...s, price: pctChange(s.fut_close, s.fut_prev_close), oi: oiChangePct(s) }));
    const size = (v: number | null) => (v === null ? -Infinity : Math.abs(v));
    return list.sort((a, b) =>
      sort === "symbol" ? a.symbol.localeCompare(b.symbol)
        : sort === "pcr" ? (b.pcr ?? -1) - (a.pcr ?? -1)
          : sort === "price" ? size(b.price) - size(a.price)
            : size(b.oi) - size(a.oi));
  }, [snapshots, filter, query, sort]);
  const visible = showAll ? rows : rows.slice(0, 25);
  const date = snapshots[0]?.trade_date ?? null;

  const header = (key: SortKey, label: string, align = "text-right") => (
    <th scope="col" className={`py-2 px-2 font-medium ${align}`} aria-sort={sort === key ? (key === "symbol" ? "ascending" : "descending") : undefined}>
      <button type="button" onClick={() => setSort(key)} className={`hover:text-foreground ${sort === key ? "text-foreground font-semibold" : ""}`}>{label}</button>
    </th>
  );

  return (
    <Card className="min-w-0 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
        <div>
          <h3 className="font-semibold">Build-up across every F&amp;O stock</h3>
          <p className="text-xs text-muted-foreground">{snapshots.length} underlyings at the {shortDate(date)} close · near-month future's price and open interest · click a row to chart its option chain</p>
        </div>
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a symbol" aria-label="Find an F&O symbol" className="h-8 w-full sm:w-44" />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 mb-3" role="group" aria-label="Filter by build-up">
        <button type="button" onClick={() => setFilter("all")} aria-pressed={filter === "all"}
          className={`rounded-lg border p-2 text-left transition-colors ${filter === "all" ? "border-primary bg-primary/5" : "hover:border-primary/50"}`}>
          <div className="text-xs text-muted-foreground">All</div>
          <div className="text-lg font-bold tabular-nums">{snapshots.length}</div>
        </button>
        {FILTERS.map((f) => (
          <button key={f} type="button" onClick={() => setFilter(filter === f ? "all" : f)} aria-pressed={filter === f}
            className={`rounded-lg border p-2 text-left transition-colors ${filter === f ? "border-primary bg-primary/5" : "hover:border-primary/50"}`}>
            <div className="text-xs text-muted-foreground">{BUILD_UP_LABEL[f]}</div>
            <div className={`text-lg font-bold tabular-nums ${TONE_CLASS[BUILD_UP_TONE[f]]}`}>{counts[f]}</div>
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <caption className="sr-only">F&amp;O underlyings with price change, open-interest change, build-up, put-call ratio and max pain</caption>
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              {header("symbol", "Symbol", "text-left")}
              <th scope="col" className="py-2 px-2 text-right font-medium">Future</th>
              {header("price", "Price")}
              {header("oi", "OI change")}
              <th scope="col" className="py-2 px-2 text-left font-medium">Build-up</th>
              {header("pcr", "PCR")}
              <th scope="col" className="py-2 px-2 text-right font-medium">Max pain</th>
              <th scope="col" className="py-2 px-2 text-right font-medium">Lot</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((s) => (
              <tr key={s.symbol} onClick={() => onSelect(s.symbol)} aria-selected={s.symbol === selected}
                className={`cursor-pointer border-b last:border-0 transition-colors hover:bg-muted/50 ${s.symbol === selected ? "bg-primary/5" : ""}`}>
                <td className="py-1.5 px-2 font-semibold">
                  {tracked.has(s.symbol)
                    ? <Link to={`/stock/${encodeURIComponent(s.symbol)}`} onClick={(e) => e.stopPropagation()} className="hover:text-primary hover:underline">{s.symbol}</Link>
                    : <button type="button" onClick={() => onSelect(s.symbol)} className="hover:text-primary">{s.symbol}</button>}
                </td>
                <td className="py-1.5 px-2 text-right tabular-nums">{s.fut_close?.toLocaleString("en-IN", { maximumFractionDigits: 2 }) ?? "—"}</td>
                <td className={`py-1.5 px-2 text-right tabular-nums ${tone(s.price)}`}>{signedPct(s.price)}</td>
                <td className={`py-1.5 px-2 text-right tabular-nums ${tone(s.oi)}`}>{signedPct(s.oi)}</td>
                <td className="py-1.5 px-2"><BuildUpBadge value={s.build_up} /></td>
                <td className="py-1.5 px-2 text-right tabular-nums">{s.pcr?.toFixed(2) ?? "—"}</td>
                <td className="py-1.5 px-2 text-right tabular-nums">{s.max_pain?.toLocaleString("en-IN") ?? "—"}</td>
                <td className="py-1.5 px-2 text-right tabular-nums">{s.lot_size?.toLocaleString("en-IN") ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No underlying matches.</p>}
      {rows.length > 25 && (
        <button type="button" onClick={() => setShowAll(!showAll)} className="mt-2 text-sm font-semibold text-primary hover:underline">
          {showAll ? "Show fewer" : `Show all ${rows.length}`}
        </button>
      )}
      <p className="mt-2 text-xs text-muted-foreground">Rising price with rising open interest is fresh buying (long build-up); falling price with rising open interest, fresh selling (short build-up). Rising price on falling open interest is shorts closing; falling price on falling open interest, longs exiting.</p>
    </Card>
  );
}

import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { segmentItem, segmentTrack } from "@/components/ui/segmented";
import { SectionHeading, EmptyState } from "@/components/markets/chart-kit";
import { isInBan, mwplUtilisation, MWPL_BAN_ENTRY, MWPL_BAN_EXIT, oiSpurts, shortDate, trackedSymbols, type MwplRow, type OiSpurtRow } from "@/lib/market-data";

const SHOWN = 15;
const compact = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 });
const signedPct = (v: number | null) => (v === null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(1)}%`);

function SymbolLink({ symbol, tracked }: { symbol: string; tracked: Set<string> }) {
  return tracked.has(symbol)
    ? <Link to={`/stock/${encodeURIComponent(symbol)}`} className="font-semibold hover:text-secondary hover:underline">{symbol}</Link>
    : <span className="font-semibold">{symbol}</span>;
}

/** Utilisation against MWPL, with the 80% exit and 95% entry lines drawn on the bar. */
function LimitBar({ row }: { row: MwplRow }) {
  const banned = isInBan(row);
  const width = Math.min(100, row.utilisation_pct);
  return (
    <div className="relative h-2 w-full rounded-full bg-muted" role="img" aria-label={`${row.utilisation_pct.toFixed(1)}% of the market-wide position limit`}>
      <div className={`h-full rounded-full ${banned ? "bg-destructive" : "bg-secondary"}`} style={{ width: `${width}%` }} />
      {[MWPL_BAN_EXIT, MWPL_BAN_ENTRY].map((mark) => (
        <span key={mark} className="absolute -top-0.5 h-3 w-px bg-foreground/40" style={{ left: `${mark}%` }} aria-hidden="true" />
      ))}
    </div>
  );
}

function BanWatch({ rows, tracked }: { rows: MwplRow[]; tracked: Set<string> }) {
  const inBan = rows.filter(isInBan).length;
  const near = rows.filter((r) => !isInBan(r) && r.utilisation_pct >= MWPL_BAN_EXIT).length;
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold">Closest to the F&amp;O ban</h3>
        <p className="text-xs text-muted-foreground tabular-nums">{inBan} in the ban · {near} above {MWPL_BAN_EXIT}%</p>
      </div>
      <ol className="mt-4 space-y-3">
        {rows.slice(0, SHOWN).map((r) => (
          <li key={r.symbol} className="grid grid-cols-[minmax(0,7.5rem)_1fr_3.75rem] items-center gap-3 text-sm">
            <span className="min-w-0 truncate"><SymbolLink symbol={r.symbol} tracked={tracked} /></span>
            <LimitBar row={r} />
            <span className="text-right tabular-nums">
              {r.utilisation_pct.toFixed(1)}%
              {isInBan(r) && <span className="block text-[11px] font-medium text-destructive">In ban</span>}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-xs text-muted-foreground">
        Future-equivalent open interest as a share of the market-wide position limit, {shortDate(rows[0].as_of)}. A stock enters the ban above {MWPL_BAN_ENTRY}% and leaves below {MWPL_BAN_EXIT}%; the lines mark both. From NSE&apos;s combined OI file.
      </p>
    </Card>
  );
}

function OiMoves({ rows, tracked }: { rows: OiSpurtRow[]; tracked: Set<string> }) {
  const [side, setSide] = useState<"up" | "down">("up");
  const list = (side === "up"
    ? rows.filter((r) => (r.change_pct ?? 0) > 0)
    : [...rows].filter((r) => (r.change_pct ?? 0) < 0).reverse()
  ).slice(0, SHOWN);
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Biggest open-interest moves</h3>
        <div role="group" aria-label="Direction of the OI change" className={segmentTrack}>
          <button type="button" aria-pressed={side === "up"} className={segmentItem(side === "up")} onClick={() => setSide("up")}>OI added</button>
          <button type="button" aria-pressed={side === "down"} className={segmentItem(side === "down")} onClick={() => setSide("down")}>OI shed</button>
        </div>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">F&amp;O underlyings with the largest {side === "up" ? "increase" : "fall"} in open interest since the previous session</caption>
          <thead>
            <tr className="border-b text-muted-foreground">
              <th scope="col" className="py-2 pr-2 text-left font-medium">Symbol</th>
              <th scope="col" className="px-2 py-2 text-right font-medium">Price</th>
              <th scope="col" className="px-2 py-2 text-right font-medium">OI change</th>
              <th scope="col" className="py-2 pl-2 text-right font-medium">Open interest</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.symbol} className="border-b last:border-0">
                <th scope="row" className="py-2 pr-2 text-left font-normal"><SymbolLink symbol={r.symbol} tracked={tracked} /></th>
                <td className="px-2 py-2 text-right tabular-nums">{r.underlying?.toLocaleString("en-IN", { maximumFractionDigits: 2 }) ?? "—"}</td>
                <td className="px-2 py-2 text-right tabular-nums font-medium">{signedPct(r.change_pct)}</td>
                <td className="py-2 pl-2 text-right tabular-nums text-muted-foreground">{compact.format(r.latest_oi)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Change in open interest against the previous session, {shortDate(rows[0].trade_date)}. Rising OI means positions are being opened, falling OI that they are being closed; neither says which way. From NSE&apos;s OI-spurts report.
      </p>
    </Card>
  );
}

/** How close each F&O stock is to the ban, and where open interest moved most. */
export default function PositionLimitsSection() {
  const mwpl = useQuery({ queryKey: ["fo-mwpl"], queryFn: () => mwplUtilisation(SHOWN * 2), staleTime: 10 * 60_000 });
  const spurts = useQuery({ queryKey: ["fo-oi-spurts"], queryFn: oiSpurts, staleTime: 5 * 60_000 });
  const tracked = useQuery({ queryKey: ["tracked-symbols"], queryFn: trackedSymbols, staleTime: 60 * 60_000 });
  const names = tracked.data ?? new Set<string>();
  return (
    <section id="position-limits" aria-labelledby="position-limits-heading" className="scroll-mt-28 space-y-4">
      <SectionHeading id="position-limits-heading" title="Position limits and OI moves" subtitle="Which F&O stocks are nearing the ban, and where open interest changed most since the last session." />
      <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        {mwpl.isLoading ? <Skeleton className="h-96 w-full" /> : (mwpl.data ?? []).length === 0
          ? <EmptyState text="Position-limit figures are collected after each close." />
          : <BanWatch rows={mwpl.data!} tracked={names} />}
        {spurts.isLoading ? <Skeleton className="h-96 w-full" /> : (spurts.data ?? []).length === 0
          ? <EmptyState text="Open-interest moves are collected during market hours." />
          : <OiMoves rows={spurts.data!} tracked={names} />}
      </div>
    </section>
  );
}

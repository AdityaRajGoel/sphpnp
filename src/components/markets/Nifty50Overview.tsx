import { useMemo, useRef } from "react";
import { useInView } from "motion/react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import StockHeatmap, { type HeatmapStock } from "@/components/StockHeatmap";
import { useLiveMarket } from "@/hooks/useLiveMarket";
import { useScreenerUniverse } from "@/hooks/useScreenerUniverse";
import { indexTitle, listSlug, loadConstituents, loadIndexBoard, type IndexBoardRow } from "@/lib/market-lists";
import { isPrerender } from "@/lib/prerender";

const BROAD = ["NIFTY NEXT 50", "NIFTY MIDCAP 150", "NIFTY SMALLCAP 250", "NIFTY MICROCAP 250"];
const SECTORS = ["NIFTY BANK", "NIFTY IT", "NIFTY AUTO", "NIFTY PHARMA", "NIFTY FMCG", "NIFTY METAL", "NIFTY REALTY", "NIFTY ENERGY", "NIFTY MEDIA", "NIFTY PSU BANK", "NIFTY FINANCIAL SERVICES", "NIFTY CONSUMER DURABLES", "NIFTY OIL & GAS", "NIFTY HEALTHCARE"];

const pct = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(2)}%`);
const tone = (v: number | null | undefined) => (!v ? "text-muted-foreground" : v > 0 ? "text-secondary" : "text-destructive");
const byName = (rows: IndexBoardRow[] | undefined) => new Map((rows ?? []).map((r) => [r.name.toUpperCase(), r]));

/**
 * The homepage's Nifty 50 section, then the broader market: the index, how
 * many of its 50 rose, the day's biggest moves inside it and a market-cap
 * heatmap of all 50; below, the size indices and the sectors ranked by the
 * day's move. Quotes from the screener universe (one cached file), index
 * closes from NSE's daily index file.
 */
export default function Nifty50Overview() {
  const { indices } = useLiveMarket();
  // Below the fold: the universe (one ~180 KB file) and the index board load once
  // the section nears the screen, as HomeMarketGlance does; the prerender loads them.
  const ref = useRef<HTMLDivElement>(null);
  const near = useInView(ref, { once: true, margin: "600px 0px" }) || isPrerender();
  const universe = useScreenerUniverse({ enabled: near });
  const members = useQuery({ queryKey: ["constituents", "NIFTY 50"], queryFn: () => loadConstituents("NIFTY 50"), staleTime: 6 * 60 * 60_000, enabled: near });
  const board = useQuery({ queryKey: ["index-board"], queryFn: loadIndexBoard, staleTime: 30 * 60_000, enabled: near });

  const nifty = indices.find((i) => i.key === "NIFTY");
  const stocks: HeatmapStock[] = useMemo(() => {
    const quotes = universe.data;
    if (!quotes || !members.data) return [];
    return members.data
      .map((m) => quotes.get(m.symbol)?.quote)
      .filter((q): q is NonNullable<typeof q> => Boolean(q && q.price > 0))
      .map((q) => ({ symbol: q.symbol, name: q.name, price: q.price, change_pct: q.change_pct, market_cap: q.market_cap }));
  }, [universe.data, members.data]);

  const up = stocks.filter((s) => s.change_pct > 0).length;
  const down = stocks.filter((s) => s.change_pct < 0).length;
  const sorted = [...stocks].sort((a, b) => b.change_pct - a.change_pct);
  const indexRows = byName(board.data);
  const sectors = SECTORS.map((n) => ({ name: n, row: indexRows.get(n) })).filter((x) => x.row?.change_pct != null).sort((a, b) => b.row!.change_pct! - a.row!.change_pct!);
  const maxSector = Math.max(0.5, ...sectors.map((s) => Math.abs(s.row!.change_pct!)));

  return (
    <div ref={ref} className="mb-12 space-y-6">
      <section aria-labelledby="nifty50-heading" className="grid gap-4 lg:grid-cols-12">
        <Card className="p-5 lg:col-span-4">
          <h3 id="nifty50-heading" className="text-sm font-semibold text-muted-foreground">Nifty 50</h3>
          {nifty ? (
            <>
              <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight">{nifty.price}</p>
              <p className={`text-sm font-semibold tabular-nums ${nifty.up ? "text-secondary" : "text-destructive"}`}>{nifty.changeValue ? `${nifty.changeValue} ` : ""}({nifty.change})</p>
            </>
          ) : <Skeleton className="mt-2 h-12 w-40" />}

          {stocks.length > 0 && (
            <>
              <div className="mt-5">
                <div className="flex justify-between text-xs text-muted-foreground"><span>{up} up</span><span>{stocks.length - up - down} flat</span><span>{down} down</span></div>
                <div className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${up} of ${stocks.length} Nifty 50 stocks rose, ${down} fell`}>
                  <span className="bg-secondary" style={{ width: `${(up / stocks.length) * 100}%` }} />
                  <span className="ml-auto bg-destructive" style={{ width: `${(down / stocks.length) * 100}%` }} />
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
                {([["Top gainers", sorted.slice(0, 3)], ["Top losers", sorted.slice(-3).reverse()]] as const).map(([label, list]) => (
                  <div key={label}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
                    <ul className="mt-2 space-y-1.5">
                      {list.map((s) => (
                        <li key={s.symbol} className="flex items-baseline justify-between gap-2">
                          <Link to={`/stock/${encodeURIComponent(s.symbol)}`} className="truncate font-medium hover:text-secondary hover:underline underline-offset-4">{s.symbol}</Link>
                          <span className={`shrink-0 tabular-nums text-xs font-semibold ${tone(s.change_pct)}`}>{pct(s.change_pct)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </>
          )}
          <Link to="/indices/nifty-50" className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-secondary hover:underline underline-offset-4">All 50 stocks, P/E and history <ArrowRight className="h-4 w-4" aria-hidden /></Link>
        </Card>
        <div className="min-w-0 lg:col-span-8">
          {stocks.length > 0 ? <StockHeatmap stocks={stocks} maxItems={50} /> : <Skeleton className="h-full min-h-[18rem] w-full" />}
        </div>
      </section>

      {(board.data?.length ?? 0) > 0 && (
        <section aria-labelledby="broad-heading" className="grid gap-4 lg:grid-cols-12">
          <Card className="p-5 lg:col-span-5">
            <h3 id="broad-heading" className="font-semibold">The broader market</h3>
            <p className="text-xs text-muted-foreground">Size indices at the last close.</p>
            <table className="mt-3 w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr><th scope="col" className="py-1.5 text-left font-medium">Index</th><th scope="col" className="py-1.5 text-right font-medium">Day</th><th scope="col" className="py-1.5 text-right font-medium">1 year</th></tr>
              </thead>
              <tbody>
                {BROAD.map((n) => {
                  const r = indexRows.get(n);
                  if (!r) return null;
                  return (
                    <tr key={n} className="border-t">
                      <th scope="row" className="py-2 text-left font-normal"><Link to={`/indices/${listSlug(n)}`} className="hover:text-secondary hover:underline underline-offset-4">{indexTitle(n)}</Link></th>
                      <td className={`py-2 text-right font-semibold tabular-nums ${tone(r.change_pct)}`}>{pct(r.change_pct)}</td>
                      <td className={`py-2 text-right tabular-nums ${tone(r.year_pct)}`}>{pct(r.year_pct)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
          <Card className="p-5 lg:col-span-7">
            <h3 className="font-semibold">Sectors, ranked by the day</h3>
            <p className="text-xs text-muted-foreground">NSE sector indices at the last close.</p>
            <ul className="mt-3 space-y-1.5">
              {sectors.map(({ name, row }) => {
                const v = row!.change_pct!;
                const w = (Math.abs(v) / maxSector) * 50;
                return (
                  <li key={name}>
                    <Link to={`/indices/${listSlug(name)}`} className="group grid grid-cols-[8.5rem_1fr_4rem] items-center gap-3 text-sm sm:grid-cols-[11rem_1fr_4.5rem]">
                      <span className="truncate group-hover:text-secondary">{indexTitle(name).replace(/^Nifty /, "")}</span>
                      <span className="relative h-2 rounded-full bg-muted" aria-hidden>
                        <span className={`absolute top-0 h-2 rounded-full ${v >= 0 ? "bg-secondary/70" : "bg-destructive/70"}`} style={v >= 0 ? { left: "50%", width: `${w}%` } : { right: "50%", width: `${w}%` }} />
                        <span className="absolute left-1/2 top-[-2px] h-3 w-px bg-border" />
                      </span>
                      <span className={`text-right text-xs font-semibold tabular-nums ${tone(v)}`}>{pct(v)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        </section>
      )}
    </div>
  );
}

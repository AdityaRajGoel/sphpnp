import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { globalMarkets } from "@/lib/market-data";
import { getIndexCloses } from "@/lib/world-markets";
import { classifyRegime, ratioSeries, type Lean } from "@/lib/macro-regime";
import { computeBreadth } from "@/lib/market-breadth";
import { useScreenerUniverse } from "@/hooks/useScreenerUniverse";
import { SectionHeading } from "./chart-kit";

const LEAN_STYLE: Record<Lean, { label: string; className: string }> = {
  on: { label: "Risk-on", className: "border-secondary/40 bg-secondary/10 text-secondary" },
  off: { label: "Risk-off", className: "border-destructive/40 bg-destructive/10 text-destructive" },
  neutral: { label: "Neutral", className: "border-border bg-muted/40 text-muted-foreground" },
  unknown: { label: "No data", className: "border-dashed border-border text-muted-foreground" },
};

async function loadInputs() {
  const [vix, nifty, fmcg, global] = await Promise.all([
    // NSE's own index closes: the Yahoo ^CNXFMCG symbol stopped resolving and
    // silently dropped the Nifty-vs-FMCG input.
    getIndexCloses("India VIX"),
    getIndexCloses("Nifty 50"),
    getIndexCloses("Nifty FMCG"),
    globalMarkets().catch(() => []),
  ]);
  const closes = (ticker: string) => global.filter((b) => b.ticker === ticker).sort((a, b) => a.trade_date.localeCompare(b.trade_date)).map((b) => b.close);
  return {
    indiaVix: vix.map((p) => p.close),
    nifty: nifty.map((p) => p.close),
    niftyVsFmcg: ratioSeries(nifty, fmcg),
    usdInr: closes("USDINR.FOREX"),
    brent: closes("BNO.US"),
    sp500: closes("GSPC.INDX"),
  };
}

/**
 * The market's regime in one read: seven cross-asset inputs, each classified
 * on a stated rule, and a verdict that is only the count of how they lean.
 */
export default function MacroRegimeSection() {
  const { data, isLoading } = useQuery({ queryKey: ["macro-regime-inputs"], queryFn: loadInputs, staleTime: 15 * 60_000 });
  const universe = useScreenerUniverse();
  const regime = useMemo(() => {
    if (!data) return null;
    const breadth = universe.data ? computeBreadth(universe.data.values()).above200.pct : null;
    return classifyRegime({ ...data, breadthAbove200: breadth });
  }, [data, universe.data]);

  const verdictTone = regime?.verdict === "Risk-on" ? "text-secondary" : regime?.verdict === "Risk-off" ? "text-destructive" : "text-foreground";

  return (
    <section id="regime" aria-labelledby="regime-heading" className="scroll-mt-28 space-y-4">
      <SectionHeading id="regime-heading" title="Market regime" subtitle="Volatility, trend, risk appetite, the rupee, crude, the US lead and breadth, each read against a stated rule." />
      {isLoading || !regime ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,15rem)_1fr]">
          <Card className="p-5 flex flex-col justify-between">
            <div>
              <div className="text-xs font-medium text-muted-foreground">Inputs lean</div>
              <div className={`mt-1 text-4xl font-bold tracking-tight ${verdictTone}`}>{regime.verdict}</div>
            </div>
            <div className="mt-4">
              <div className="flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <div className="bg-secondary" style={{ width: `${(regime.on / 7) * 100}%` }} />
                <div className="bg-muted-foreground/30" style={{ width: `${((regime.known - regime.on - regime.off) / 7) * 100}%` }} />
                <div className="bg-destructive" style={{ width: `${(regime.off / 7) * 100}%` }} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground tabular-nums">{regime.on} risk-on · {regime.off} risk-off · {regime.known} of 7 known</p>
            </div>
          </Card>
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {regime.signals.map((s) => (
              <li key={s.id}>
                <Card className="h-full p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{s.label}</span>
                    <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${LEAN_STYLE[s.lean].className}`}>{LEAN_STYLE[s.lean].label}</span>
                  </div>
                  <p className="mt-1.5 text-sm tabular-nums">{s.reading}</p>
                  <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{s.rule}</p>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-xs text-muted-foreground">A description of current conditions against past patterns, not a forecast or advice.</p>
    </section>
  );
}

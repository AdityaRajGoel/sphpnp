import { useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { DURATION, EASE_OUT } from "@/lib/motion";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import AnimatedNumber from "@/components/ui/animated-number";
import { useScreenerUniverse } from "@/hooks/useScreenerUniverse";
import { computeBreadth, type Share } from "@/lib/market-breadth";
import { formatMetric } from "@/lib/screener-metrics";
import { SCAN_BY_ID, scanCounts } from "@/lib/screener-scans";
import { SectionHeading } from "./chart-kit";

/** A share bar growing from the left the first time it scrolls into view. */
const GROW_BAR = {
  initial: { scaleX: 0 },
  whileInView: { scaleX: 1 },
  viewport: { once: true },
  transition: { duration: DURATION.reveal * 1.6, ease: EASE_OUT },
} as const;

const FEATURED_SCANS = [
  "strong_uptrend", "strong_downtrend", "rsi_oversold", "rsi_overbought", "volume_spike", "bb_squeeze",
  "at_highs", "deep_drawdown", "piotroski_strong", "magic_formula", "compounders", "net_cash",
];

function ShareTile({ label, share, tone, note }: { label: string; share: Share; tone: "up" | "down" | "neutral"; note: string }) {
  const bar = tone === "up" ? "bg-secondary" : tone === "down" ? "bg-destructive" : "bg-foreground/60";
  return (
    <Card className="p-4">
      <div className="text-xs font-medium text-muted-foreground" title={note}>{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <AnimatedNumber value={share.pct} format={(v) => `${v.toFixed(0)}%`} className="text-2xl font-bold" />
        <span className="text-xs text-muted-foreground tabular-nums">{share.count} of {share.known}</span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden" aria-hidden="true">
        <motion.div className={`h-full origin-left ${bar}`} style={{ width: `${share.pct ?? 0}%` }} {...GROW_BAR} />
      </div>
    </Card>
  );
}

/**
 * How broad the market's moves are across the tracked stocks: how many are in
 * uptrends, stretched, trending or accumulating, with every scan count one
 * click from the screener rows behind it.
 */
export default function BreadthSection() {
  const { data, isLoading, error } = useScreenerUniverse();
  const breadth = useMemo(() => (data ? computeBreadth(data.values()) : null), [data]);
  const counts = useMemo(() => (data ? scanCounts(data.values()) : null), [data]);

  return (
    <section aria-labelledby="breadth" className="space-y-5 scroll-mt-32">
      <SectionHeading id="breadth" title="Breadth & scans" subtitle="How widely trends, extremes and quality are spread across the tracked stocks, computed from each one's own daily bars and filings." />

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : error || !breadth || !counts ? (
        <p className="text-sm text-muted-foreground">Breadth is unavailable right now.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <ShareTile label="Advancing today" share={breadth.advancers} tone="up" note="Priced stocks up on the previous close" />
            <ShareTile label="Above 200DMA" share={breadth.above200} tone="up" note="Close above the 200-day moving average" />
            <ShareTile label="50DMA over 200DMA" share={breadth.golden} tone="up" note="Stocks in the 'golden cross' state" />
            <ShareTile label="Delivery rising" share={breadth.deliveryRising} tone="neutral" note="Delivery share above its own 60-day baseline" />
            <ShareTile label="Strong uptrend" share={breadth.trendingUp} tone="up" note="ADX above 25 with +DI over −DI" />
            <ShareTile label="Strong downtrend" share={breadth.trendingDown} tone="down" note="ADX above 25 with −DI over +DI" />
            <ShareTile label="RSI 70 or above" share={breadth.rsiOverbought} tone="neutral" note="RSI (14) at or above 70" />
            <ShareTile label="RSI 30 or below" share={breadth.rsiOversold} tone="neutral" note="RSI (14) at or below 30" />
          </div>
          <p className="text-xs text-muted-foreground">
            Median RSI {formatMetric(breadth.medianRsi, "number")} · median three-month return {formatMetric(breadth.medianReturn3m, "signed_pct")}
          </p>

          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <Card className="p-4">
              <h3 className="font-semibold">Scan counts</h3>
              <p className="text-xs text-muted-foreground mb-3">Each opens the screener with the scan applied.</p>
              <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {FEATURED_SCANS.map((id) => {
                  const scan = SCAN_BY_ID.get(id);
                  if (!scan) return null;
                  return (
                    <li key={id}>
                      <Link to={`/screener?scan=${id}`} title={scan.desc} className="flex items-baseline justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:border-foreground/30 hover:bg-muted/40 transition-colors">
                        <span className="truncate">{scan.name}</span>
                        <span className="font-mono tabular-nums text-muted-foreground">{counts.get(id) ?? 0}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>

            <Card className="p-0 overflow-hidden">
              <div className="grid grid-cols-2 divide-x">
                {([["Leading the Nifty", breadth.leaders], ["Lagging the Nifty", breadth.laggards]] as const).map(([title, rows]) => (
                  <div key={title} className="min-w-0">
                    <h3 className="px-4 pt-4 pb-2 text-sm font-semibold">{title}</h3>
                    <ol className="pb-2">
                      {rows.map((r) => (
                        <li key={r.symbol} className="flex items-baseline justify-between gap-2 border-t px-4 py-1.5 text-sm">
                          <Link to={`/stock/${encodeURIComponent(r.symbol)}`} className="truncate font-semibold hover:text-primary">{r.symbol}</Link>
                          <span className={`tabular-nums ${r.risk!.relative_strength_3m! >= 0 ? "text-secondary" : "text-destructive"}`}>{formatMetric(r.risk!.relative_strength_3m, "points")}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
              <p className="border-t px-4 py-2 text-xs text-muted-foreground">Percentage points ahead of or behind the Nifty 50 over three months.</p>
            </Card>
          </div>
        </>
      )}
    </section>
  );
}

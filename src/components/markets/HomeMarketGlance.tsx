import { useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Activity } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import AnimatedNumber from "@/components/ui/animated-number";
import LiveIndicator from "@/components/ui/live-indicator";
import { revealItem, revealSection } from "@/lib/motion";
import { useScreenerUniverse } from "@/hooks/useScreenerUniverse";
import { computeBreadth } from "@/lib/market-breadth";
import { getWorldBoard } from "@/lib/world-markets";
import FiiDiiCashCard from "./FiiDiiCashCard";
import { HeatStrip } from "./WorldMarketsSection";

/**
 * The home page's window onto the terminal: how broad the day's move is, where
 * institutions put money, and how the world closed - each figure linking on to
 * the page that explains it. Every block renders only once its data exists.
 */
export default function HomeMarketGlance() {
  const universe = useScreenerUniverse();
  const board = useQuery({ queryKey: ["world-board"], queryFn: getWorldBoard, staleTime: 15 * 60_000, retry: 1 });
  const breadth = useMemo(() => (universe.data ? computeBreadth(universe.data.values()) : null), [universe.data]);

  const tiles = breadth
    ? [
        { label: "Advancing today", share: breadth.advancers, tone: "text-secondary", href: "/screener" },
        { label: "Above 200-day average", share: breadth.above200, tone: "text-secondary", href: "/screener?scan=above_200" },
        { label: "In a strong uptrend", share: breadth.trendingUp, tone: "text-secondary", href: "/screener?scan=strong_uptrend" },
        { label: "RSI 30 or below", share: breadth.rsiOversold, tone: "text-destructive", href: "/screener?scan=rsi_oversold" },
      ]
    : [];

  return (
    <motion.section {...revealSection} aria-labelledby="home-glance" className="container mx-auto px-4 py-12 md:py-16">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-secondary"><Activity className="h-4 w-4" aria-hidden="true" />Market at a glance</span>
          <h2 id="home-glance" className="mt-2 font-heading text-3xl md:text-4xl font-bold">How broad, who is buying, what the world did</h2>
        </div>
        <Link to="/market-pulse" className="group inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:border-secondary/50 hover:text-secondary transition-colors">
          Open Market Pulse <ArrowRight className="h-4 w-4 transition-transform duration-fast group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {universe.isLoading
          ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24" />)
          : tiles.map((t, i) => (
              <motion.div key={t.label} {...revealItem(i)}>
                <Link to={t.href} className="block h-full rounded-lg border bg-card p-4 transition-[border-color,transform] duration-fast hover:-translate-y-0.5 hover:border-secondary/40">
                  <div className="text-xs font-medium text-muted-foreground">{t.label}</div>
                  <AnimatedNumber value={t.share.pct} format={(v) => `${v.toFixed(0)}%`} className={`mt-1 block text-3xl font-bold ${t.tone}`} />
                  <div className="text-xs text-muted-foreground tabular-nums">{t.share.count} of {t.share.known} tracked stocks</div>
                </Link>
              </motion.div>
            ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <FiiDiiCashCard />
        {board.data && (
          <Card className="p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
              <h3 className="font-semibold">World markets, last close</h3>
              <LiveIndicator updatedAt={board.data.generated_at} />
            </div>
            <HeatStrip rows={board.data.groups.world} />
            <Link to="/market-pulse#world" className="mt-3 inline-block text-xs font-semibold text-secondary hover:underline">See every index, sector and ETF</Link>
          </Card>
        )}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Breadth is computed daily from each tracked stock's own bars. Information only, not investment advice.</p>
    </motion.section>
  );
}

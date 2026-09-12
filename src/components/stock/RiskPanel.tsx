import { motion } from "motion/react";
import { Activity, TrendingDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { revealSection } from "@/lib/motion";
import {
  formatNumber,
  formatPct,
  formatSignedPct,
  rsiZone,
  type PriceAnalytics,
} from "@/lib/stock-analytics";

/**
 * Risk and trend measures computed from this stock's own daily bars.
 *
 * Everything here is DESCRIPTIVE - what the price has already done - and the
 * copy keeps it that way. "Oversold" says where an indicator sits, not what to
 * do about it; there is no signal, score or rating on this panel, because a
 * computed number presented as a verdict is a recommendation whatever it is
 * labelled.
 *
 * A withheld measure renders as a dash with its reason available, never as
 * zero: a stock with eight months of bars genuinely has no 52-week position,
 * and the computation refuses rather than extrapolating one.
 */

const SOURCE_LABEL = "Computed";

type Row = { label: string; value: string; hint?: string; tone?: "up" | "down" };

const tone = (value: number | null, invert = false): Row["tone"] => {
  if (value === null || !Number.isFinite(value)) return undefined;
  const positive = invert ? value < 0 : value > 0;
  return positive ? "up" : "down";
};

function Block({ title, rows }: { title: string; rows: Row[] }) {
  // Nothing in this group could be computed - the whole block is dropped rather
  // than rendering a column of dashes.
  if (rows.every((row) => row.value === "—")) return null;
  return (
    <div className="min-w-0">
      <h4 className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{title}</h4>
      <dl className="mt-2 divide-y divide-border/70">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-3 py-1.5">
            <dt className="text-sm text-muted-foreground" title={row.hint}>{row.label}</dt>
            <dd className={`text-sm font-semibold tabular-nums ${row.tone === "up" ? "text-secondary" : row.tone === "down" ? "text-destructive" : ""}`}>
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default function RiskPanel({ analytics }: { analytics: PriceAnalytics | null }) {
  if (!analytics) return null;
  const zone = rsiZone(analytics.rsi_14);

  const risk: Row[] = [
    { label: "Volatility (1Y)", value: formatPct(analytics.volatility_1y), hint: "Annualised standard deviation of daily log returns." },
    { label: "Downside volatility", value: formatPct(analytics.downside_volatility_1y), hint: "The same dispersion counting only losing days." },
    { label: "Worst 5% of days", value: formatPct(analytics.var_95), hint: "Historical value at risk: on the worst 5% of days this fell at least this much." },
    { label: "Average of that tail", value: formatPct(analytics.cvar_95), hint: "Conditional value at risk - the mean of those worst days." },
    { label: "Max drawdown (1Y)", value: formatPct(analytics.max_drawdown_1y), hint: "Deepest peak-to-trough fall in the window." },
    { label: "Below its peak", value: formatPct(analytics.drawdown_from_peak) },
  ];

  const market: Row[] = [
    { label: `Beta vs ${analytics.benchmark ?? "index"}`, value: formatNumber(analytics.beta_1y) },
    { label: "Correlation", value: formatNumber(analytics.correlation_1y), hint: "How much of the move is explained by the index. Low correlation makes beta a weaker description." },
    { label: "Relative strength (3M)", value: formatSignedPct(analytics.relative_strength_3m), tone: tone(analytics.relative_strength_3m), hint: "Percentage points ahead of (or behind) the index over three months." },
    { label: "ATR (14)", value: formatPct(analytics.atr_pct_14), hint: "Average true range as a share of price - a typical day's swing, gaps included." },
  ];

  const trend: Row[] = [
    { label: "Return 1M", value: formatSignedPct(analytics.return_1m), tone: tone(analytics.return_1m) },
    { label: "Return 3M", value: formatSignedPct(analytics.return_3m), tone: tone(analytics.return_3m) },
    { label: "Return 6M", value: formatSignedPct(analytics.return_6m), tone: tone(analytics.return_6m) },
    { label: "Return 1Y", value: formatSignedPct(analytics.return_1y), tone: tone(analytics.return_1y) },
    { label: "vs 200-day average", value: formatSignedPct(analytics.distance_from_200), tone: tone(analytics.distance_from_200) },
  ];

  const momentum: Row[] = [
    { label: `RSI (14)${zone && zone !== "neutral" ? ` · ${zone}` : ""}`, value: formatNumber(analytics.rsi_14, 1) },
    { label: "MACD histogram", value: formatNumber(analytics.macd_histogram, 2), tone: tone(analytics.macd_histogram), hint: "The gap between MACD and its signal. Positive means momentum is still building, not that price is rising." },
    { label: "Stochastic %K", value: formatNumber(analytics.stochastic_k, 1) },
    { label: "ADX (14)", value: formatNumber(analytics.adx, 1), hint: "Trend strength regardless of direction - read it with the DI pair below." },
    { label: "+DI / −DI", value: analytics.plus_di === null || analytics.minus_di === null ? "—" : `${analytics.plus_di.toFixed(1)} / ${analytics.minus_di.toFixed(1)}` },
    { label: "Money flow index", value: formatNumber(analytics.money_flow_index, 1), hint: "RSI weighted by the money that changed hands." },
  ];

  const participation: Row[] = [
    { label: "Delivery (20d avg)", value: formatPct(analytics.delivery_recent), hint: "Share of traded quantity that actually settled as delivery." },
    { label: "vs its 60-day baseline", value: analytics.delivery_change === null ? "—" : `${analytics.delivery_change > 0 ? "+" : ""}${analytics.delivery_change.toFixed(1)} pts`, tone: tone(analytics.delivery_change) },
    { label: "Volume vs 20-day", value: analytics.volume_zscore === null ? "—" : `${analytics.volume_zscore > 0 ? "+" : ""}${analytics.volume_zscore.toFixed(1)}σ`, tone: tone(analytics.volume_zscore) },
    { label: "Close vs day's VWAP", value: formatSignedPct(analytics.close_vs_vwap), tone: tone(analytics.close_vs_vwap), hint: "The exchange's own turnover divided by volume - the true volume-weighted price, not an estimate." },
    { label: "52-week position", value: analytics.week52_position === null ? "—" : `${analytics.week52_position.toFixed(0)} / 100`, hint: "0 sits at the 52-week low, 100 at the high." },
  ];

  return (
    <motion.section {...revealSection} className="mt-8" aria-labelledby="risk-heading">
      <Card className="p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-secondary" />
            <div>
              <h2 id="risk-heading" className="font-heading text-xl font-bold">Risk &amp; trend</h2>
              <p className="text-xs text-muted-foreground">
                From {analytics.observations} daily sessions to {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(analytics.as_of))}.
                {analytics.actions_applied > 0 && ` Adjusted for ${analytics.actions_applied} corporate action${analytics.actions_applied > 1 ? "s" : ""}.`}
              </p>
            </div>
          </div>
          <Badge variant="outline">{SOURCE_LABEL}</Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6 mt-5">
          <Block title="Risk" rows={risk} />
          <Block title="Against the market" rows={market} />
          <Block title="Return" rows={trend} />
          <Block title="Momentum" rows={momentum} />
          <Block title="Participation" rows={participation} />
        </div>

        <p className="mt-5 text-xs text-muted-foreground leading-relaxed">
          <TrendingDown className="inline w-3.5 h-3.5 mr-1 align-[-2px]" />
          These describe what this stock's price has already done. They are not forecasts, signals or
          recommendations, and a dash means the figure was withheld for want of enough history rather than being zero.
        </p>
      </Card>
    </motion.section>
  );
}

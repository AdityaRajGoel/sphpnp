import { motion } from "motion/react";
import { FlaskConical } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { revealSection } from "@/lib/motion";
import { formatSignedPct, type Forecast } from "@/lib/stock-analytics";

/**
 * The Kronos research band.
 *
 * THREE RULES THIS COMPONENT EXISTS TO KEEP, none of them cosmetic:
 *
 *  1. A RANGE IS SHOWN, NEVER A NUMBER. The model samples continuations of a
 *     price series; its honest output is a distribution. The stored row has no
 *     single "predicted price" column to render even if someone wanted to, and
 *     the midpoint is labelled as the middle of the simulated range rather than
 *     as an expected price - because a lone figure beside a company's name
 *     reads as a price target no matter what the caption says.
 *  2. THE DISCLAIMER COMES FROM THE ROW, not from a constant in this file. It
 *     travels with the data, so an API consumer reading the table gets it too
 *     and a refactor here cannot quietly drop it.
 *  3. THE MODEL AND ITS SAMPLE COUNT ARE NAMED. A band from 30 draws of a named
 *     model is a checkable claim; an unattributed band is an oracle.
 */

const formatPrice = (value: number) =>
  `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export default function ForecastPanel({ forecast }: { forecast: Forecast | null }) {
  if (!forecast) return null;

  const asOf = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(forecast.as_of));
  // The band is drawn relative to the last close so the reader sees where the
  // range sits around today rather than two unanchored numbers.
  const span = forecast.band_high - forecast.band_low;
  const position = span > 0 ? ((forecast.last_close - forecast.band_low) / span) * 100 : 50;

  return (
    <motion.section {...revealSection} className="mt-8" aria-labelledby="forecast-heading">
      <Card className="p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-secondary" />
            <div>
              <h2 id="forecast-heading" className="font-heading text-xl font-bold">Model simulation</h2>
              <p className="text-xs text-muted-foreground">
                {forecast.samples} independent runs of {forecast.model}, conditioned on daily bars to {asOf},
                simulating {forecast.horizon_days} sessions ahead.
              </p>
            </div>
          </div>
          <Badge variant="outline">Research</Badge>
        </div>

        {/* The disclaimer sits ABOVE the numbers, not under them: a reader who
            stops after the figures should already have read it. */}
        <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
          <strong>Research output, not advice.</strong> {forecast.disclaimer}
        </div>

        <div className="mt-5">
          <div className="flex items-end justify-between gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Lower edge (10th percentile)</p>
              <p className="font-heading text-xl font-bold tabular-nums">{formatPrice(forecast.band_low)}</p>
              <p className="text-xs text-muted-foreground tabular-nums">{formatSignedPct(forecast.band_low_pct)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Upper edge (90th percentile)</p>
              <p className="font-heading text-xl font-bold tabular-nums">{formatPrice(forecast.band_high)}</p>
              <p className="text-xs text-muted-foreground tabular-nums">{formatSignedPct(forecast.band_high_pct)}</p>
            </div>
          </div>

          <div className="relative mt-3 h-2.5 rounded-full bg-gradient-to-r from-muted via-secondary/30 to-muted" aria-hidden="true">
            <span
              className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2 bg-foreground"
              style={{ left: `${Math.min(100, Math.max(0, position))}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            The marker is the last close, {formatPrice(forecast.last_close)}. Eight of every ten simulated runs
            ended inside this range; the middle run ended at {formatPrice(forecast.band_mid)}
            {" "}({formatSignedPct(forecast.band_mid_pct)}), which is the centre of the simulation and not an
            expected or target price.
          </p>
        </div>

        <p className="mt-4 text-xs text-muted-foreground leading-relaxed">
          The model reads price history only. It has not seen this company's results, its filings, its industry
          or anything that happened after {asOf}. Ranges widen with horizon because the further out the
          simulation runs, the less the recent past constrains it.
        </p>
      </Card>
    </motion.section>
  );
}

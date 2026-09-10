import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { LineChart as LineChartIcon, AlertCircle } from "lucide-react";
import PriceChart from "@/components/charts/PriceChart";
import { zipSeries } from "@/lib/chart-data";
import { periodReturnPct, rsi, rsiZone } from "@/lib/technicals";
import { supabase } from "@/integrations/supabase/client";
import { revealItem } from "@/lib/motion";
import { Card } from "@/components/ui/card";

/**
 * Price history and indicators for one scrip.
 *
 * The stock page — the surface this whole product is built around — had no
 * chart at all, while `PriceChart` was already working in four other places and
 * `technicals.ts` was only ever used by the multi-stock comparison tool. Nothing
 * new is computed here: this is the existing chart component and the existing
 * indicator maths reaching the page that most needs them.
 *
 * The three states are rendered distinctly on purpose. An empty chart frame
 * looks like a flat market rather than an absent feed, so a symbol with no
 * history says so in words instead.
 */

type Range = { label: string; api: string };

/** Matches the ranges `fetch-stock-chart` accepts (see LiveChart's rangeMap). */
const RANGES: readonly Range[] = [
  { label: "1M", api: "1mo" },
  { label: "6M", api: "6mo" },
  { label: "1Y", api: "1y" },
  { label: "5Y", api: "5y" },
];

type Point = { t: number; c: number; v: number };

const StockPriceChart = ({ symbol, name }: { symbol: string; name: string }) => {
  const [range, setRange] = useState<Range>(RANGES[1]);
  const [points, setPoints] = useState<Point[] | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "empty" | "error">("loading");

  useEffect(() => {
    let active = true;
    setState("loading");
    setPoints(null);

    supabase.functions
      .invoke("fetch-stock-chart", { body: { symbol, range: range.api } })
      .then(({ data, error }) => {
        if (!active) return;
        if (error || !data?.success) {
          setState("error");
          return;
        }
        const raw = (data.dataPoints ?? []) as Point[];
        // A close of 0 is the feed's "no trade" filler, not a price. Left in, it
        // would draw a cliff to the axis and drag every indicator with it.
        const clean = raw.filter((p) => Number.isFinite(p?.c) && p.c > 0);
        setPoints(clean);
        setState(clean.length > 1 ? "ready" : "empty");
      })
      .catch(() => {
        if (active) setState("error");
      });

    return () => {
      active = false;
    };
  }, [symbol, range]);

  const closes = useMemo(() => (points ?? []).map((p) => p.c), [points]);

  // RSI needs 15 closes for its 14-period default; below that it returns null
  // and the badge stays away rather than showing a figure built from too little.
  const rsiValue = useMemo(() => (closes.length >= 15 ? rsi(closes) : null), [closes]);
  const zone = rsiZone(rsiValue);
  const changePct = useMemo(() => periodReturnPct(closes), [closes]);

  return (
    <motion.section {...revealItem()} aria-labelledby={`chart-${symbol}`} className="mt-6">
      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <LineChartIcon className="h-4 w-4 text-secondary" aria-hidden="true" />
            <h2 id={`chart-${symbol}`} className="font-heading text-base font-bold">
              Price history
            </h2>
          </div>

          {/* Scrolls rather than wraps: four labels fit at 375px today, but a
              fifth range must push sideways, not reflow the header. */}
          <div
            role="tablist"
            aria-label="Chart range"
            className="-mx-1 flex gap-1 overflow-x-auto px-1"
          >
            {RANGES.map((r) => (
              <button
                key={r.label}
                role="tab"
                type="button"
                aria-selected={r.label === range.label}
                onClick={() => setRange(r)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-[background-color,color] duration-fast ${
                  r.label === range.label
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {state === "ready" && points ? (
          <>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
              {changePct !== null && (
                <span className="text-muted-foreground">
                  {range.label} change{" "}
                  <span
                    className={`font-semibold tabular-nums ${
                      changePct >= 0 ? "text-emerald-600" : "text-destructive"
                    }`}
                  >
                    {changePct >= 0 ? "+" : ""}
                    {changePct.toFixed(2)}%
                  </span>
                </span>
              )}
              {rsiValue !== null && (
                <span className="text-muted-foreground">
                  {/* Labelled as a reading, never as a signal. This is a
                      SEBI-registered broker's site: an indicator presented with
                      buy/sell framing reads as advice. */}
                  RSI (14){" "}
                  <span className="font-semibold tabular-nums text-foreground">
                    {rsiValue.toFixed(1)}
                  </span>{" "}
                  <span
                    className={
                      zone.tone === "over"
                        ? "text-destructive"
                        : zone.tone === "under"
                          ? "text-emerald-600"
                          : "text-muted-foreground"
                    }
                  >
                    {zone.label}
                  </span>
                </span>
              )}
              <span className="text-muted-foreground">SMA 20 · 50 overlaid</span>
            </div>

            <div className="mt-2">
              <PriceChart
                data={zipSeries(
                  points.map((p) => p.c),
                  points.map((p) => p.v),
                  points.map((p) => p.t),
                )}
                mode="area"
                height={260}
                watermark={symbol}
                smaPeriods={[20, 50]}
                showVolume={points.some((p) => p.v > 0)}
              />
            </div>
          </>
        ) : (
          <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 text-center text-muted-foreground">
            {state === "loading" ? (
              <>
                <LineChartIcon className="h-8 w-8 animate-pulse opacity-25" aria-hidden="true" />
                <p className="text-sm">Loading {range.label} price history…</p>
              </>
            ) : (
              <>
                <AlertCircle className="h-8 w-8 opacity-25" aria-hidden="true" />
                <p className="text-sm font-semibold">
                  {state === "empty"
                    ? `No ${range.label} price history for ${name}`
                    : "Price history is unavailable right now"}
                </p>
                <p className="text-xs">
                  {state === "empty"
                    ? "Try a longer range — recently listed scrips have a short history."
                    : "The chart feed did not respond. Try another range in a moment."}
                </p>
              </>
            )}
          </div>
        )}
      </Card>
    </motion.section>
  );
};

export default StockPriceChart;

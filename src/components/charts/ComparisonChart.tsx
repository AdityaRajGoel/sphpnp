import { useEffect, useRef } from "react";
import {
  createChart,
  LineSeries,
  TickMarkType,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { rebase, sma } from "@/lib/technicals";

/**
 * Multi-symbol performance comparison, every series rebased to 100.
 *
 * Separate from PriceChart on purpose. That one draws a single instrument in
 * rupees with a volume pane; this one draws N instruments on a unitless index
 * where only relative shape matters, and a rupee axis would be meaningless
 * across scrips trading at ₹180 and ₹2,890.
 */

export interface ComparisonSeries {
  symbol: string;
  /** Raw closes with millisecond timestamps, as the edge functions return them. */
  points: readonly { t: number; c: number }[];
}

interface ComparisonChartProps {
  series: readonly ComparisonSeries[];
  height?: number;
  /**
   * Moving averages, drawn only when a single symbol is shown. Across several
   * lines they are visual noise rather than information.
   */
  smaPeriods?: readonly number[];
}

/**
 * Exported so the legend chips and stat cards colour themselves from the same
 * array the lines are drawn with; two copies would drift the first time one
 * changed.
 *
 * Literal colours rather than `hsl(var(--brand-orange))`: these are painted
 * into a canvas, where CSS custom properties do not resolve.
 */
export const LINE_COLORS = [
  "hsl(24 95% 53%)",
  "hsl(150 60% 32%)",
  "#3b82f6",
  "hsl(43 96% 56%)",
];

const IST = "Asia/Kolkata";
const istDate = new Intl.DateTimeFormat("en-IN", { timeZone: IST, day: "2-digit", month: "short" });
const istTime = new Intl.DateTimeFormat("en-IN", {
  timeZone: IST,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function token(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return raw ? `hsl(${raw})` : fallback;
}

const ComparisonChart = ({ series, height = 300, smaPeriods }: ComparisonChartProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRefs = useRef<Map<string, ISeriesApi<"Line", UTCTimestamp>>>(new Map());
  const smaRefs = useRef<ISeriesApi<"Line", UTCTimestamp>[]>([]);

  const singleMode = series.length === 1;
  const smaKey = singleMode ? (smaPeriods ?? []).join(",") : "";

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const grid = token("--border", "hsl(210 30% 90%)");
    const text = token("--muted-foreground", "hsl(213 30% 40%)");

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { color: "transparent" },
        textColor: text,
        fontFamily: "'Open Sans', system-ui, sans-serif",
        attributionLogo: false,
      },
      grid: { vertLines: { color: grid }, horzLines: { color: grid } },
      rightPriceScale: { borderColor: grid },
      timeScale: {
        borderColor: grid,
        timeVisible: true,
        tickMarkFormatter: (t: UTCTimestamp, tickType: TickMarkType) =>
          tickType === TickMarkType.Time || tickType === TickMarkType.TimeWithSeconds
            ? istTime.format(new Date(t * 1000))
            : istDate.format(new Date(t * 1000)),
      },
      localization: {
        // Values are a rebased index, not money. Showing the delta from the
        // 100 baseline is what a comparison is actually asking.
        priceFormatter: (v: number) => `${v >= 100 ? "+" : ""}${(v - 100).toFixed(2)}%`,
      },
      crosshair: { mode: 1 },
    });

    chartRef.current = chart;
    return () => {
      chartRef.current = null;
      seriesRefs.current.clear();
      smaRefs.current = [];
      chart.remove();
    };
  }, [height]);

  // Rebuild series when the symbol set changes. Keyed on symbols rather than
  // the data itself so a refetch of the same scrips updates in place.
  const symbolKey = series.map((s) => s.symbol).join(",");
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    seriesRefs.current.forEach((s) => chart.removeSeries(s));
    seriesRefs.current.clear();
    smaRefs.current.forEach((s) => chart.removeSeries(s));
    smaRefs.current = [];

    series.forEach((s, i) => {
      seriesRefs.current.set(
        s.symbol,
        chart.addSeries(LineSeries, {
          color: LINE_COLORS[i % LINE_COLORS.length],
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: true,
        }) as ISeriesApi<"Line", UTCTimestamp>,
      );
    });

    if (smaKey) {
      smaRefs.current = smaKey.split(",").map(
        () =>
          chart.addSeries(LineSeries, {
            color: token("--muted-foreground", "hsl(213 30% 40%)"),
            lineWidth: 1,
            lineStyle: 2,
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerVisible: false,
          }) as ISeriesApi<"Line", UTCTimestamp>,
      );
    }
  }, [symbolKey, smaKey, series]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    series.forEach((s) => {
      const api = seriesRefs.current.get(s.symbol);
      if (!api) return;

      // Sort and de-duplicate before rebasing: the library needs strictly
      // ascending unique times, and rebase divides by the first positive
      // close, so order decides the baseline every other point is measured
      // against.
      const byTime = new Map<number, number>();
      for (const p of s.points) {
        if (Number.isFinite(p.t) && Number.isFinite(p.c)) byTime.set(Math.floor(p.t / 1000), p.c);
      }
      const sorted = [...byTime.entries()].sort(([a], [b]) => a - b);
      const rebased = rebase(sorted.map(([, c]) => c));

      api.setData(
        sorted.map(([t], i) => ({ time: t as UTCTimestamp, value: rebased[i] })),
      );

      if (singleMode && smaKey) {
        const periods = smaKey.split(",").map(Number);
        smaRefs.current.forEach((smaApi, idx) => {
          const period = periods[idx];
          if (!period) return;
          // Average the rebased series directly so the overlay shares the
          // baseline. Averaging raw closes and rebasing afterwards shifts the
          // line off the price it is meant to track.
          smaApi.setData(
            sma(rebased, period)
              .map((v, i) => (v === null ? null : { time: sorted[i][0] as UTCTimestamp, value: v }))
              .filter((p): p is { time: UTCTimestamp; value: number } => p !== null),
          );
        });
      }
    });

    chart.timeScale().fitContent();
  }, [series, singleMode, smaKey]);

  return <div ref={containerRef} style={{ height }} className="w-full" aria-label="Performance comparison chart" />;
};

export default ComparisonChart;

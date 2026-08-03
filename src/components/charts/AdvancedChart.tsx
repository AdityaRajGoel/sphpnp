import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Chart } from "klinecharts";
import { Skeleton } from "@/components/ui/skeleton";
import { toKLineData, type ApiChartPoint, type KLineBar } from "@/lib/chart-data";

/**
 * Advanced price chart, backed by KLineChart (Apache-2.0).
 *
 * This sits alongside PriceChart rather than replacing it. PriceChart renders
 * the small, fixed candle/volume views embedded across the site and is fine at
 * that job; this one exists for the cases PriceChart cannot do at all — a
 * choosable indicator set and user-drawn annotations.
 *
 * Two reasons it is KLineChart and not TradingView's Advanced Charts: that
 * library is free but closed-source and access-gated, and this one is the same
 * Apache-2.0 licence we already ship lightweight-charts under.
 *
 * The library is imported dynamically. It reads `window` at module scope, and
 * the build prerenders every route through Puppeteer, so a static import would
 * put ~40kB and a browser-only dependency into the entry chunk for every page
 * that does not show a chart.
 */

/** Indicators drawn over the candles rather than in their own pane. */
const OVERLAY_INDICATORS = ["MA", "EMA", "BOLL", "SAR"] as const;
/** Indicators that need their own pane stacked beneath the candles. */
const PANE_INDICATORS = ["VOL", "MACD", "RSI", "KDJ"] as const;

type OverlayIndicator = (typeof OVERLAY_INDICATORS)[number];
type PaneIndicator = (typeof PANE_INDICATORS)[number];
type IndicatorName = OverlayIndicator | PaneIndicator;

const DRAWING_TOOLS = [
  { name: "horizontalStraightLine", label: "H-line" },
  { name: "segment", label: "Segment" },
  { name: "rayLine", label: "Ray" },
  { name: "priceLine", label: "Price" },
  { name: "parallelStraightLine", label: "Channel" },
  { name: "fibonacciLine", label: "Fib" },
  { name: "rect", label: "Rect" },
  { name: "simpleAnnotation", label: "Note" },
] as const;

interface AdvancedChartProps {
  data: readonly ApiChartPoint[];
  /** Shown in the crosshair readout and tooltips. */
  ticker: string;
  /** Decimals for price formatting. Indian equities quote to paise. */
  pricePrecision?: number;
  height?: number;
  /** Indicators enabled on first render. */
  defaultIndicators?: readonly IndicatorName[];
  className?: string;
}

/**
 * Resolve a design token to a concrete colour.
 *
 * Tokens are stored as bare HSL triplets ("150 60% 32%"), so they have to be
 * wrapped before a non-CSS consumer like a canvas renderer can use them. Same
 * approach as PriceChart, kept in step deliberately: the two charts should not
 * disagree about what "up" looks like.
 */
const token = (name: string, fallback: string): string => {
  if (typeof window === "undefined") return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return raw ? `hsl(${raw})` : fallback;
};

function chartStyles() {
  const up = token("--secondary", "hsl(150 60% 32%)");
  const down = token("--destructive", "hsl(0 84.2% 50%)");
  const text = token("--muted-foreground", "hsl(213 30% 40%)");
  const grid = token("--border", "hsl(210 30% 90%)");

  return {
    grid: {
      horizontal: { color: grid },
      vertical: { color: grid },
    },
    candle: {
      bar: {
        upColor: up,
        downColor: down,
        upBorderColor: up,
        downBorderColor: down,
        upWickColor: up,
        downWickColor: down,
      },
      priceMark: {
        high: { color: text },
        low: { color: text },
      },
    },
    xAxis: {
      axisLine: { color: grid },
      tickLine: { color: grid },
      tickText: { color: text },
    },
    yAxis: {
      axisLine: { color: grid },
      tickLine: { color: grid },
      tickText: { color: text },
    },
    crosshair: {
      horizontal: { line: { color: text }, text: { backgroundColor: text } },
      vertical: { line: { color: text }, text: { backgroundColor: text } },
    },
  };
}

/**
 * Add one indicator.
 *
 * Shared by the initial render and the chips so they cannot disagree. They did
 * once: `defaultIndicators` seeded the chip state only, so the default set drew
 * as enabled while nothing had been created on the chart.
 */
function addIndicator(chart: Chart, name: IndicatorName): string | null {
  const isOverlay = (OVERLAY_INDICATORS as readonly string[]).includes(name);
  return chart.createIndicator(
    // Overlay indicators target the candle pane by id; the rest get their own.
    // In v10 the target rides inside the create object, not a third argument.
    isOverlay ? { name, paneId: "candle_pane" } : { name },
    // Stack pane indicators instead of replacing the previous one.
    !isOverlay,
  );
}

/**
 * The chart pulls bars through a loader rather than being handed an array, so
 * this reads from a ref: that keeps the loader identity irrelevant and lets new
 * data arrive without tearing down the chart and losing the user's drawings.
 */
const makeLoader = (ref: { current: KLineBar[] }) => ({
  getBars: ({ type, callback }: { type: string; callback: (d: KLineBar[], more?: boolean) => void }) => {
    // Everything is already in memory; there is no older history to page in, so
    // anything but the initial load resolves empty and stops the chart asking.
    callback(type === "init" ? ref.current : [], false);
  },
});

const AdvancedChart = ({
  data,
  ticker,
  pricePrecision = 2,
  height = 460,
  defaultIndicators = ["VOL"],
  className = "",
}: AdvancedChartProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<Chart | null>(null);

  const [ready, setReady] = useState(false);
  const [active, setActive] = useState<Set<IndicatorName>>(() => new Set(defaultIndicators));

  // Captured once. Callers pass this as an inline array, so depending on it
  // directly would rebuild the chart on every parent render and wipe any
  // drawings the user had placed. The prop only claims to describe first render.
  const initialIndicators = useRef(defaultIndicators);
  const [tool, setTool] = useState<string | null>(null);

  // Derived, not stored. Memoised so a parent re-render does not re-walk and
  // re-sort every bar, and assigned through an effect rather than during render
  // — writing a ref mid-render is a side effect in a phase that must stay pure.
  const bars = useMemo(() => toKLineData(data), [data]);
  const barsRef = useRef(bars);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    let chart: Chart | null = null;

    void (async () => {
      const kline = await import("klinecharts");
      if (disposed || !containerRef.current) return;

      chart = kline.init(containerRef.current, {
        // The reason this chart can be correct about Indian sessions where
        // lightweight-charts cannot: that library has no timezone option, so
        // PriceChart shifts timestamps by hand. Here the renderer does it.
        timezone: "Asia/Kolkata",
        styles: chartStyles(),
      });
      if (!chart) return;

      chart.setSymbol({ ticker, pricePrecision, volumePrecision: 0 });
      chart.setPeriod({ type: "day", span: 1 });
      chart.setDataLoader(makeLoader(barsRef));

      // Draw whatever the chips already claim is on.
      for (const name of initialIndicators.current) addIndicator(chart, name);

      chartRef.current = chart;
      setReady(true);
    })();

    return () => {
      disposed = true;
      const current = chartRef.current ?? chart;
      if (current) {
        void import("klinecharts").then((kline) => kline.dispose(current));
      }
      chartRef.current = null;
    };
    // Rebuilding on ticker/precision change is intended: they describe a
    // different instrument, so stale drawings would be meaningless anyway.
  }, [ticker, pricePrecision]);

  /** Push new bars without tearing the chart down. */
  useEffect(() => {
    barsRef.current = bars;
    const chart = chartRef.current;
    if (!chart || !ready) return;
    chart.setDataLoader(makeLoader(barsRef));
  }, [bars, ready]);

  /** Re-theme in place when the user flips light/dark. */
  useEffect(() => {
    if (!ready) return;
    const observer = new MutationObserver(() => {
      chartRef.current?.setStyles(chartStyles());
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, [ready]);

  /**
   * Chart mutation happens here, not inside the setState updater it used to
   * live in. React invokes updaters twice under StrictMode, so a remove ran and
   * the next invocation immediately re-created the indicator. Updaters must be
   * pure; the side effect belongs out here where it runs once.
   *
   * Removal filters by name rather than by the id createIndicator hands back.
   * That id identifies the indicator, not the pane, so the earlier
   * `{ paneId, name }` filter matched nothing: toggling off was a no-op and
   * toggling on again stacked a second identical pane onto the chart.
   */
  const toggleIndicator = useCallback((name: IndicatorName) => {
    const chart = chartRef.current;
    if (!chart) return;

    const isOn = active.has(name);

    setActive((prev) => {
      const next = new Set(prev);
      if (isOn) next.delete(name);
      else next.add(name);
      return next;
    });

    if (isOn) chart.removeIndicator({ name });
    else addIndicator(chart, name);
  }, [active]);

  const selectTool = useCallback((name: string) => {
    const chart = chartRef.current;
    if (!chart) return;
    setTool(name);
    chart.createOverlay(name);
  }, []);

  const clearDrawings = useCallback(() => {
    chartRef.current?.removeOverlay();
    setTool(null);
  }, []);

  const chipBase =
    "text-xs font-semibold px-2.5 py-1 rounded-lg border transition-colors duration-fast";
  const chipOff =
    "border-border bg-card text-muted-foreground hover:text-foreground hover:border-secondary/40";
  const chipOn = "border-secondary/50 bg-secondary/10 text-secondary";

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mr-1">
            Indicators
          </span>
          {[...OVERLAY_INDICATORS, ...PANE_INDICATORS].map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => toggleIndicator(name)}
              disabled={!ready}
              aria-pressed={active.has(name)}
              className={`${chipBase} ${active.has(name) ? chipOn : chipOff} disabled:opacity-50`}
            >
              {name}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mr-1">
            Draw
          </span>
          {DRAWING_TOOLS.map(({ name, label }) => (
            <button
              key={name}
              type="button"
              onClick={() => selectTool(name)}
              disabled={!ready}
              aria-pressed={tool === name}
              className={`${chipBase} ${tool === name ? chipOn : chipOff} disabled:opacity-50`}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={clearDrawings}
            disabled={!ready}
            className={`${chipBase} ${chipOff} disabled:opacity-50`}
          >
            Clear
          </button>
        </div>
      </div>

      <div className="relative rounded-xl border border-border/50 overflow-hidden bg-card">
        <div ref={containerRef} style={{ height }} />
        {!ready && (
          <Skeleton className="absolute inset-0 rounded-none" aria-label="Loading chart" />
        )}
      </div>
    </div>
  );
};

export default AdvancedChart;

import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  AreaSeries,
  LineSeries,
  createTextWatermark,
  type IChartApi,
  type ISeriesApi,
  TickMarkType,
  type UTCTimestamp,
} from "lightweight-charts";
import { toCandles, toVolume, sma, type ApiChartPoint } from "@/lib/chart-data";

/**
 * Financial price chart: candlesticks (or an area line) over a volume pane.
 *
 * Replaces a hand-rolled SVG renderer that existed only because recharts has
 * no candlestick primitive. Everything that renderer approximated - price
 * scaling, hit-testing, crosshair - is native here.
 *
 * Colours are read from the site's own CSS custom properties rather than
 * hardcoded, so the chart follows the theme toggle. The properties hold bare
 * HSL triplets ("150 60% 32%"), hence the hsl() wrapping.
 */

export type PriceChartMode = "candle" | "area";

interface PriceChartProps {
  data: readonly ApiChartPoint[];
  mode?: PriceChartMode;
  height?: number;
  /** Shown faintly behind the series. Usually the scrip symbol. */
  watermark?: string;
  /**
   * Moving-average overlays, e.g. [20, 50]. Each becomes its own LineSeries
   * on the price scale. Periods longer than the dataset render as nothing
   * rather than a partial line.
   */
  smaPeriods?: readonly number[];
  /** Hide the volume pane where the caller has no volume worth showing. */
  showVolume?: boolean;
}

/** Distinct, deliberately secondary colours so overlays never outrank price. */
const SMA_COLORS = ["hsl(43 96% 56%)", "hsl(210 80% 60%)", "hsl(280 65% 65%)"];

/** India-wide: NSE/BSE sessions are quoted in IST, not the viewer's zone. */
const IST = "Asia/Kolkata";

const istDate = new Intl.DateTimeFormat("en-IN", {
  timeZone: IST,
  day: "2-digit",
  month: "short",
});
const istTime = new Intl.DateTimeFormat("en-IN", {
  timeZone: IST,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const istDateTime = new Intl.DateTimeFormat("en-IN", {
  timeZone: IST,
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** Read one of the site's HSL-triplet custom properties as a usable colour. */
function token(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return raw ? `hsl(${raw})` : fallback;
}

function palette() {
  return {
    up: token("--secondary", "hsl(150 60% 32%)"),
    down: token("--destructive", "hsl(0 84.2% 50%)"),
    text: token("--muted-foreground", "hsl(213 30% 40%)"),
    grid: token("--border", "hsl(210 30% 90%)"),
  };
}

const PriceChart = ({
  data,
  mode = "candle",
  height = 320,
  watermark,
  smaPeriods,
  showVolume = true,
}: PriceChartProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const priceRef = useRef<ISeriesApi<"Candlestick" | "Area", UTCTimestamp> | null>(null);
  const volumeRef = useRef<ISeriesApi<"Histogram", UTCTimestamp> | null>(null);
  const smaRefs = useRef<ISeriesApi<"Line", UTCTimestamp>[]>([]);
  // Read inside the create-once effect without making it a dependency, so
  // changing the overlay list never tears down and rebuilds the whole chart.
  const smaKey = (smaPeriods ?? []).join(",");

  // Build the chart once. Recreating it on each render would duplicate canvases
  // and leak the ResizeObserver and every subscription with them.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const c = palette();
    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { color: "transparent" },
        textColor: c.text,
        fontFamily: "'Open Sans', system-ui, sans-serif",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: c.grid },
        horzLines: { color: c.grid },
      },
      rightPriceScale: { borderColor: c.grid },
      timeScale: {
        borderColor: c.grid,
        timeVisible: true,
        // There is no timeScale.timezone option in this library. IST has to be
        // applied in the formatters; shifting the timestamps themselves would
        // move the bars on the underlying UTC scale rather than just relabel them.
        //
        // The library tells us which granularity it is asking for. Ignoring it
        // and always printing the date makes an intraday axis read "24 Jul"
        // over and over, which is what the hand-rolled chart had to work around
        // with a separate hardcoded row of time labels.
        tickMarkFormatter: (t: UTCTimestamp, tickType: TickMarkType) =>
          tickType === TickMarkType.Time || tickType === TickMarkType.TimeWithSeconds
            ? istTime.format(new Date(t * 1000))
            : istDate.format(new Date(t * 1000)),
      },
      localization: {
        priceFormatter: (p: number) =>
          `₹${p.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        timeFormatter: (t: UTCTimestamp) => istDateTime.format(new Date(t * 1000)),
      },
      crosshair: { mode: 1 },
    });

    const price =
      mode === "candle"
        ? chart.addSeries(CandlestickSeries, {
            upColor: c.up,
            downColor: c.down,
            borderUpColor: c.up,
            borderDownColor: c.down,
            wickUpColor: c.up,
            wickDownColor: c.down,
          })
        : chart.addSeries(AreaSeries, {
            lineColor: c.up,
            topColor: c.up.replace("hsl(", "hsla(").replace(")", " / 0.28)"),
            bottomColor: c.up.replace("hsl(", "hsla(").replace(")", " / 0)"),
            lineWidth: 2,
          });

    smaRefs.current = (smaKey ? smaKey.split(",") : []).map((_, i) =>
      chart.addSeries(LineSeries, {
        color: SMA_COLORS[i % SMA_COLORS.length],
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      }) as ISeriesApi<"Line", UTCTimestamp>,
    );

    if (showVolume) {
      // paneIndex 1 is one past the existing pane, so the library creates it.
      const volume = chart.addSeries(
        HistogramSeries,
        {
          priceFormat: { type: "volume" },
          // Without these the pane shows a last-value tag rendered through the
          // chart-wide rupee formatter, so a volume of zero reads as "₹0.00"
          // floating against the price axis.
          priceLineVisible: false,
          lastValueVisible: false,
        },
        1,
      );
      chart.panes()[1]?.setHeight(Math.round(height * 0.22));
      volumeRef.current = volume as ISeriesApi<"Histogram", UTCTimestamp>;
    }

    chartRef.current = chart;
    priceRef.current = price as ISeriesApi<"Candlestick" | "Area", UTCTimestamp>;

    return () => {
      chartRef.current = null;
      priceRef.current = null;
      volumeRef.current = null;
      smaRefs.current = [];
      chart.remove();
    };
  }, [mode, height, smaKey, showVolume]);

  // Re-read the palette when the theme class flips on <html>.
  useEffect(() => {
    const target = document.documentElement;
    const observer = new MutationObserver(() => {
      const chart = chartRef.current;
      if (!chart) return;
      const c = palette();
      chart.applyOptions({
        layout: { textColor: c.text },
        grid: { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
        rightPriceScale: { borderColor: c.grid },
        timeScale: { borderColor: c.grid },
      });
    });
    observer.observe(target, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  // Data is its own effect so a prop change never rebuilds the chart.
  useEffect(() => {
    const price = priceRef.current;
    const volume = volumeRef.current;
    // Only the price series is required. Volume is absent by design when
    // showVolume is false, and gating on it here would render nothing at all.
    if (!price) return;

    const c = palette();
    const candles = toCandles(data);

    if (mode === "candle") {
      (price as ISeriesApi<"Candlestick", UTCTimestamp>).setData(candles);
    } else {
      (price as ISeriesApi<"Area", UTCTimestamp>).setData(
        candles.map((k) => ({ time: k.time, value: k.close })),
      );
    }
    volume?.setData(toVolume(data, { up: c.up, down: c.down }));

    // Overlays are computed from the same normalised candles, so their times
    // line up with the price series exactly.
    const periods = smaKey ? smaKey.split(",").map(Number) : [];
    const closes = candles.map((k) => k.close);
    smaRefs.current.forEach((series, i) => {
      const period = periods[i];
      if (!period) return;
      series.setData(
        sma(closes, period)
          .map((v, idx) => (v === null ? null : { time: candles[idx].time, value: v }))
          .filter((p): p is { time: UTCTimestamp; value: number } => p !== null),
      );
    });

    chartRef.current?.timeScale().fitContent();
  }, [data, mode, smaKey]);

  // v5 has no `watermark` chart option; it is a pane primitive.
  useEffect(() => {
    const chart = chartRef.current;
    if (!watermark || !chart) return;
    const pane = chart.panes()[0];
    if (!pane) return;
    createTextWatermark(pane, {
      horzAlign: "center",
      vertAlign: "center",
      lines: [{ text: watermark, color: token("--muted-foreground", "hsl(213 30% 40%)"), fontSize: 44 }],
    });
  }, [watermark]);

  return <div ref={containerRef} style={{ height }} className="w-full" aria-label="Price chart" />;
};

export default PriceChart;

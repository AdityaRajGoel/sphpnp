import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  AreaSeries,
  createTextWatermark,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { toCandles, toVolume, type ApiChartPoint } from "@/lib/chart-data";

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
}

/** India-wide: NSE/BSE sessions are quoted in IST, not the viewer's zone. */
const IST = "Asia/Kolkata";

const istDate = new Intl.DateTimeFormat("en-IN", {
  timeZone: IST,
  day: "2-digit",
  month: "short",
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

const PriceChart = ({ data, mode = "candle", height = 320, watermark }: PriceChartProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const priceRef = useRef<ISeriesApi<"Candlestick" | "Area", UTCTimestamp> | null>(null);
  const volumeRef = useRef<ISeriesApi<"Histogram", UTCTimestamp> | null>(null);

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
        tickMarkFormatter: (t: UTCTimestamp) => istDate.format(new Date(t * 1000)),
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

    // paneIndex 1 is one past the existing pane, so the library creates it.
    const volume = chart.addSeries(HistogramSeries, { priceFormat: { type: "volume" } }, 1);
    chart.panes()[1]?.setHeight(Math.round(height * 0.22));

    chartRef.current = chart;
    priceRef.current = price as ISeriesApi<"Candlestick" | "Area", UTCTimestamp>;
    volumeRef.current = volume as ISeriesApi<"Histogram", UTCTimestamp>;

    return () => {
      chartRef.current = null;
      priceRef.current = null;
      volumeRef.current = null;
      chart.remove();
    };
  }, [mode, height]);

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
    if (!price || !volume) return;

    const c = palette();
    const candles = toCandles(data);

    if (mode === "candle") {
      (price as ISeriesApi<"Candlestick", UTCTimestamp>).setData(candles);
    } else {
      (price as ISeriesApi<"Area", UTCTimestamp>).setData(
        candles.map((k) => ({ time: k.time, value: k.close })),
      );
    }
    volume.setData(toVolume(data, { up: c.up, down: c.down }));
    chartRef.current?.timeScale().fitContent();
  }, [data, mode]);

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

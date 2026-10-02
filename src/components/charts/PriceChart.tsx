import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  AreaSeries,
  LineSeries,
  LineStyle,
  createTextWatermark,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
  type ISeriesApi,
  TickMarkType,
  type UTCTimestamp,
} from "lightweight-charts";
import { toCandles, toVolume, sma, type ApiChartPoint, type PriceEvent } from "@/lib/chart-data";

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
  /** Events already pinned to bar times (see snapEvents); any other time is dropped by the library. */
  markers?: readonly { time: UTCTimestamp; event: PriceEvent }[];
  /** "points" for an index level: no rupee sign, and no ".00" on round axis ticks. */
  unit?: "rupees" | "points";
}

const RUPEES = {
  type: "custom",
  minMove: 0.01,
  formatter: (p: number) => `₹${p.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
} as const;

const POINTS = {
  type: "custom",
  minMove: 0.01,
  formatter: (p: number) => p.toLocaleString("en-IN", { maximumFractionDigits: 2 }),
} as const;

/**
 * Overlay colours, as theme tokens: magenta, then neutral grey. Not blue or
 * orange, which the results and dividend markers use, and not green or red,
 * which mean up and down. The old hardcoded amber was 1.7:1 on white, under
 * the 3:1 a line needs; both of these clear it in both themes.
 */
const SMA_COLOURS = [["--chart-4", "hsl(330 50% 46%)"], ["--muted-foreground", "hsl(213 30% 40%)"]] as const;
/** The second overlay is dashed too: magenta and grey are close for deuteranopes (ΔE 3.9). */
const SMA_STYLES = [LineStyle.Solid, LineStyle.Dashed];
const smaColour = (i: number) => {
  const [name, fallback] = SMA_COLOURS[i % SMA_COLOURS.length];
  return token(name, fallback);
};

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

/**
 * Results below the bar, dividends above, in the chart palette's blue and
 * orange: green and red already mean up and down on this chart. Letters, not
 * arrows, because an arrow on a broker's price chart reads as a trade signal.
 */
const MARKER_STYLE = {
  results: { position: "belowBar", shape: "circle", text: "R", colour: ["--chart-3", "hsl(212 64% 40%)"] },
  dividend: { position: "aboveBar", shape: "square", text: "D", colour: ["--chart-2", "hsl(21 76% 43%)"] },
} as const;

function toMarkers(markers: PriceChartProps["markers"]): SeriesMarker<UTCTimestamp>[] {
  return (markers ?? []).map(({ time, event }) => {
    const { position, shape, text, colour } = MARKER_STYLE[event.kind];
    return { time, position, shape, text, id: event.kind, color: token(colour[0], colour[1]) };
  });
}

/** An hsl() colour at the given opacity. */
const withAlpha = (hsl: string, alpha: number) => hsl.replace("hsl(", "hsla(").replace(/\)$/, ` / ${alpha})`);

/**
 * The area line in the direction of the period: green when the last close is
 * at or above the first, red when below. It was always green, so a stock down
 * 9.6% over six months was drawn in the colour of a gain.
 */
function colourArea(series: ISeriesApi<"Area", UTCTimestamp>, closes: number[]) {
  const c = palette();
  const colour = closes.length < 2 || closes[closes.length - 1] >= closes[0] ? c.up : c.down;
  series.applyOptions({ lineColor: colour, topColor: withAlpha(colour, 0.28), bottomColor: withAlpha(colour, 0) });
}

const PriceChart = ({
  data,
  mode = "candle",
  height = 320,
  watermark,
  smaPeriods,
  showVolume = true,
  markers,
  unit = "rupees",
}: PriceChartProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const priceRef = useRef<ISeriesApi<"Candlestick" | "Area", UTCTimestamp> | null>(null);
  const volumeRef = useRef<ISeriesApi<"Histogram", UTCTimestamp> | null>(null);
  const smaRefs = useRef<ISeriesApi<"Line", UTCTimestamp>[]>([]);
  const markersRef = useRef<ISeriesMarkersPluginApi<UTCTimestamp> | null>(null);
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
        fontFamily: "'IBM Plex Sans Variable', 'IBM Plex Sans', system-ui, sans-serif",
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
      // No chart-wide priceFormatter: it overrides every series' own priceFormat,
      // which labelled the volume axis "₹1,00,00,00,000.00". Rupees are set on
      // the price series instead (RUPEES below).
      localization: {
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
            priceFormat: unit === "points" ? POINTS : RUPEES,
          })
        : chart.addSeries(AreaSeries, {
            lineColor: c.up,
            topColor: withAlpha(c.up, 0.28),
            bottomColor: withAlpha(c.up, 0),
            lineWidth: 2,
            priceFormat: unit === "points" ? POINTS : RUPEES,
          });

    smaRefs.current = (smaKey ? smaKey.split(",") : []).map((_, i) =>
      chart.addSeries(LineSeries, {
        color: smaColour(i),
        lineStyle: SMA_STYLES[i % SMA_STYLES.length],
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
          // Shares in crore and lakh, never rupees.
          priceFormat: { type: "custom", minMove: 1, formatter: (v: number) => (v >= 1e7 ? `${(v / 1e7).toFixed(1)} Cr` : v >= 1e5 ? `${(v / 1e5).toFixed(1)} L` : Math.round(v).toLocaleString("en-IN")) },
          // A last-value tag and price line would float against the price axis.
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
    markersRef.current = createSeriesMarkers(priceRef.current, []);

    return () => {
      chartRef.current = null;
      priceRef.current = null;
      volumeRef.current = null;
      smaRefs.current = [];
      markersRef.current = null;
      chart.remove();
    };
  }, [mode, height, smaKey, showVolume, unit]);

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
      // The series colours are theme tokens too: green and red differ by theme.
      const price = priceRef.current;
      if (price && mode === "candle") {
        (price as ISeriesApi<"Candlestick", UTCTimestamp>).applyOptions({ upColor: c.up, downColor: c.down, borderUpColor: c.up, borderDownColor: c.down, wickUpColor: c.up, wickDownColor: c.down });
      } else if (price) {
        const area = price as ISeriesApi<"Area", UTCTimestamp>;
        colourArea(area, area.data().map((d) => ("value" in d ? d.value : 0)));
      }
      smaRefs.current.forEach((series, i) => series.applyOptions({ color: smaColour(i) }));
      const m = markersRef.current;
      m?.setMarkers(m.markers().map((mk) => {
        const [name, fallback] = MARKER_STYLE[mk.id as PriceEvent["kind"]].colour;
        return { ...mk, color: token(name, fallback) };
      }));
    });
    observer.observe(target, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, [mode]);

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
      colourArea(price as ISeriesApi<"Area", UTCTimestamp>, candles.map((k) => k.close));
    }
    // Volume is context, not the subject: half strength, as LiveChart's legend swatches show it.
    volume?.setData(toVolume(data, { up: withAlpha(c.up, 0.45), down: withAlpha(c.down, 0.45) }));

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

    markersRef.current?.setMarkers(toMarkers(markers));

    chartRef.current?.timeScale().fitContent();
  }, [data, mode, smaKey, markers]);

  // v5 has no `watermark` chart option; it is a pane primitive.
  useEffect(() => {
    const chart = chartRef.current;
    if (!watermark || !chart) return;
    const pane = chart.panes()[0];
    if (!pane) return;
    createTextWatermark(pane, {
      horzAlign: "center",
      vertAlign: "center",
      // A faint mark, as trading terminals draw it: at full muted ink the
      // symbol sat on the price line and competed with the data.
      lines: [{ text: watermark, color: withAlpha(token("--muted-foreground", "hsl(213 30% 40%)"), 0.12), fontSize: 40 }],
    });
  }, [watermark]);

  return <div ref={containerRef} style={{ height }} className="w-full" role="img" aria-label="Price chart" />;
};

export default PriceChart;

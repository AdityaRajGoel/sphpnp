import { useEffect, useRef } from "react";
import { ColorType, createChart, LineSeries, type AutoscaleInfo, type UTCTimestamp } from "lightweight-charts";
import type { GmpSnapshot } from "@/lib/ipo";

/** A flat or near-flat series (a ₹0 GMP all week) still gets whole-rupee ticks, not "₹0.06 … ₹-0.02". */
const MIN_RANGE = 10;
const rupee = (price: number) => `${price < 0 ? "−" : ""}₹${Math.abs(price).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export default function IPOGmpChart({ history }: { history: GmpSnapshot[] }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current || history.length === 0) return;
    const chart = createChart(container.current, {
      autoSize: true,
      height: 280,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#737373" },
      grid: { vertLines: { color: "rgba(115,115,115,0.10)" }, horzLines: { color: "rgba(115,115,115,0.10)" } },
      rightPriceScale: { borderColor: "rgba(115,115,115,0.18)" },
      timeScale: { borderColor: "rgba(115,115,115,0.18)", timeVisible: true, secondsVisible: false },
      localization: { priceFormatter: rupee },
    });
    const series = chart.addSeries(LineSeries, {
      color: "#e86b1f", lineWidth: 3, crosshairMarkerBackgroundColor: "#e86b1f",
      priceLineVisible: false, lastValueVisible: true,
      autoscaleInfoProvider: (original: () => AutoscaleInfo | null) => {
        const info = original();
        if (!info?.priceRange) return info;
        const { minValue, maxValue } = info.priceRange;
        if (maxValue - minValue >= MIN_RANGE) return info;
        const mid = (minValue + maxValue) / 2;
        return { ...info, priceRange: { minValue: mid - MIN_RANGE / 2, maxValue: mid + MIN_RANGE / 2 } };
      },
    });
    series.setData(history.map((point) => ({
      time: Math.floor(new Date(point.captured_at).getTime() / 1000) as UTCTimestamp,
      value: point.gmp,
    })));
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [history]);

  if (history.length === 0) {
    return <div className="h-[280px] grid place-items-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">GMP history will appear after the scheduled sync records observations.</div>;
  }
  return <div ref={container} aria-label="Grey market premium history chart" />;
}

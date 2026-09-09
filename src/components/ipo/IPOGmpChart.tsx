import { useEffect, useRef } from "react";
import { ColorType, createChart, LineSeries, type UTCTimestamp } from "lightweight-charts";
import type { GmpSnapshot } from "@/lib/ipo";

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
      localization: { priceFormatter: (price) => `₹${price.toLocaleString("en-IN")}` },
    });
    const series = chart.addSeries(LineSeries, {
      color: "#e86b1f", lineWidth: 3, crosshairMarkerBackgroundColor: "#e86b1f",
      priceLineVisible: false, lastValueVisible: true,
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

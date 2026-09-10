import { motion } from "motion/react";
import type { StockHeader } from "@/hooks/useStockFundamentals";
import { revealItem } from "@/lib/motion";

/**
 * The quote figures the screener already syncs, shown on the stock page.
 *
 * These were fetched into the same row the page header reads and simply never
 * rendered — a comment in StockPage.tsx had acknowledged the gap for some time.
 * Nothing new is computed here; this is the existing data reaching the surface
 * it was always meant for.
 *
 * The one rule that matters: a missing figure renders as an em dash, never as a
 * zero. The sync now omits a field it could not read rather than writing 0, so
 * null means "the upstream did not give us this" — and a 0 P/E printed as a
 * number would be a statement about a listed company that nobody actually made.
 */

const inr = (value: number, digits = 2) =>
  `₹${value.toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;

/** Indian convention: 12,34,567 becomes 12.35 L, 1,23,45,678 becomes 1.23 Cr. */
const compactVolume = (value: number): string => {
  if (value >= 1e7) return `${(value / 1e7).toFixed(2)} Cr`;
  if (value >= 1e5) return `${(value / 1e5).toFixed(2)} L`;
  return value.toLocaleString("en-IN");
};

const Metric = ({ label, value }: { label: string; value: string | null }) => (
  <div className="min-w-0">
    <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
    <dd
      className={`mt-0.5 text-sm font-semibold tabular-nums ${
        value === null ? "text-muted-foreground/60" : "text-foreground"
      }`}
    >
      {/* An em dash, not "0" and not an empty cell: the reader can tell the
          difference between a figure we do not have and a figure that is zero. */}
      {value ?? "—"}
    </dd>
  </div>
);

const range = (low: number | null, high: number | null): string | null =>
  low !== null && high !== null ? `${inr(low)} – ${inr(high)}` : null;

const QuoteMetrics = ({ header }: { header: StockHeader }) => {
  const metrics: { label: string; value: string | null }[] = [
    { label: "P/E", value: header.pe !== null ? header.pe.toFixed(2) : null },
    { label: "Day range", value: range(header.day_low, header.day_high) },
    { label: "52-week range", value: range(header.low_52, header.high_52) },
    { label: "Volume", value: header.volume !== null ? compactVolume(header.volume) : null },
    { label: "Open", value: header.open_price !== null ? inr(header.open_price) : null },
    { label: "Prev close", value: header.prev_close !== null ? inr(header.prev_close) : null },
  ];

  // Nothing to show is not the same as a row of dashes: if the sync has given us
  // none of these, the section stays away rather than implying a broken page.
  if (metrics.every((m) => m.value === null)) return null;

  return (
    <motion.dl
      {...revealItem()}
      aria-label="Quote metrics"
      className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border/60 pt-4 sm:grid-cols-3 lg:grid-cols-6"
    >
      {metrics.map((metric) => (
        <Metric key={metric.label} label={metric.label} value={metric.value} />
      ))}
    </motion.dl>
  );
};

export default QuoteMetrics;

import { Link } from "react-router-dom";
import { CHART } from "@/components/markets/chart-kit";
import { RATES_AS_OF, calculateCharges, segmentByKey, type Charges, type SegmentKey } from "@/lib/brokerage";

const TRADE_VALUE = 100_000;
const PARTS: { key: keyof Charges; label: string; color: string }[] = [
  { key: "brokerage", label: "Brokerage", color: CHART.series[2] },
  { key: "stt", label: "STT", color: CHART.series[0] },
  { key: "exchange", label: "Exchange charges", color: CHART.series[1] },
  { key: "gst", label: "GST", color: CHART.series[3] },
  { key: "stamp", label: "Stamp duty", color: "hsl(var(--muted-foreground) / 0.55)" },
  { key: "sebi", label: "SEBI fee", color: "hsl(var(--muted-foreground) / 0.3)" },
];
const ROWS: { key: SegmentKey; title: string }[] = [
  { key: "equity_delivery", title: "Delivery: buy, then sell later" },
  { key: "equity_intraday", title: "Intraday: buy and sell the same day" },
];

const rupees = (v: number) => `₹${v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * What one ₹1 lakh round trip costs, charge by charge, at the published rate
 * card: a stacked bar per segment, so the reader sees that statutory charges,
 * not brokerage, are most of a delivery trade's cost. Same calculator as
 * /brokerage-calculator.
 */
export default function ChargesBreakdown() {
  const rows = ROWS.map((r) => ({ ...r, c: calculateCharges(segmentByKey(r.key), { buyPrice: TRADE_VALUE, sellPrice: TRADE_VALUE, quantity: 1, lots: 1 }) }));

  return (
    <section aria-labelledby="charges-breakdown" className="rounded-2xl border border-border/50 bg-card p-5 sm:p-6">
      <h2 id="charges-breakdown" className="font-heading text-lg font-bold">What a ₹1 lakh trade costs</h2>
      <p className="mt-1 text-sm text-muted-foreground">Buying ₹1,00,000 of shares and selling them at the same price, at the rates above ({RATES_AS_OF}).</p>

      <div className="mt-5 space-y-6">
        {rows.map(({ key, title, c }) => (
          <div key={key}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold">{title}</h3>
              <p className="text-sm tabular-nums"><span className="font-bold">{rupees(c.total)}</span> <span className="text-muted-foreground">in all, {((c.total / TRADE_VALUE) * 100).toFixed(2)}% of the trade</span></p>
            </div>
            <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-muted" role="img" aria-label={PARTS.map((p) => `${p.label} ${rupees(c[p.key])}`).join(", ")}>
              {PARTS.map((p) => (c[p.key] > 0 ? <span key={p.key} style={{ width: `${(c[p.key] / c.total) * 100}%`, background: p.color }} /> : null))}
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-3">
              {PARTS.map((p) => (
                <div key={p.key} className="flex items-center justify-between gap-2">
                  <dt className="flex items-center gap-1.5 text-muted-foreground"><span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: p.color }} aria-hidden />{p.label}</dt>
                  <dd className="font-medium tabular-nums">{rupees(c[p.key])}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
      <p className="mt-5 text-xs text-muted-foreground">
        Estimates before rounding; the contract note is final. Try your own trade in the <Link to="/brokerage-calculator" className="font-medium text-secondary hover:underline">brokerage calculator</Link>.
      </p>
    </section>
  );
}

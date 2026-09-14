/**
 * An India market regime read from a handful of cross-asset series: volatility,
 * the rupee, crude, cyclicals against defensives, the Nifty's own trend and the
 * US close. The shape follows a risk-on/risk-off dashboard - each input is
 * classified on its own and the verdict is simply how many lean each way.
 *
 * DESCRIPTIVE ONLY. "Risk-off" says the inputs look like past stressed markets,
 * not that anyone should sell. Every threshold is named and shown to the reader.
 */

export type Lean = "on" | "off" | "neutral" | "unknown";

export type Signal = {
  id: string;
  label: string;
  lean: Lean;
  value: number | null;
  /** Human reading of the value, e.g. "India VIX 13.2". */
  reading: string;
  rule: string;
};

export type Regime = { verdict: "Risk-on" | "Mixed" | "Risk-off" | "Unknown"; on: number; off: number; known: number; signals: Signal[] };

const finite = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);

/** Percentage change over the last `sessions` values, or null without enough history. */
export function rateOfChange(values: readonly number[], sessions: number): number | null {
  if (values.length < sessions + 1) return null;
  const now = values[values.length - 1];
  const then = values[values.length - 1 - sessions];
  return finite(now) && finite(then) && then !== 0 ? (now / then - 1) * 100 : null;
}

export function simpleAverage(values: readonly number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

/** Element-wise ratio of two close series aligned on date. */
export function ratioSeries(a: readonly { date: string; close: number }[], b: readonly { date: string; close: number }[]): number[] {
  const byDate = new Map(b.map((p) => [p.date, p.close]));
  return a.flatMap((p) => { const other = byDate.get(p.date); return other && other > 0 ? [p.close / other] : []; });
}

export type RegimeInputs = {
  indiaVix: number[];
  nifty: number[];
  niftyVsFmcg: number[];
  usdInr: number[];
  brent: number[];
  sp500: number[];
  /** Share of tracked stocks above their 200DMA, 0-100, if known. */
  breadthAbove200?: number | null;
};

const fmt = (v: number | null, digits = 1, suffix = "%") => (v === null ? "—" : `${v > 0 && suffix === "%" ? "+" : ""}${v.toFixed(digits)}${suffix}`);

export function classifyRegime(input: RegimeInputs): Regime {
  const vix = input.indiaVix.length ? input.indiaVix[input.indiaVix.length - 1] : null;
  const niftyLast = input.nifty.length ? input.nifty[input.nifty.length - 1] : null;
  const nifty50 = simpleAverage(input.nifty, 50);
  const niftyVs50 = finite(niftyLast) && finite(nifty50) ? (niftyLast / nifty50 - 1) * 100 : null;
  const appetite = rateOfChange(input.niftyVsFmcg, 20);
  const rupee = rateOfChange(input.usdInr, 20);
  const oil = rateOfChange(input.brent, 20);
  const us = rateOfChange(input.sp500, 20);
  const breadth = input.breadthAbove200 ?? null;

  const lean = (v: number | null, on: (x: number) => boolean, off: (x: number) => boolean): Lean =>
    v === null ? "unknown" : on(v) ? "on" : off(v) ? "off" : "neutral";

  const signals: Signal[] = [
    { id: "vix", label: "Volatility", value: vix, reading: vix === null ? "—" : `India VIX ${vix.toFixed(1)}`, rule: "Calm under 14, stressed above 20", lean: lean(vix, (x) => x < 14, (x) => x > 20) },
    { id: "trend", label: "Nifty trend", value: niftyVs50, reading: `${fmt(niftyVs50)} vs 50DMA`, rule: "Above its 50-day average by 1%+, or below by 1%+", lean: lean(niftyVs50, (x) => x > 1, (x) => x < -1) },
    { id: "appetite", label: "Risk appetite", value: appetite, reading: `Nifty / FMCG ${fmt(appetite)} in 20 sessions`, rule: "Broad market beating defensives by 2%+ (or lagging by 2%+)", lean: lean(appetite, (x) => x > 2, (x) => x < -2) },
    { id: "rupee", label: "Rupee", value: rupee, reading: `USD/INR ${fmt(rupee, 2)} in 20 sessions`, rule: "Rupee strengthening (USD/INR down 0.5%+) or weakening 1.5%+", lean: lean(rupee, (x) => x < -0.5, (x) => x > 1.5) },
    { id: "oil", label: "Crude", value: oil, reading: `Brent ${fmt(oil)} in 20 sessions`, rule: "An oil importer's tailwind when down 8%+, headwind when up 8%+", lean: lean(oil, (x) => x < -8, (x) => x > 8) },
    { id: "global", label: "US lead", value: us, reading: `S&P 500 ${fmt(us)} in 20 sessions`, rule: "US market up 2%+ or down 3%+ over a month", lean: lean(us, (x) => x > 2, (x) => x < -3) },
    { id: "breadth", label: "Breadth", value: breadth, reading: breadth === null ? "—" : `${breadth.toFixed(0)}% above 200DMA`, rule: "Most tracked stocks above their 200-day average (60%+), or few (under 40%)", lean: lean(breadth, (x) => x >= 60, (x) => x < 40) },
  ];

  const on = signals.filter((s) => s.lean === "on").length;
  const off = signals.filter((s) => s.lean === "off").length;
  const known = signals.filter((s) => s.lean !== "unknown").length;
  const verdict = known < 4 ? "Unknown" : on - off >= 2 ? "Risk-on" : off - on >= 2 ? "Risk-off" : "Mixed";
  return { verdict, on, off, known, signals };
}

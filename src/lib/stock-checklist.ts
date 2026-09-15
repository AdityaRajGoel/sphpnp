import { metricValue, type MetricRow } from "@/lib/screener-metrics";

export type Verdict = "pass" | "neutral" | "fail";

export type ChecklistItem = {
  id: string;
  area: "Profitability" | "Growth" | "Balance sheet" | "Valuation" | "Price action";
  label: string;
  verdict: Verdict;
  /** The figure and the thresholds it was judged against. */
  detail: string;
};

type Check = {
  id: string;
  area: ChecklistItem["area"];
  label: string;
  value: (row: MetricRow, ctx: Context) => number | null;
  pass: (v: number, ctx: Context) => boolean;
  fail: (v: number, ctx: Context) => boolean;
  detail: (v: number, ctx: Context) => string;
};

type Context = { sectorPe: number | null };

const pct = (v: number) => `${Number.isInteger(v) ? v : v.toFixed(1)}%`;

/**
 * A Tijori-style yes / neutral / no read of the figures the site already
 * holds. The thresholds are conventional screening lines, written into each
 * item's detail so the reader sees exactly what "pass" meant - it is a
 * description of the numbers, not a recommendation.
 */
const CHECKS: Check[] = [
  { id: "roe", area: "Profitability", label: "Return on equity", value: (r) => metricValue(r, "roe"), pass: (v) => v >= 15, fail: (v) => v < 8, detail: (v) => `${pct(v)} - pass at 15% or more, fail under 8%` },
  { id: "roce", area: "Profitability", label: "Return on capital employed", value: (r) => metricValue(r, "roce"), pass: (v) => v >= 15, fail: (v) => v < 10, detail: (v) => `${pct(v)} - pass at 15% or more, fail under 10%` },
  { id: "opm", area: "Profitability", label: "Operating margin", value: (r) => metricValue(r, "opm"), pass: (v) => v >= 15, fail: (v) => v < 5, detail: (v) => `${pct(v)} - pass at 15% or more, fail under 5%` },
  { id: "piotroski", area: "Profitability", label: "Piotroski F-Score", value: (r) => metricValue(r, "piotroski_score"), pass: (v) => v >= 7, fail: (v) => v <= 3, detail: (v) => `${v} - pass at 7 or more, fail at 3 or less` },
  { id: "sales_growth", area: "Growth", label: "Sales growth, latest quarter", value: (r) => metricValue(r, "sales_growth_yoy"), pass: (v) => v >= 10, fail: (v) => v < 0, detail: (v) => `${pct(v)} year on year - pass at 10% or more, fail when shrinking` },
  { id: "profit_growth", area: "Growth", label: "Profit growth, latest quarter", value: (r) => metricValue(r, "profit_growth_yoy"), pass: (v) => v >= 10, fail: (v) => v < 0, detail: (v) => `${pct(v)} year on year - pass at 10% or more, fail when shrinking` },
  { id: "revenue_cagr", area: "Growth", label: "Revenue CAGR, 3 years", value: (r) => metricValue(r, "revenue_cagr_3y"), pass: (v) => v >= 12, fail: (v) => v < 3, detail: (v) => `${pct(v)} a year - pass at 12% or more, fail under 3%` },
  { id: "de", area: "Balance sheet", label: "Debt to equity", value: (r) => metricValue(r, "debt_to_equity"), pass: (v) => v <= 0.5, fail: (v) => v > 1.5, detail: (v) => `${v.toFixed(2)} - pass at 0.5 or less, fail above 1.5` },
  { id: "accruals", area: "Balance sheet", label: "Accruals ratio", value: (r) => metricValue(r, "accruals_ratio"), pass: (v) => v <= 0, fail: (v) => v > 10, detail: (v) => `${pct(v)} - pass when profit is backed by cash (0 or less), fail above 10%` },
  {
    id: "pe_vs_sector", area: "Valuation", label: "P/E against sector median",
    value: (r, ctx) => { const pe = metricValue(r, "pe"); return pe !== null && pe > 0 && ctx.sectorPe ? pe : null; },
    pass: (v, ctx) => v <= ctx.sectorPe! * 0.8, fail: (v, ctx) => v > ctx.sectorPe! * 1.5,
    detail: (v, ctx) => `${v.toFixed(1)} against ${ctx.sectorPe!.toFixed(1)} - pass 20% below the median, fail 50% above`,
  },
  { id: "peg", area: "Valuation", label: "PEG ratio", value: (r) => { const v = metricValue(r, "peg"); return v !== null && v > 0 ? v : null; }, pass: (v) => v <= 1, fail: (v) => v > 2.5, detail: (v) => `${v.toFixed(2)} - pass at 1 or less, fail above 2.5` },
  { id: "dma200", area: "Price action", label: "Price against 200-day average", value: (r) => metricValue(r, "distance_from_200"), pass: (v) => v > 0, fail: (v) => v < -10, detail: (v) => `${v > 0 ? "+" : ""}${pct(v)} - pass above it, fail more than 10% below` },
  { id: "beta", area: "Price action", label: "Beta, 1 year", value: (r) => metricValue(r, "beta_1y"), pass: (v) => v <= 1, fail: (v) => v > 1.5, detail: (v) => `${v.toFixed(2)} - pass at 1 or less, fail above 1.5` },
];

export function buildChecklist(row: MetricRow | undefined, sectorPe: number | null = null): ChecklistItem[] {
  if (!row) return [];
  const ctx = { sectorPe };
  return CHECKS.flatMap((c) => {
    const v = c.value(row, ctx);
    if (v === null || !Number.isFinite(v)) return [];
    const verdict: Verdict = c.pass(v, ctx) ? "pass" : c.fail(v, ctx) ? "fail" : "neutral";
    return [{ id: c.id, area: c.area, label: c.label, verdict, detail: c.detail(v, ctx) }];
  });
}

export function tally(items: ChecklistItem[]): Record<Verdict, number> {
  return items.reduce((acc, i) => ({ ...acc, [i.verdict]: acc[i.verdict] + 1 }), { pass: 0, neutral: 0, fail: 0 });
}

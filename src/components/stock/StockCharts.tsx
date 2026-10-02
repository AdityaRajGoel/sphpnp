import { useState, type ReactNode } from "react";
import { motion } from "motion/react";
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, LineChart, Pie, PieChart, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { CHART, axisTick, tooltipStyle } from "@/components/markets/chart-kit";
import { Card } from "@/components/ui/card";
import { segmentItem, segmentTrack } from "@/components/ui/segmented";
import { revealItem, revealSection } from "@/lib/motion";
import type { HolderSeries, RoePoint, StatementGrid, StatementKind } from "@/lib/statements";
import type { CorporateAction } from "@/hooks/useStockFundamentals";
import {
  annualPerformance, capitalStructure, cagr, cashflowSeries, dividendsByYear, niceTicks, quarterlyPerformance, roeSeries, shareholdingSlices, shareholdingTrend, shortCrore,
  type PerformancePoint,
} from "@/lib/stock-charts";

type Props = {
  statements: Partial<Record<StatementKind, StatementGrid>>;
  shareholding: HolderSeries[];
  roeHistory: RoePoint[] | undefined;
  actions: CorporateAction[];
  /** Who served the statements, as the page credits it. */
  source: string;
};

// Series colours are the validated --chart-* steps (see markets/chart-kit):
// revenue the blue, profit the green, a loss the theme's red, and anything a
// second panel carries the orange. Equity and debt are two series, not good and
// bad, so debt is orange rather than red.
const C = {
  revenue: CHART.series[2],
  profit: CHART.series[0],
  second: CHART.series[1],
  loss: CHART.down,
  grid: CHART.grid,
  axis: CHART.axis,
};
/**
 * Colour follows the holder, never its position in the list: a company with no
 * government holding must not repaint FII as the next colour along.
 */
const holderColour = (name: string) =>
  /promot/i.test(name) ? CHART.series[2]
    : /fii|fpi|foreign/i.test(name) ? CHART.series[0]
    : /dii|domestic|mutual/i.test(name) ? CHART.series[1]
    : /public|retail|non.?inst/i.test(name) ? CHART.series[3]
    : CHART.muted;

/** Legend and tooltip text stay in ink; the swatch beside the words carries the colour. */
const legendProps = { wrapperStyle: { fontSize: 12 }, iconSize: 10, formatter: (v: string) => <span className="text-muted-foreground">{v}</span> };
/** Columns at most 24px wide, 4px round at the data end (Recharts puts a negative bar's data end there too). */
const BAR = { maxBarSize: 24, radius: [4, 4, 0, 0] as [number, number, number, number] };
/** Round ticks and a domain that ends on them (see niceTicks). */
const roundTicks = (values: (number | null)[]) => roundTicksIn(values, 4);
function roundTicksIn(values: (number | null)[], steps: number) {
  const ticks = niceTicks(values, steps);
  return { ticks, domain: [ticks[0], ticks[ticks.length - 1]] as [number, number] };
}
/** Lines are 2px with no dot per point; the hovered point gets one, ringed in the card colour. */
const LINE = { strokeWidth: 2, dot: false, activeDot: { r: 4, strokeWidth: 2, stroke: "hsl(var(--card))" }, connectNulls: true } as const;
const crore = (v: unknown) => (typeof v === "number" ? `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })} Cr` : "—");
const pct = (v: unknown) => (typeof v === "number" ? `${v.toFixed(1)}%` : "—");
const perShare = (v: unknown) => (typeof v === "number" ? `₹${v.toFixed(2)}` : "—");
const dayDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const quarterDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });

function ChartCard({ title, subtitle, children, className = "", index }: { title: string; subtitle?: string; children: ReactNode; className?: string; index: number }) {
  return (
    <motion.div {...revealItem(index)} className={`min-w-0 ${className}`}>
      <Card className="p-4 h-full flex flex-col">
        <div className="mb-3">
          <h3 className="font-semibold text-sm">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="flex-1 min-h-[220px]">{children}</div>
      </Card>
    </motion.div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  return (
    <div className="flex h-full flex-col justify-between gap-1 rounded-surface border bg-card p-3 shadow-sm">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-xl font-bold tabular-nums ${tone === "up" ? "text-secondary" : tone === "down" ? "text-destructive" : ""}`}>{value}</div>
    </div>
  );
}

const toneOf = (v: number | null) => (v === null ? undefined : v >= 0 ? "up" : "down");
const signed = (v: number | null) => (v === null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`);

/** A small panel label, for the lower half of a two-panel chart. */
const PanelLabel = ({ children }: { children: ReactNode }) => (
  <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{children}</p>
);

/**
 * Rupees and a percentage never share a plot: two y-scales on one chart imply a
 * relationship from wherever the scales happen to line up. The margin gets its
 * own panel under the bars, on the same periods, with hover linked by syncId.
 */
function PerformanceChart({ data }: { data: PerformancePoint[] }) {
  return (
    <>
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={data} syncId="stock-performance" margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis dataKey="period" hide />
          <YAxis {...roundTicks(data.flatMap((d) => [d.revenue, d.profit]))} tick={axisTick} tickLine={false} axisLine={false} tickFormatter={shortCrore} width={64} />
          <Tooltip {...tooltipStyle} formatter={(v: unknown) => crore(v)} />
          <Legend {...legendProps} />
          <ReferenceLine y={0} stroke={C.axis} />
          <Bar dataKey="revenue" name="Revenue" fill={C.revenue} {...BAR} />
          {/* fill is what the legend swatch shows; the cells colour each bar. */}
          <Bar dataKey="profit" name="Net profit" fill={C.profit} {...BAR}>
            {data.map((d) => <Cell key={d.period} fill={(d.profit ?? 0) < 0 ? C.loss : C.profit} />)}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>
      <PanelLabel>Operating margin</PanelLabel>
      <ResponsiveContainer width="100%" height={90}>
        <LineChart data={data} syncId="stock-performance" margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis dataKey="period" tick={axisTick} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={12} />
          <YAxis tick={axisTick} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v}%`} width={64} tickCount={3} />
          <Tooltip {...tooltipStyle} formatter={(v: unknown) => pct(v)} />
          <Line dataKey="margin" name="Operating margin" stroke={C.second} {...LINE} />
        </LineChart>
      </ResponsiveContainer>
    </>
  );
}

/**
 * Charts and at-a-glance figures for one stock, all drawn from the stored
 * statements the tables below them show. A chart whose series the source did
 * not report is left out rather than drawn empty.
 */
export default function StockCharts({ statements, shareholding, roeHistory, actions, source }: Props) {
  const [period, setPeriod] = useState<"quarterly" | "annual">("quarterly");
  const quarterly = quarterlyPerformance(statements);
  const annual = annualPerformance(statements);
  const performance = period === "quarterly" && quarterly.length > 0 ? quarterly : annual.length > 0 ? annual : quarterly;
  const cash = cashflowSeries(statements);
  const capital = capitalStructure(statements);
  const holders = shareholdingSlices(shareholding);
  const trend = shareholdingTrend(shareholding);
  const roe = roeSeries(roeHistory, statements);
  const dividends = dividendsByYear(actions);
  const hasDividends = dividends.years.length >= 2;

  if (performance.length === 0 && cash.length === 0 && capital.length === 0 && holders.slices.length === 0 && roe.length === 0 && !hasDividends) return null;

  const latestQ = quarterly[quarterly.length - 1];
  const yearAgoQ = quarterly.length >= 5 ? quarterly[quarterly.length - 5] : undefined;
  const yoy = (key: "revenue" | "profit") => {
    const now = latestQ?.[key] ?? null;
    const then = yearAgoQ?.[key] ?? null;
    return now === null || then === null || then <= 0 ? null : (now / then - 1) * 100;
  };
  const stats = [
    { label: "Revenue 3Y CAGR", value: cagr(annual, "revenue", 3), growth: true },
    { label: "Profit 3Y CAGR", value: cagr(annual, "profit", 3), growth: true },
    { label: `Revenue YoY${latestQ ? ` (${latestQ.period})` : ""}`, value: yoy("revenue"), growth: true },
    { label: `Profit YoY${latestQ ? ` (${latestQ.period})` : ""}`, value: yoy("profit"), growth: true },
    { label: "Operating margin", value: latestQ?.margin ?? null, growth: false },
    { label: "Net margin", value: latestQ?.netMargin ?? null, growth: false },
  ].filter((s) => s.value !== null);

  let index = 0;
  return (
    <motion.section {...revealSection} aria-labelledby="charts-heading" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="charts-heading" className="text-2xl font-bold">Charts &amp; trends</h2>
          <p className="text-xs text-muted-foreground">From {source}. Amounts in ₹ crore.</p>
        </div>
        {quarterly.length > 0 && annual.length > 0 && (
          <div className={segmentTrack} role="group" aria-label="Chart period">
            {(["quarterly", "annual"] as const).map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={period === p}
                onClick={() => setPeriod(p)}
                className={`${segmentItem(period === p)} capitalize`}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      {stats.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {stats.map((s) => (
            <Stat key={s.label} label={s.label} value={s.growth ? signed(s.value) : pct(s.value)} tone={s.growth ? toneOf(s.value) : undefined} />
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {performance.length > 0 && (
          <ChartCard
            index={index++}
            className="lg:col-span-2"
            title={`Revenue, profit & margin - ${performance === quarterly ? "quarterly" : "annual"}`}
            subtitle="₹ crore; a loss shows red. Operating margin below, same periods."
          >
            <PerformanceChart data={performance} />
          </ChartCard>
        )}

        {holders.slices.length > 0 && (
          <ChartCard
            index={index++}
            title="Who owns the company"
            subtitle={trend.rows.length >= 2 ? `% of equity by quarter, latest ${quarterDate(trend.rows[trend.rows.length - 1].date as string)}` : holders.date ? `Shareholding as of ${quarterDate(holders.date)}` : undefined}
          >
            {/* Holdings over time when there is more than one filing: a stake that
                moved says more than one quarter's split. Parts of a whole, so the
                bars stack; colour follows the holder (holderColour). */}
            {trend.rows.length >= 2 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={trend.rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="18%">
                  <CartesianGrid stroke={C.grid} vertical={false} />
                  <XAxis dataKey="date" tick={axisTick} tickLine={false} axisLine={false} tickFormatter={(d: string) => quarterDate(d).replace(" 20", " '")} minTickGap={4} />
                  <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={axisTick} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v}%`} width={40} />
                  <Tooltip {...tooltipStyle} labelFormatter={(d: string) => quarterDate(d)} formatter={(v: unknown) => pct(v)} />
                  <Legend {...legendProps} />
                  {trend.categories.map((c) => (
                    <Bar key={c} dataKey={c} name={c} stackId="holders" fill={holderColour(c)} stroke="hsl(var(--card))" strokeWidth={2} maxBarSize={24} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={holders.slices} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="80%" paddingAngle={1} stroke="hsl(var(--card))" strokeWidth={2}>
                    {holders.slices.map((sl) => <Cell key={sl.name} fill={holderColour(sl.name)} />)}
                  </Pie>
                  <Tooltip {...tooltipStyle} formatter={(v: unknown) => pct(v)} />
                  <Legend {...legendProps} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        )}

        {cash.length > 0 && (
          <ChartCard index={index++} className="lg:col-span-2" title="Cash flows" subtitle="Where cash came from and went, by fiscal year (₹ crore)">
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={cash} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={C.grid} vertical={false} />
                <XAxis dataKey="period" tick={axisTick} tickLine={false} axisLine={false} minTickGap={12} />
                <YAxis {...roundTicks(cash.flatMap((d) => [d.operating, d.investing, d.financing, d.free]))} tick={axisTick} tickLine={false} axisLine={false} tickFormatter={shortCrore} width={64} />
                <Tooltip {...tooltipStyle} formatter={(v: unknown) => crore(v)} />
                <Legend {...legendProps} />
                <ReferenceLine y={0} stroke={C.axis} />
                <Bar dataKey="operating" name="Operating" fill={CHART.series[0]} {...BAR} />
                <Bar dataKey="investing" name="Investing" fill={CHART.series[1]} {...BAR} />
                <Bar dataKey="financing" name="Financing" fill={CHART.series[2]} {...BAR} />
                <Line dataKey="free" name="Free cash flow" stroke={CHART.series[3]} {...LINE} />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {roe.length > 0 && (
          <ChartCard index={index++} title="Return on equity" subtitle="Net profit over shareholders' equity, by fiscal year">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={roe} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={C.grid} vertical={false} />
                <XAxis dataKey="period" tick={axisTick} tickLine={false} axisLine={false} minTickGap={8} />
                <YAxis {...roundTicks(roe.map((r) => r.roe))} tick={axisTick} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v}%`} width={40} />
                <Tooltip {...tooltipStyle} formatter={(v: unknown) => pct(v)} />
                <ReferenceLine y={15} stroke={C.axis} strokeDasharray="4 4" label={{ value: "15% screen", fill: C.axis, fontSize: 10, position: "insideTopRight" }} />
                <Bar dataKey="roe" name="ROE" fill={C.revenue} {...BAR}>
                  {roe.map((r) => <Cell key={r.period} fill={r.roe < 0 ? C.loss : C.revenue} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {capital.length > 0 && (
          <ChartCard index={index++} className={hasDividends ? "lg:col-span-2" : "lg:col-span-3"} title="Equity vs debt" subtitle="Shareholders' equity against borrowings (₹ crore); the ratio below, same years.">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={capital} syncId="stock-capital" margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={C.grid} vertical={false} />
                <XAxis dataKey="period" hide />
                <YAxis {...roundTicks(capital.flatMap((d) => [d.equity, d.debt]))} tick={axisTick} tickLine={false} axisLine={false} tickFormatter={shortCrore} width={64} />
                <Tooltip {...tooltipStyle} formatter={(v: unknown) => crore(v)} />
                <Legend {...legendProps} />
                <Bar dataKey="equity" name="Equity" fill={CHART.series[2]} {...BAR} />
                <Bar dataKey="debt" name="Debt" fill={CHART.series[1]} {...BAR} />
              </BarChart>
            </ResponsiveContainer>
            <PanelLabel>Debt to equity</PanelLabel>
            <ResponsiveContainer width="100%" height={90}>
              <LineChart data={capital} syncId="stock-capital" margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={C.grid} vertical={false} />
                <XAxis dataKey="period" tick={axisTick} tickLine={false} axisLine={false} minTickGap={12} />
                {/* At least 0 to 1x: autoscaled, a debt-free company's 0.00 to 0.01 drew as a spike under ticks all reading "0.0x". */}
                <YAxis {...roundTicksIn(capital.map((d) => d.debtToEquity).concat(1), 2)} tick={axisTick} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${Number(v.toFixed(2))}x`} width={64} />
                <Tooltip {...tooltipStyle} formatter={(v: unknown) => (typeof v === "number" ? `${v.toFixed(2)}x` : "—")} />
                <Line dataKey="debtToEquity" name="Debt / equity" stroke={CHART.series[3]} {...LINE} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {hasDividends && (
          <ChartCard
            index={index++}
            title="Dividends per share"
            subtitle={`₹ by fiscal year of the ex-date; the latest year runs to date.${dividends.reset ? ` Not adjusted for the ${dividends.reset.type} of ${dayDate(dividends.reset.date)}: earlier bars are per pre-${dividends.reset.type} share.` : ""}`}
          >
            {/* Orange, as the D markers on the price chart. A zero bar is a year that paid nothing. */}
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dividends.years} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={C.grid} vertical={false} />
                <XAxis dataKey="year" tick={axisTick} tickLine={false} axisLine={false} minTickGap={8} />
                <YAxis {...roundTicks(dividends.years.map((d) => d.dps))} tick={axisTick} tickLine={false} axisLine={false} tickFormatter={(v: number) => `₹${v}`} width={48} />
                <Tooltip {...tooltipStyle} formatter={(v: unknown) => perShare(v)} />
                <Bar dataKey="dps" name="Dividend per share" fill={C.second} {...BAR} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
      </div>
    </motion.section>
  );
}

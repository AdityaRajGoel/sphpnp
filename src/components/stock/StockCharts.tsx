import { useState, type ReactNode } from "react";
import { motion } from "motion/react";
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import { revealItem, revealSection } from "@/lib/motion";
import type { HolderSeries, RoePoint, StatementGrid, StatementKind } from "@/lib/statements";
import {
  annualPerformance, capitalStructure, cagr, cashflowSeries, quarterlyPerformance, roeSeries, shareholdingSlices, shortCrore,
  type PerformancePoint,
} from "@/lib/stock-charts";

type Props = {
  statements: Partial<Record<StatementKind, StatementGrid>>;
  shareholding: HolderSeries[];
  roeHistory: RoePoint[] | undefined;
  source: "IndianAPI" | "Google Finance";
};

const C = {
  revenue: "hsl(var(--primary))",
  profit: "hsl(var(--secondary))",
  margin: "hsl(var(--brand-orange))",
  gold: "hsl(var(--brand-gold))",
  loss: "hsl(var(--destructive))",
  grid: "hsl(var(--border))",
  axis: "hsl(var(--muted-foreground))",
};
const PIE = [C.revenue, C.profit, C.gold, C.margin, "hsl(var(--muted-foreground))", "hsl(var(--accent-foreground))"];

const axisTick = { fill: C.axis, fontSize: 11 };
const tooltipStyle = {
  contentStyle: { background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 },
  labelStyle: { color: "hsl(var(--popover-foreground))", fontWeight: 600 },
};
const crore = (v: unknown) => (typeof v === "number" ? `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })} Cr` : "—");
const pct = (v: unknown) => (typeof v === "number" ? `${v.toFixed(1)}%` : "—");
const quarterDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });

function ChartCard({ title, subtitle, children, className = "", index }: { title: string; subtitle?: string; children: ReactNode; className?: string; index: number }) {
  return (
    <motion.div {...revealItem(index)} className={className}>
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
    <div className="rounded-lg border bg-card p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-xl font-bold tabular-nums ${tone === "up" ? "text-secondary" : tone === "down" ? "text-destructive" : ""}`}>{value}</div>
    </div>
  );
}

const toneOf = (v: number | null) => (v === null ? undefined : v >= 0 ? "up" : "down");
const signed = (v: number | null) => (v === null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`);

function PerformanceChart({ data }: { data: PerformancePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
        <XAxis dataKey="period" tick={axisTick} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={12} />
        <YAxis yAxisId="amt" tick={axisTick} tickLine={false} axisLine={false} tickFormatter={shortCrore} width={64} />
        <YAxis yAxisId="pct" orientation="right" tick={axisTick} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v}%`} width={40} />
        <Tooltip {...tooltipStyle} formatter={(v: unknown, name: string) => (name.includes("margin") ? pct(v) : crore(v))} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <ReferenceLine yAxisId="amt" y={0} stroke={C.grid} />
        <Bar yAxisId="amt" dataKey="revenue" name="Revenue" fill={C.revenue} radius={[3, 3, 0, 0]} maxBarSize={28} />
        <Bar yAxisId="amt" dataKey="profit" name="Net profit" radius={[3, 3, 0, 0]} maxBarSize={28}>
          {data.map((d) => <Cell key={d.period} fill={(d.profit ?? 0) < 0 ? C.loss : C.profit} />)}
        </Bar>
        <Line yAxisId="pct" dataKey="margin" name="Operating margin" stroke={C.margin} strokeWidth={2} dot={{ r: 2 }} connectNulls />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/**
 * Charts and at-a-glance figures for one stock, all drawn from the stored
 * statements the tables below them show. A chart whose series the source did
 * not report is left out rather than drawn empty.
 */
export default function StockCharts({ statements, shareholding, roeHistory, source }: Props) {
  const [period, setPeriod] = useState<"quarterly" | "annual">("quarterly");
  const quarterly = quarterlyPerformance(statements);
  const annual = annualPerformance(statements);
  const performance = period === "quarterly" && quarterly.length > 0 ? quarterly : annual.length > 0 ? annual : quarterly;
  const cash = cashflowSeries(statements);
  const capital = capitalStructure(statements);
  const holders = shareholdingSlices(shareholding);
  const roe = roeSeries(roeHistory, statements);

  if (performance.length === 0 && cash.length === 0 && capital.length === 0 && holders.slices.length === 0 && roe.length === 0) return null;

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
          <p className="text-xs text-muted-foreground">From company filings via {source}. Amounts in ₹ crore.</p>
        </div>
        {quarterly.length > 0 && annual.length > 0 && (
          <div className="flex bg-muted rounded-lg p-1" role="group" aria-label="Chart period">
            {(["quarterly", "annual"] as const).map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={period === p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 rounded-md text-xs font-semibold capitalize transition-colors ${period === p ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
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

      <div className="grid gap-4 lg:grid-cols-3">
        {performance.length > 0 && (
          <ChartCard
            index={index++}
            className="lg:col-span-2"
            title={`Revenue, profit & margin - ${performance === quarterly ? "quarterly" : "annual"}`}
            subtitle="Bars in ₹ crore (a loss shows red); line is operating margin"
          >
            <PerformanceChart data={performance} />
          </ChartCard>
        )}

        {holders.slices.length > 0 && (
          <ChartCard index={index++} title="Who owns the company" subtitle={holders.date ? `Shareholding as of ${quarterDate(holders.date)}` : undefined}>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={holders.slices} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="80%" paddingAngle={2} stroke="none">
                  {holders.slices.map((s, i) => <Cell key={s.name} fill={PIE[i % PIE.length]} />)}
                </Pie>
                <Tooltip {...tooltipStyle} formatter={(v: unknown) => pct(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {cash.length > 0 && (
          <ChartCard index={index++} className="lg:col-span-2" title="Cash flows" subtitle="Where cash came from and went, by fiscal year (₹ crore)">
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={cash} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
                <XAxis dataKey="period" tick={axisTick} tickLine={false} axisLine={false} minTickGap={12} />
                <YAxis tick={axisTick} tickLine={false} axisLine={false} tickFormatter={shortCrore} width={64} />
                <Tooltip {...tooltipStyle} formatter={(v: unknown) => crore(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <ReferenceLine y={0} stroke={C.axis} />
                <Bar dataKey="operating" name="Operating" fill={C.profit} maxBarSize={18} />
                <Bar dataKey="investing" name="Investing" fill={C.revenue} maxBarSize={18} />
                <Bar dataKey="financing" name="Financing" fill={C.gold} maxBarSize={18} />
                <Line dataKey="free" name="Free cash flow" stroke={C.margin} strokeWidth={2} dot={{ r: 2 }} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {roe.length > 0 && (
          <ChartCard index={index++} title="Return on equity" subtitle="Net profit over shareholders' equity, by fiscal year">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={roe} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
                <XAxis dataKey="period" tick={axisTick} tickLine={false} axisLine={false} minTickGap={8} />
                <YAxis tick={axisTick} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v}%`} width={40} />
                <Tooltip {...tooltipStyle} formatter={(v: unknown) => pct(v)} />
                <ReferenceLine y={15} stroke={C.margin} strokeDasharray="4 4" label={{ value: "15%", fill: C.axis, fontSize: 10, position: "insideTopRight" }} />
                <Bar dataKey="roe" name="ROE" radius={[3, 3, 0, 0]} maxBarSize={26}>
                  {roe.map((r) => <Cell key={r.period} fill={r.roe < 0 ? C.loss : r.roe >= 15 ? C.profit : C.gold} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {capital.length > 0 && (
          <ChartCard index={index++} className="lg:col-span-3" title="Equity vs debt" subtitle="Shareholders' equity against borrowings (₹ crore); line is debt-to-equity">
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={capital} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
                <XAxis dataKey="period" tick={axisTick} tickLine={false} axisLine={false} minTickGap={12} />
                <YAxis yAxisId="amt" tick={axisTick} tickLine={false} axisLine={false} tickFormatter={shortCrore} width={64} />
                <YAxis yAxisId="ratio" orientation="right" tick={axisTick} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v.toFixed(1)}x`} width={40} />
                <Tooltip {...tooltipStyle} formatter={(v: unknown, name: string) => (name === "Debt / equity" ? (typeof v === "number" ? `${v.toFixed(2)}x` : "—") : crore(v))} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar yAxisId="amt" dataKey="equity" name="Equity" fill={C.profit} radius={[3, 3, 0, 0]} maxBarSize={26} />
                <Bar yAxisId="amt" dataKey="debt" name="Debt" fill={C.loss} radius={[3, 3, 0, 0]} maxBarSize={26} />
                <Line yAxisId="ratio" dataKey="debtToEquity" name="Debt / equity" stroke={C.margin} strokeWidth={2} dot={{ r: 2 }} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
      </div>
    </motion.section>
  );
}

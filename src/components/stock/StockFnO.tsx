import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/card";
import { foHistory, lakhs, latestFoChain, oiChangePct, pctChange, shortDate } from "@/lib/market-data";
import { CHART, axisTick, tooltipStyle } from "@/components/markets/chart-kit";
import { BuildUpBadge } from "@/components/markets/FoBuildUp";

const signedPct = (v: number | null) => (v === null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`);
const tone = (v: number | null) => (v === null ? "" : v >= 0 ? "text-secondary" : "text-destructive");
const price = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`);

/**
 * The stock's derivatives at the close, from NSE's F&O bhavcopy: the
 * near-month future and its open interest, the day's build-up, and where the
 * nearest expiry's option writers are positioned. Absent for stocks outside F&O.
 */
export default function StockFnO({ symbol }: { symbol: string }) {
  const chain = useQuery({ queryKey: ["fo-chain", symbol], queryFn: () => latestFoChain(symbol), staleTime: 10 * 60_000 });
  const history = useQuery({ queryKey: ["fo-history", symbol], queryFn: () => foHistory(symbol, 90), staleTime: 10 * 60_000, enabled: !!chain.data });
  const c = chain.data;
  if (!c || c.fut_close === null) return null;

  const move = pctChange(c.fut_close, c.fut_prev_close);
  const oiMove = oiChangePct(c);
  const basis = c.spot !== null ? c.fut_close - c.spot : null;
  const strikes = c.strikes.map((s) => ({ strike: s.k, calls: s.c, puts: s.p }));
  const spotStrike = c.spot === null || strikes.length === 0 ? null : strikes.reduce((b, d) => (Math.abs(d.strike - c.spot!) < Math.abs(b - c.spot!) ? d.strike : b), strikes[0].strike);
  const trend = (history.data ?? []).filter((h) => h.fut_oi !== null).map((h) => ({ date: h.trade_date, oi: h.fut_oi, close: h.fut_close, pcr: h.pcr }));

  const stats: { label: string; value: string; className?: string }[] = [
    { label: "Near-month future", value: price(c.fut_close) },
    { label: "Change", value: signedPct(move), className: tone(move) },
    { label: "Basis over spot", value: basis === null ? "—" : `${basis >= 0 ? "+" : "−"}₹${Math.abs(basis).toFixed(2)}` },
    { label: "Futures OI (shares)", value: lakhs(c.fut_oi) },
    { label: "OI change", value: signedPct(oiMove), className: tone(oiMove) },
    { label: "Put-call ratio", value: c.pcr?.toFixed(2) ?? "—" },
    { label: "Max pain", value: price(c.max_pain) },
    { label: "Resistance (call OI)", value: price(c.call_wall), className: "text-destructive" },
    { label: "Support (put OI)", value: price(c.put_wall), className: "text-secondary" },
    { label: "Lot size", value: c.lot_size?.toLocaleString("en-IN") ?? "—" },
  ];

  return (
    <Card className="min-w-0 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h2 className="text-xl font-bold">Futures &amp; options</h2>
          <p className="text-xs text-muted-foreground">NSE F&amp;O close, {shortDate(c.trade_date)} · options expiring {shortDate(c.expiry)}</p>
        </div>
        <BuildUpBadge value={c.build_up} />
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="min-w-0">
            <dt className="text-xs text-muted-foreground">{s.label}</dt>
            <dd className={`font-semibold tabular-nums ${s.className ?? ""}`}>{s.value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">Open interest by strike</h3>
          <p className="text-xs text-muted-foreground mb-2">Calls open above (resistance) and puts below (support)</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={strikes} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={0}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="strike" tick={axisTick} tickLine={false} axisLine={false} minTickGap={16} />
              <YAxis tick={axisTick} tickLine={false} axisLine={false} width={48} tickFormatter={lakhs} />
              <Tooltip {...tooltipStyle} formatter={(v: unknown) => (typeof v === "number" ? lakhs(v) : "—")} labelFormatter={(k) => `Strike ₹${Number(k).toLocaleString("en-IN")}`} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {spotStrike !== null && <ReferenceLine x={spotStrike} stroke={CHART.primary} strokeDasharray="4 4" label={{ value: "spot", fill: CHART.axis, fontSize: 10, position: "insideTopRight" }} />}
              <Bar dataKey="calls" name="Call OI" fill={CHART.down} maxBarSize={12} />
              <Bar dataKey="puts" name="Put OI" fill={CHART.up} maxBarSize={12} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">Futures open interest and price</h3>
          <p className="text-xs text-muted-foreground mb-2">Near-month future, day by day since collection began</p>
          {trend.length < 2 ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">The daily history builds from each close.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={trend} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="date" tick={axisTick} tickLine={false} axisLine={false} minTickGap={24} tickFormatter={(d: string) => shortDate(d).replace(/ \d{4}$/, "")} />
                <YAxis yAxisId="oi" tick={axisTick} tickLine={false} axisLine={false} width={44} tickFormatter={lakhs} />
                <YAxis yAxisId="px" orientation="right" tick={axisTick} tickLine={false} axisLine={false} width={52} domain={["auto", "auto"]} tickFormatter={(v: number) => `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`} />
                <Tooltip {...tooltipStyle} labelFormatter={(d: string) => shortDate(d)}
                  formatter={(v: unknown, name: string) => (typeof v !== "number" ? "—" : name === "Open interest" ? lakhs(v) : price(v))} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar yAxisId="oi" dataKey="oi" name="Open interest" fill={CHART.muted} fillOpacity={0.35} maxBarSize={10} />
                <Line yAxisId="px" dataKey="close" name="Future" stroke={CHART.primary} strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </Card>
  );
}

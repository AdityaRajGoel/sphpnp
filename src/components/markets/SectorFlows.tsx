import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/card";
import { crore, fpiFortnightTotals, sectorFlowsFor, shortDate, type FpiSector } from "@/lib/market-data";
import { CHART, axisTick, tooltipStyle } from "./chart-kit";

const signedCr = (v: number | null) => (v === null ? "—" : `${v >= 0 ? "+" : "−"}₹${crore(Math.abs(v))}`);
const short = (iso: string) => shortDate(iso).replace(/ \d{4}$/, "");

/** A cell's fill: green for buying, red for selling, stronger with size relative to the biggest move shown. */
const heat = (v: number | null, max: number) => {
  if (v === null || max === 0 || Math.abs(v) < 1) return "transparent";
  const alpha = 0.12 + 0.68 * Math.min(1, Math.abs(v) / max);
  return `hsl(var(${v > 0 ? "--secondary" : "--destructive"}) / ${alpha.toFixed(2)})`;
};

/** Strong fills carry white text; pale ones the page's own. */
const heatText = (v: number | null, max: number) => (v !== null && max > 0 && Math.abs(v) / max > 0.45 ? "#ffffff" : undefined);

/**
 * NSDL's fortnightly sector-wise FPI report: which sectors foreign investors
 * bought and sold in each fortnight, and how much of each they hold.
 */
export default function SectorFlows({ rows }: { rows: FpiSector[] }) {
  const fortnights = useMemo(() => [...new Set(rows.map((r) => r.fortnight_end))].sort(), [rows]);
  const [picked, setPicked] = useState<string | null>(null);
  const fortnight = picked ?? fortnights[fortnights.length - 1];
  const sectors = useMemo(() => sectorFlowsFor(rows, fortnight), [rows, fortnight]);
  const totals = useMemo(() => fpiFortnightTotals(rows), [rows]);
  const recent = useMemo(() => fortnights.slice(-8), [fortnights]);
  const grid = useMemo(() => {
    const byKey = new Map(rows.map((r) => [`${r.sector}|${r.fortnight_end}`, r.equity_net_cr]));
    const names = sectorFlowsFor(rows, fortnights[fortnights.length - 1]).map((s) => s.sector);
    const max = Math.max(0, ...names.flatMap((n) => recent.map((f) => Math.abs(byKey.get(`${n}|${f}`) ?? 0))));
    return { names, byKey, max };
  }, [rows, fortnights, recent]);
  const heldTotal = rows.find((r) => r.sector === "Total" && r.fortnight_end === fortnight)?.equity_auc_cr ?? null;
  const total = totals.find((t) => t.fortnight === fortnight);

  if (!fortnight) return null;
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
      <Card className="min-w-0 p-4 lg:col-span-3">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
          <div>
            <h3 className="font-semibold">Foreign investment by sector</h3>
            <p className="text-xs text-muted-foreground">
              Net equity investment in the fortnight to {shortDate(fortnight)}, ₹ crore · all sectors {signedCr(total?.equity ?? null)}
            </p>
          </div>
          <select value={fortnight} onChange={(e) => setPicked(e.target.value)} aria-label="Fortnight"
            className="rounded-md border bg-background px-2 py-1 text-sm">
            {[...fortnights].reverse().map((f) => <option key={f} value={f}>Fortnight to {shortDate(f)}</option>)}
          </select>
        </div>
        <ResponsiveContainer width="100%" height={Math.max(320, sectors.length * 28)}>
          <BarChart data={sectors} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} horizontal={false} />
            <XAxis type="number" tick={axisTick} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}K`} />
            <YAxis type="category" dataKey="sector" tick={{ ...axisTick, fontSize: 10 }} tickLine={false} axisLine={false} width={150} interval={0} />
            <Tooltip {...tooltipStyle} formatter={(v: unknown) => (typeof v === "number" ? signedCr(v) : "—")} />
            <ReferenceLine x={0} stroke={CHART.axis} />
            <Bar dataKey="equity_net_cr" name="Net equity" maxBarSize={14}>
              {sectors.map((s) => <Cell key={s.sector} fill={(s.equity_net_cr ?? 0) >= 0 ? CHART.up : CHART.down} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Card className="min-w-0 p-4 lg:col-span-2">
        <h3 className="font-semibold">Holdings by sector</h3>
        <p className="text-xs text-muted-foreground mb-2">Equity held on {shortDate(fortnight)}{heldTotal !== null ? `, ₹${crore(heldTotal)} in all` : ""}</p>
        <div className="max-h-[420px] overflow-y-auto">
          <table className="w-full text-xs">
            <caption className="sr-only">Foreign-held equity and net flow by sector</caption>
            <thead className="sticky top-0 bg-card">
              <tr className="border-b text-muted-foreground">
                <th scope="col" className="py-1.5 text-left font-medium">Sector</th>
                <th scope="col" className="py-1.5 text-right font-medium">Held</th>
                <th scope="col" className="py-1.5 text-right font-medium">Share</th>
                <th scope="col" className="py-1.5 text-right font-medium">Net</th>
              </tr>
            </thead>
            <tbody>
              {[...sectors].sort((a, b) => (b.equity_auc_cr ?? 0) - (a.equity_auc_cr ?? 0)).map((s) => (
                <tr key={s.sector} className="border-b last:border-0">
                  <td className="py-1.5 pr-2">{s.sector}</td>
                  <td className="py-1.5 text-right tabular-nums">{crore(s.equity_auc_cr)}</td>
                  <td className="py-1.5 text-right tabular-nums">{heldTotal && s.equity_auc_cr !== null ? `${((s.equity_auc_cr / heldTotal) * 100).toFixed(1)}%` : "—"}</td>
                  <td className={`py-1.5 text-right tabular-nums font-semibold ${(s.equity_net_cr ?? 0) >= 0 ? "text-secondary" : "text-destructive"}`}>{signedCr(s.equity_net_cr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {recent.length > 1 && (
        <Card className="min-w-0 p-4 lg:col-span-5">
          <h3 className="font-semibold">Sector flows, fortnight by fortnight</h3>
          <p className="text-xs text-muted-foreground mb-3">Net equity investment, ₹ crore; deeper colour is a bigger move. Click a column to chart that fortnight.</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-xs">
              <caption className="sr-only">Net foreign equity investment by sector for the last {recent.length} fortnights</caption>
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th scope="col" className="py-1.5 text-left font-medium">Sector</th>
                  {recent.map((f) => (
                    <th key={f} scope="col" className="py-1.5 px-1 text-right font-medium">
                      <button type="button" onClick={() => setPicked(f)} className={`hover:text-foreground ${f === fortnight ? "text-foreground font-semibold underline" : ""}`}>{short(f)}</button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grid.names.map((name) => (
                  <tr key={name} className="border-b last:border-0">
                    <td className="py-1 pr-2 whitespace-nowrap">{name}</td>
                    {recent.map((f) => {
                      const v = grid.byKey.get(`${name}|${f}`) ?? null;
                      return <td key={f} className="py-1 px-1 text-right tabular-nums" style={{ background: heat(v, grid.max), color: heatText(v, grid.max) }}>{v === null ? "—" : Math.round(v).toLocaleString("en-IN")}</td>;
                    })}
                  </tr>
                ))}
                <tr className="border-t-2 font-semibold">
                  <td className="py-1 pr-2">All sectors</td>
                  {recent.map((f) => {
                    const v = totals.find((t) => t.fortnight === f)?.equity ?? null;
                    return <td key={f} className={`py-1 px-1 text-right tabular-nums ${v === null ? "" : v >= 0 ? "text-secondary" : "text-destructive"}`}>{v === null ? "—" : Math.round(v).toLocaleString("en-IN")}</td>;
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AnimatedNumber from "@/components/ui/animated-number";
import { revealSection } from "@/lib/motion";
import { CHART } from "@/components/markets/chart-kit";
import { getFundHistory, getTrackedFunds, trailingCagr } from "@/lib/mutual-funds";
import { rollingSipReturns, runSip } from "@/lib/sip-backtest";

const rupees = (v: number) => `₹${Math.round(v).toLocaleString("en-IN")}`;
const pct = (v: number | null, digits = 1) => (v === null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(digits)}%`);

/** Invested vs value over the SIP, as two SVG lines - no chart library for two series. */
function GrowthChart({ points }: { points: { invested: number; value: number }[] }) {
  if (points.length < 2) return null;
  const max = Math.max(...points.map((p) => Math.max(p.invested, p.value)));
  const line = (key: "invested" | "value") =>
    points.map((p, i) => `${(i / (points.length - 1)) * 100},${100 - (p[key] / max) * 100}`).join(" ");
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-40 w-full" role="img" aria-label="Invested amount and portfolio value over the SIP">
      <polyline points={line("invested")} fill="none" stroke={CHART.muted} strokeWidth="2" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
      <polyline points={line("value")} fill="none" stroke={CHART.up} strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/**
 * What a monthly SIP in a real fund would have become, replayed on the fund's
 * published NAVs - beside the formula calculator, which assumes a return.
 */
export default function SipBacktest() {
  const funds = useQuery({ queryKey: ["mf-tracked"], queryFn: getTrackedFunds, staleTime: 60 * 60_000 });
  const [code, setCode] = useState<string | null>(null);
  const [monthly, setMonthly] = useState(5000);
  const [years, setYears] = useState(5);
  const scheme = code ?? funds.data?.[0]?.scheme_code ?? null;
  const history = useQuery({ queryKey: ["mf-history", scheme], queryFn: () => getFundHistory(scheme!), enabled: !!scheme, staleTime: 6 * 60 * 60_000, retry: 1 });

  const navs = history.data?.navs;
  const result = useMemo(() => {
    if (!navs?.length) return null;
    const last = navs[navs.length - 1].date;
    const start = new Date(`${last}T00:00:00Z`);
    start.setUTCFullYear(start.getUTCFullYear() - years);
    const startIso = start.toISOString().slice(0, 10);
    return startIso < navs[0].date ? null : runSip(navs, monthly, startIso, years * 12);
  }, [navs, monthly, years]);
  const rolling = useMemo(() => (navs ? rollingSipReturns(navs, years) : []), [navs, years]);
  const cagr = useMemo(() => (navs ? [1, 3, 5, 10].map((y) => ({ y, v: trailingCagr(navs, y) })) : []), [navs]);
  const rollMax = Math.max(1, ...rolling.map((r) => Math.abs(r.xirrPct)));

  return (
    <motion.section {...revealSection} aria-labelledby="sip-backtest" className="container mx-auto px-4 pb-16">
      <div className="mb-6">
        <span className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-secondary"><History className="h-4 w-4" aria-hidden="true" />Backtest on real NAVs</span>
        <h2 id="sip-backtest" className="mt-2 font-heading text-3xl font-bold">What a SIP in a real fund actually became</h2>
        <p className="mt-2 max-w-3xl text-muted-foreground">The calculator above assumes a return. This replays a monthly SIP on a fund's published NAVs: each instalment buys at that day's NAV, and the units are valued at the latest one.</p>
      </div>

      <Card className="p-4 md:p-5 mb-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-muted-foreground">Fund</span>
            <Select value={scheme ?? ""} onValueChange={setCode} disabled={!funds.data?.length}>
              <SelectTrigger aria-label="Fund"><SelectValue placeholder={funds.isLoading ? "Loading funds…" : "Choose a fund"} /></SelectTrigger>
              <SelectContent>{(funds.data ?? []).map((f) => <SelectItem key={f.scheme_code} value={f.scheme_code}>{f.scheme_name}</SelectItem>)}</SelectContent>
            </Select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-muted-foreground">Monthly SIP: {rupees(monthly)}</span>
            <input type="range" min={500} max={100000} step={500} value={monthly} onChange={(e) => setMonthly(Number(e.target.value))} className="mt-3 w-full accent-secondary" aria-label="Monthly SIP amount" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-muted-foreground">Period: {years} years</span>
            <input type="range" min={1} max={12} step={1} value={years} onChange={(e) => setYears(Number(e.target.value))} className="mt-3 w-full accent-brand-gold" aria-label="SIP period in years" />
          </label>
        </div>
      </Card>

      {history.isLoading || funds.isLoading ? <Skeleton className="h-72 w-full" /> : history.error ? (
        <Card className="p-6 text-sm text-muted-foreground">NAV history is unavailable right now.</Card>
      ) : !result ? (
        <Card className="p-6 text-sm text-muted-foreground">This fund's published history is shorter than {years} years. Choose a shorter period.</Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <Card className="p-5">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div><div className="text-xs text-muted-foreground">Invested</div><AnimatedNumber value={result.invested} format={rupees} className="text-lg font-bold" /></div>
              <div><div className="text-xs text-muted-foreground">Worth today</div><AnimatedNumber value={result.value} format={rupees} className="text-lg font-bold text-secondary" /></div>
              <div><div className="text-xs text-muted-foreground">Gain</div><AnimatedNumber value={result.gain} format={(v) => `${v >= 0 ? "+" : "−"}${rupees(Math.abs(v))}`} className={`text-lg font-bold ${result.gain >= 0 ? "text-secondary" : "text-destructive"}`} /></div>
              <div><div className="text-xs text-muted-foreground" title="Annualised, money-weighted">XIRR</div><AnimatedNumber value={result.xirrPct} format={(v) => pct(v)} className="text-lg font-bold" /></div>
            </div>
            <div className="mt-4"><GrowthChart points={result.instalments} /></div>
            <p className="mt-1 text-xs text-muted-foreground">
              <span className="font-semibold text-secondary">Solid:</span> value · <span className="font-semibold">Dashed:</span> invested · {result.instalments.length} instalments from {result.instalments[0].date} to {result.valueDate}
            </p>
          </Card>

          <div className="space-y-4">
            <Card className="p-5">
              <h3 className="text-sm font-semibold">{history.data?.scheme_name ?? "Fund"}</h3>
              <p className="text-xs text-muted-foreground">{[history.data?.fund_house, history.data?.scheme_category].filter(Boolean).join(" · ")}</p>
              <dl className="mt-3 grid grid-cols-4 gap-2 text-center">
                {cagr.map(({ y, v }) => (
                  <div key={y} className="rounded-lg bg-muted/40 py-2">
                    <dt className="text-[11px] text-muted-foreground">{y}Y CAGR</dt>
                    <dd className={`text-sm font-semibold tabular-nums ${v === null ? "text-muted-foreground" : v >= 0 ? "text-secondary" : "text-destructive"}`}>{pct(v)}</dd>
                  </div>
                ))}
              </dl>
            </Card>
            {rolling.length > 1 && (
              <Card className="p-5">
                <h3 className="text-sm font-semibold">Same {years}-year SIP, by start year</h3>
                <p className="text-xs text-muted-foreground mb-3">XIRR had it begun in January of each year - how much the start date mattered.</p>
                <ul className="space-y-1">
                  {rolling.map((r) => (
                    <li key={r.startYear} className="grid grid-cols-[3rem_1fr_4rem] items-center gap-2 text-xs">
                      <span className="tabular-nums text-muted-foreground">{r.startYear}</span>
                      <span className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true"><span className={`block h-full ${r.xirrPct >= 0 ? "bg-secondary/70" : "bg-destructive/70"}`} style={{ width: `${(Math.abs(r.xirrPct) / rollMax) * 100}%` }} /></span>
                      <span className={`text-right font-semibold tabular-nums ${r.xirrPct >= 0 ? "text-secondary" : "text-destructive"}`}>{pct(r.xirrPct)}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        </div>
      )}

      {funds.data && funds.data.length > 0 && (
        <Card className="mt-4 overflow-x-auto p-0">
          <table className="w-full text-sm">
            <caption className="px-4 pt-4 text-left text-sm font-semibold">Tracked funds, latest NAV</caption>
            <thead className="text-muted-foreground"><tr><th scope="col" className="px-4 py-2 text-left font-medium">Scheme</th><th scope="col" className="px-3 py-2 text-right font-medium">NAV</th><th scope="col" className="px-3 py-2 text-right font-medium">Day</th><th scope="col" className="px-4 py-2 text-right font-medium">As of</th></tr></thead>
            <tbody>
              {funds.data.map((f) => {
                const day = f.prev_nav ? (f.nav / f.prev_nav - 1) * 100 : null;
                return (
                  <tr key={f.scheme_code} className={`border-t cursor-pointer hover:bg-muted/30 ${f.scheme_code === scheme ? "bg-secondary/5" : ""}`} onClick={() => setCode(f.scheme_code)}>
                    <td className="px-4 py-2 font-medium">{f.scheme_name}</td>
                    <td className="px-3 py-2 text-right tabular-nums">₹{f.nav.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${day === null ? "text-muted-foreground" : day >= 0 ? "text-secondary" : "text-destructive"}`}>{pct(day, 2)}</td>
                    <td className="px-4 py-2 text-right text-xs text-muted-foreground">{f.nav_date}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
      <p className="mt-3 text-xs text-muted-foreground">NAVs from AMFI via mfapi.in, direct-growth plans. Exit load, stamp duty and tax are not modelled. Past returns do not indicate future returns. Mutual fund investments are subject to market risks; read all scheme-related documents carefully.</p>
    </motion.section>
  );
}

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import AnimatedNumber from "@/components/ui/animated-number";
import { STAGE_LABEL, type PipelineCompany, type PipelineStage } from "@/lib/ipo-pipeline";

const STAGES: PipelineStage[] = ["drhp_filed", "udrhp_filed", "rhp_filed", "launched"];
const MONTH = new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: "UTC" });

export type PipelineStats = {
  byStage: Record<PipelineStage, number>;
  /** Filings of any kind per calendar month, oldest first, for the last 12 months ending `today`. */
  monthly: { month: string; label: string; count: number }[];
  recentDrafts: PipelineCompany[];
  /** Median months from first filing to launch, for launched companies. */
  medianMonthsToLaunch: number | null;
};

export function pipelineStats(companies: PipelineCompany[], today: string): PipelineStats {
  const byStage = Object.fromEntries(STAGES.map((s) => [s, companies.filter((c) => c.stage === s).length])) as Record<PipelineStage, number>;
  const end = new Date(`${today.slice(0, 7)}-01T00:00:00Z`);
  const monthly = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 11 + i, 1));
    const month = d.toISOString().slice(0, 7);
    return { month, label: MONTH.format(d), count: 0 };
  });
  const index = new Map(monthly.map((m, i) => [m.month, i]));
  for (const c of companies) for (const f of c.filings) { const i = index.get(f.filed_on.slice(0, 7)); if (i !== undefined) monthly[i].count++; }
  const months = companies
    .filter((c) => c.stage === "launched")
    .map((c) => {
      const launch = c.filings.find((f) => f.kind === "rhp" || f.kind === "prospectus")?.filed_on ?? c.latest_filed_on;
      return (Date.parse(launch) - Date.parse(c.first_filed_on)) / (30.44 * 86_400_000);
    })
    .filter((m) => Number.isFinite(m) && m >= 0)
    .sort((a, b) => a - b);
  const mid = months.length >> 1;
  return {
    byStage,
    monthly,
    recentDrafts: companies.filter((c) => c.stage === "drhp_filed").sort((a, b) => b.first_filed_on.localeCompare(a.first_filed_on)).slice(0, 6),
    medianMonthsToLaunch: months.length === 0 ? null : months.length % 2 ? months[mid] : (months[mid - 1] + months[mid]) / 2,
  };
}

/** The pipeline at a glance above the company list: stages, filing activity, newest drafts and time to launch. */
export default function PipelineOverview({ companies, today }: { companies: PipelineCompany[]; today: string }) {
  const s = useMemo(() => pipelineStats(companies, today), [companies, today]);
  if (companies.length === 0) return null;
  const peak = Math.max(1, ...s.monthly.map((m) => m.count));

  return (
    <section aria-labelledby="pipeline-overview" className="mt-8">
      <h2 id="pipeline-overview" className="sr-only">Pipeline overview</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {STAGES.map((stage) => (
          <Card key={stage} className="p-4">
            <div className="text-xs text-muted-foreground">{STAGE_LABEL[stage]}</div>
            <AnimatedNumber value={s.byStage[stage]} className="mt-1 block text-3xl font-bold" />
          </Card>
        ))}
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        <Card className="min-w-0 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h3 className="text-sm font-semibold">SEBI filings per month</h3>
            {s.medianMonthsToLaunch !== null && <span className="text-xs text-muted-foreground">Median {s.medianMonthsToLaunch.toFixed(1)} months from first draft to launch</span>}
          </div>
          <div className="mt-4 flex h-32 items-end gap-1.5" role="img" aria-label={`Filings per month: ${s.monthly.map((m) => `${m.label} ${m.count}`).join(", ")}`}>
            {s.monthly.map((m) => (
              <div key={m.month} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
                <span className="text-[10px] tabular-nums text-muted-foreground">{m.count || ""}</span>
                <div className="w-full rounded-t bg-secondary/70" style={{ height: `${(m.count / peak) * 100}%`, minHeight: m.count ? 2 : 0 }} />
                <span className="text-[10px] text-muted-foreground">{m.label}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card className="min-w-0 p-4">
          <h3 className="text-sm font-semibold mb-2">Newest draft filers</h3>
          <ul className="space-y-1.5">
            {s.recentDrafts.map((c) => (
              <li key={c.key} className="flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate font-medium">{c.name}</span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{new Date(`${c.first_filed_on}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" })}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </section>
  );
}

import { motion } from "motion/react";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { revealSection } from "@/lib/motion";
import type { ScreenerProfile } from "@/lib/stock-disclosures";

const pct = (v: number | null) => (v === null ? "—" : `${v > 0 ? "+" : ""}${v}%`);

/** screener.in's checklist verdicts and compounded growth, with the company's own summary. */
export default function CompanyInsights({ screener }: { screener: ScreenerProfile }) {
  const hasChecklist = screener.pros.length > 0 || screener.cons.length > 0;
  const growth = screener.growth.filter((g) => g.values.some((v) => v.pct !== null));
  if (!hasChecklist && growth.length === 0 && !screener.about) return null;

  return (
    <motion.section {...revealSection} aria-labelledby="insights-heading" className="space-y-4">
      <h2 id="insights-heading" className="text-2xl font-bold">Strengths, risks &amp; growth</h2>
      {screener.about && <p className="text-sm text-muted-foreground max-w-3xl leading-relaxed">{screener.about}</p>}

      {hasChecklist && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card className="p-4 border-l-4 border-l-secondary">
            <h3 className="font-semibold text-sm mb-2 text-secondary">Strengths</h3>
            {screener.pros.length > 0 ? (
              <ul className="space-y-2">
                {screener.pros.map((p) => (
                  <li key={p} className="flex gap-2 text-sm"><CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-secondary" aria-hidden="true" />{p}</li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground">None flagged by the checklist.</p>}
          </Card>
          <Card className="p-4 border-l-4 border-l-destructive">
            <h3 className="font-semibold text-sm mb-2 text-destructive">Risks</h3>
            {screener.cons.length > 0 ? (
              <ul className="space-y-2">
                {screener.cons.map((c) => (
                  <li key={c} className="flex gap-2 text-sm"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-destructive" aria-hidden="true" />{c}</li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground">None flagged by the checklist.</p>}
          </Card>
        </div>
      )}

      {growth.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {growth.map((g) => (
            <Card key={g.title} className="p-3">
              <h3 className="text-xs font-semibold text-muted-foreground mb-2">{g.title}</h3>
              <dl className="space-y-1">
                {g.values.map((v) => (
                  <div key={v.period} className="flex justify-between text-sm">
                    <dt className="text-muted-foreground">{v.period}</dt>
                    <dd className={`font-semibold tabular-nums ${v.pct === null ? "text-muted-foreground" : v.pct >= 0 ? "text-secondary" : "text-destructive"}`}>{pct(v.pct)}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Strengths and risks are a machine-generated checklist, not advice; growth is compounded annually over each period.
      </p>
    </motion.section>
  );
}

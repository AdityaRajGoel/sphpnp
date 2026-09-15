import { useMemo } from "react";
import { motion } from "motion/react";
import { Check, ListChecks, Minus, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DURATION, EASE_OUT, revealItem, revealSection } from "@/lib/motion";
import { useScreenerUniverse } from "@/hooks/useScreenerUniverse";
import { sectorPeers } from "@/lib/stock-peers";
import { buildChecklist, tally, type ChecklistItem, type Verdict } from "@/lib/stock-checklist";

const GROW_X = {
  initial: { scaleX: 0 },
  whileInView: { scaleX: 1 },
  viewport: { once: true },
  transition: { duration: DURATION.reveal, ease: EASE_OUT },
} as const;

const TONE: Record<Verdict, { label: string; bar: string; chip: string; Icon: typeof Check }> = {
  pass: { label: "Strengths", bar: "bg-secondary", chip: "border-secondary/30 bg-secondary/10 text-secondary", Icon: Check },
  neutral: { label: "Neutral", bar: "bg-muted-foreground/40", chip: "border-border bg-muted/50 text-muted-foreground", Icon: Minus },
  fail: { label: "Weaknesses", bar: "bg-destructive", chip: "border-destructive/30 bg-destructive/10 text-destructive", Icon: X },
};

const AREAS: ChecklistItem["area"][] = ["Profitability", "Growth", "Balance sheet", "Valuation", "Price action"];

/**
 * Strengths and weaknesses as a tally, the way Tijori and Trendlyne summarise
 * a company: every figure the site holds judged against a written line.
 */
export default function StockChecklist({ symbol }: { symbol: string }) {
  const { data } = useScreenerUniverse();
  const items = useMemo(() => {
    const row = data?.get(symbol.toUpperCase());
    return buildChecklist(row, sectorPeers(data, symbol)?.median.pe ?? null);
  }, [data, symbol]);
  if (items.length < 3) return null;

  const counts = tally(items);
  const order: Verdict[] = ["pass", "neutral", "fail"];

  return (
    <motion.section {...revealSection} aria-labelledby="checklist-heading">
      <Card className="p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="checklist-heading" className="flex items-center gap-2 text-lg font-bold">
            <ListChecks className="h-4 w-4 text-secondary" aria-hidden="true" /> Checklist
          </h2>
          <p className="flex items-center gap-4 text-sm">
            {order.map((v) => (
              <span key={v} className="inline-flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-full ${TONE[v].bar}`} aria-hidden="true" />
                <span className="font-semibold tabular-nums">{counts[v]}</span>
                <span className="text-muted-foreground">{TONE[v].label.toLowerCase()}</span>
              </span>
            ))}
          </p>
        </div>

        <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${counts.pass} strengths, ${counts.neutral} neutral, ${counts.fail} weaknesses out of ${items.length} checks`}>
          {order.map((v) => counts[v] > 0 && (
            <motion.div key={v} {...GROW_X} style={{ width: `${(counts[v] / items.length) * 100}%`, transformOrigin: "left" }} className={TONE[v].bar} />
          ))}
        </div>

        <div className="mt-5 grid gap-x-8 gap-y-5 md:grid-cols-2">
          {AREAS.map((area) => {
            const inArea = items.filter((i) => i.area === area);
            if (inArea.length === 0) return null;
            return (
              <div key={area}>
                <h3 className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{area}</h3>
                <ul className="mt-2 space-y-2">
                  {inArea.map((item, i) => {
                    const { Icon, chip } = TONE[item.verdict];
                    return (
                      <motion.li key={item.id} {...revealItem(i)} className="flex items-start gap-2.5">
                        <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${chip}`}>
                          <Icon className="h-3 w-3" aria-hidden="true" />
                          <span className="sr-only">{TONE[item.verdict].label}:</span>
                        </span>
                        <span className="min-w-0 text-sm">
                          <span className="font-medium">{item.label}</span>
                          <span className="block text-xs text-muted-foreground">{item.detail}</span>
                        </span>
                      </motion.li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">Conventional screening lines applied to the latest figures. A description of the numbers, not a recommendation.</p>
      </Card>
    </motion.section>
  );
}

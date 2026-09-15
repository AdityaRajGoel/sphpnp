import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { AlertTriangle, ExternalLink, Scale } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { revealItem, revealSection } from "@/lib/motion";
import { getLegalFilings, type LegalTopic } from "@/lib/legal-filings";

const INITIAL = 6;

const formatDate = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso)) : "Undated";

/**
 * Legal, tax, regulatory and governance disclosures the company itself has
 * filed with the exchange - tribunal hearings, tax demands, penalties, rating
 * actions, auditor changes, disruptions - sorted out of the routine notices.
 * Regulator orders naming the company are listed separately below this.
 */
export default function LegalWatch({ symbol }: { symbol: string }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ["legal-filings", symbol],
    queryFn: () => getLegalFilings(symbol),
    staleTime: 30 * 60_000,
  });
  const [topic, setTopic] = useState<LegalTopic | "all">("all");
  const [expanded, setExpanded] = useState(false);

  const topics = useMemo(() => {
    const counts = new Map<LegalTopic, number>();
    for (const f of data) counts.set(f.topic, (counts.get(f.topic) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [data]);

  if (isLoading || data.length === 0) return null;
  const filtered = topic === "all" ? data : data.filter((f) => f.topic === topic);
  const shown = expanded ? filtered : filtered.slice(0, INITIAL);
  const adverse = data.filter((f) => f.adverse).length;

  return (
    <motion.section {...revealSection} aria-labelledby="legal-heading">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="legal-heading" className="flex items-center gap-2 text-2xl font-bold">
          <Scale className="h-5 w-5 text-secondary" aria-hidden="true" /> Legal &amp; regulatory watch
        </h2>
        <p className="text-sm text-muted-foreground tabular-nums">
          {data.length} disclosure{data.length === 1 ? "" : "s"}
          {adverse > 0 && <span className="text-destructive"> · {adverse} flagged adverse</span>}
        </p>
      </div>

      <div role="group" aria-label="Filter by topic" className="mb-3 flex flex-wrap gap-1.5">
        {([["all", data.length], ...topics] as [LegalTopic | "all", number][]).map(([t, n]) => (
          <button
            key={t}
            type="button"
            aria-pressed={topic === t}
            onClick={() => { setTopic(t); setExpanded(false); }}
            className={`pressable rounded-full border px-3 py-1 text-xs font-medium transition-colors ${topic === t ? "border-secondary bg-secondary text-secondary-foreground" : "border-border text-muted-foreground hover:border-secondary/50 hover:text-foreground"}`}
          >
            {t === "all" ? "All" : t} <span className="tabular-nums opacity-70">{n}</span>
          </button>
        ))}
      </div>

      <ul className="space-y-2">
        {shown.map((f, i) => (
          <motion.li key={f.id} {...revealItem(Math.min(i, 5))}>
            <Card className={`relative flex flex-wrap items-start justify-between gap-3 overflow-hidden p-4 transition-colors hover:bg-muted/30 ${f.adverse ? "border-destructive/30" : ""}`}>
              {f.adverse && <span className="absolute inset-y-0 left-0 w-1 bg-destructive/70" aria-hidden="true" />}
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  {f.topic}
                  {f.adverse && <span className="inline-flex items-center gap-1 text-destructive"><AlertTriangle className="h-3 w-3" aria-hidden="true" /> Adverse</span>}
                </div>
                <p className="text-sm font-medium">{f.subject}</p>
                {f.summary && <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{f.summary}</p>}
              </div>
              <div className="shrink-0 text-right text-sm">
                <div className="font-medium tabular-nums">{formatDate(f.published_at)}</div>
                {f.url && (
                  <a href={f.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-secondary hover:underline">
                    Filing <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                )}
              </div>
            </Card>
          </motion.li>
        ))}
      </ul>
      {filtered.length > INITIAL && (
        <Button variant="ghost" size="sm" className="mt-2" onClick={() => setExpanded((e) => !e)} aria-expanded={expanded}>
          {expanded ? "Show fewer" : `Show all ${filtered.length}`}
        </Button>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        Picked out of the company's exchange filings by topic. "Adverse" marks wording such as penalties, demands, downgrades or resignations - read the filing for the amount and status. Not legal advice.
      </p>
    </motion.section>
  );
}

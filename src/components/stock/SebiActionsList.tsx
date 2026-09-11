import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ExternalLink, Gavel, Landmark } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { revealSection } from "@/lib/motion";
import { getSebiActions, isSebiLink, splitSebiActions, type SebiAction } from "@/lib/sebi-actions";

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

/** How many of each list show before "Show all". */
const INITIAL = 5;

function ActionList({ actions }: { actions: SebiAction[] }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? actions : actions.slice(0, INITIAL);
  return (
    <>
      <ul className="space-y-2">
        {shown.map((a) => (
          <li key={a.url}>
            <Card className="flex flex-wrap items-start justify-between gap-3 p-4 transition-colors hover:bg-muted/30">
              <div className="min-w-0">
                <Badge variant="outline" className="mb-1.5">{a.kind}</Badge>
                <p className="text-sm break-words">{a.title}</p>
              </div>
              <div className="shrink-0 text-right text-sm">
                <div className="font-medium tabular-nums">{formatDate(a.filed_on)}</div>
                {isSebiLink(a.url) && (
                  <a href={a.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-secondary hover:underline">
                    Read on SEBI <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </Card>
          </li>
        ))}
      </ul>
      {actions.length > INITIAL && (
        <button type="button" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded} className="mt-2 text-sm font-semibold text-secondary hover:underline">
          {expanded ? "Show fewer" : `Show all ${actions.length}`}
        </button>
      )}
    </>
  );
}

/**
 * SEBI's own record for this company: buybacks, open offers and rights issues
 * filed with SEBI, and orders naming the company - settlements, adjudications,
 * directions. Renders nothing until the sync has reached the stock, or when
 * SEBI has nothing on it.
 */
export default function SebiActionsList({ symbol }: { symbol: string }) {
  const [actions, setActions] = useState<SebiAction[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSebiActions(symbol).then((rows) => { if (!cancelled) setActions(rows); }).catch(() => { if (!cancelled) setActions([]); });
    return () => { cancelled = true; };
  }, [symbol]);

  if (!actions || actions.length === 0) return null;
  const { corporate, orders } = splitSebiActions(actions);

  return (
    <motion.section {...revealSection} aria-labelledby="sebi-heading" className="space-y-6">
      <div>
        <h2 id="sebi-heading" className="text-2xl font-bold">SEBI filings &amp; orders</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          From SEBI's website. An order may concern the company, its officers or trading in its shares, and may be
          under appeal - read the order itself. Personal identifiers are withheld.
        </p>
      </div>
      {corporate.length > 0 && (
        <div>
          <h3 className="mb-3 flex items-center gap-2 font-semibold"><Landmark className="h-4 w-4 text-secondary" />Buybacks, open offers &amp; rights issues</h3>
          <ActionList actions={corporate} />
        </div>
      )}
      {orders.length > 0 && (
        <div>
          <h3 className="mb-3 flex items-center gap-2 font-semibold"><Gavel className="h-4 w-4 text-secondary" />Regulatory orders</h3>
          <ActionList actions={orders} />
        </div>
      )}
    </motion.section>
  );
}

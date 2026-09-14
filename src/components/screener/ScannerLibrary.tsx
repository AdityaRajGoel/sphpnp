import { useState } from "react";
import { Radar, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SCANS, SCAN_GROUPS, SCAN_BY_ID, type ScanGroup } from "@/lib/screener-scans";

type Props = {
  active: string[];
  counts: Map<string, number>;
  onToggle: (id: string, group: ScanGroup) => void;
  onClear: () => void;
};

/**
 * Every ready-made scan, grouped, each with its live match count across the
 * tracked universe. Several can be on at once and combine with AND - "above
 * 200DMA" plus "RSI under 45" plus "ROCE 20%+" is one question.
 */
export default function ScannerLibrary({ active, counts, onToggle, onClear }: Props) {
  const firstActiveGroup = active.map((id) => SCAN_BY_ID.get(id)?.group).find(Boolean);
  const [group, setGroup] = useState<ScanGroup>(firstActiveGroup ?? "today");
  const shown = SCANS.filter((s) => s.group === group);

  return (
    <section aria-labelledby="scanner-library" className="mb-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 id="scanner-library" className="text-xl font-heading font-bold flex items-center gap-2">
          <Radar className="w-5 h-5 text-secondary" aria-hidden="true" />
          Scanners
          <span className="text-sm font-normal text-muted-foreground">{SCANS.length} ready-made · combine any</span>
        </h2>
        {active.length > 0 && (
          <Button variant="ghost" size="sm" onClick={onClear} className="h-8 text-muted-foreground hover:text-foreground">
            <X className="w-3.5 h-3.5 mr-1" /> Clear scans ({active.length})
          </Button>
        )}
      </div>

      <div role="tablist" aria-label="Scanner groups" className="flex gap-1 overflow-x-auto pb-2 -mx-1 px-1 [scrollbar-width:none]">
        {SCAN_GROUPS.map((g) => {
          const on = active.filter((id) => SCAN_BY_ID.get(id)?.group === g.id).length;
          return (
            <button
              key={g.id}
              role="tab"
              type="button"
              aria-selected={group === g.id}
              onClick={() => setGroup(g.id)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${group === g.id ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
            >
              {g.label}
              {on > 0 && <span className="ml-1.5 rounded bg-secondary px-1.5 text-[10px] text-secondary-foreground">{on}</span>}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
        {shown.map((scan) => {
          const isActive = active.includes(scan.id);
          const count = counts.get(scan.id) ?? 0;
          return (
            <button
              key={scan.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => onToggle(scan.id, scan.group)}
              className={`group text-left rounded-xl border p-3 transition-[border-color,background-color,transform] duration-fast ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${isActive ? "border-secondary bg-secondary/10" : "border-border bg-card hover:border-foreground/30"}`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className={`text-sm font-semibold leading-tight ${isActive ? "text-secondary" : "text-foreground"}`}>{scan.name}</span>
                <span className={`font-mono text-xs tabular-nums ${count === 0 ? "text-muted-foreground/60" : "text-muted-foreground"}`}>{count}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{scan.desc}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}

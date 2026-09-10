import { fieldSourceLabel, type Ipo } from "@/lib/ipo";

/**
 * Tiny provenance tag for one reconciled figure. `field_sources` exists
 * precisely so a number can be traced to the site that supplied it, so every
 * surfaced figure that has an entry should carry one of these — a bare number
 * with no attribution is exactly the failure mode the column was added to fix.
 *
 * Renders nothing when the field has no recorded source (e.g. the value
 * itself is absent, or the field isn't one of the ones sync-ipos tracks
 * provenance for) — an empty tag would be worse than no tag.
 */
export default function IPOFieldSource({ ipo, field }: { ipo: Ipo; field: string }) {
  const label = fieldSourceLabel(ipo.field_sources, field);
  if (!label) return null;
  return <span className="text-[10px] font-medium text-muted-foreground/80 whitespace-nowrap">via {label}</span>;
}

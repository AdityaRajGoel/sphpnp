import type { InfographicBar, SectionInfographic } from "@/lib/ipo-infographics";

/**
 * The chart that sits above an issue-page table (see IPOPageSections).
 *
 * Drawn in plain CSS rather than with the charting library the GMP history
 * uses: these are a dozen static bars with no axis, no zoom and no crosshair,
 * and pulling a canvas renderer onto the page for them would cost far more
 * than it draws.
 *
 * Every bar is directly labelled with the source cell's own text. That is not
 * decoration - the segment colours sit close enough for a red-green reader
 * that colour alone must never be what tells two of them apart, and the full
 * table is right below in any case.
 */

/** Matches the --chart-N tokens defined in index.css, in their fixed order. */
const SEGMENT_COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))"];

/** A share segment thinner than this cannot hold a rounded end, so it is floored. */
const MIN_SEGMENT_PERCENT = 1.5;

function ShareChart({ groups }: { groups: SectionInfographic["groups"] }) {
  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const total = group.bars.reduce((sum, bar) => sum + bar.value, 0) || 1;
        return (
          <div key={group.label ?? "single"}>
            {group.label && <p className="text-xs font-semibold text-muted-foreground mb-1.5">{group.label}</p>}
            <div className="flex gap-[2px] h-3" aria-hidden="true">
              {group.bars.map((bar, index) => (
                <div
                  key={bar.label}
                  className="rounded-[4px] first:rounded-l-[4px] last:rounded-r-[4px]"
                  style={{
                    width: `${Math.max(MIN_SEGMENT_PERCENT, (bar.value / total) * 100)}%`,
                    background: SEGMENT_COLORS[index % SEGMENT_COLORS.length],
                  }}
                />
              ))}
            </div>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
              {group.bars.map((bar, index) => (
                <li key={bar.label} className="flex items-center gap-1.5 text-xs min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-[3px] shrink-0"
                    style={{ background: SEGMENT_COLORS[index % SEGMENT_COLORS.length] }}
                    aria-hidden="true"
                  />
                  <span className="text-muted-foreground truncate">{bar.label}</span>
                  <strong className="tabular-nums">{bar.display}</strong>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function MagnitudeRow({ bar, max }: { bar: InfographicBar; max: number }) {
  const width = Math.max(MIN_SEGMENT_PERCENT, (Math.abs(bar.value) / max) * 100);
  return (
    <div className="grid grid-cols-[minmax(4.5rem,9rem)_1fr_auto] items-center gap-2 sm:gap-3">
      <span className="text-xs text-muted-foreground line-clamp-2 break-words" title={bar.label}>
        {bar.label}
        {bar.partial && <span className="block text-[10px] opacity-80">part period</span>}
      </span>
      <span className="h-2.5 rounded-[4px] bg-muted overflow-hidden" aria-hidden="true">
        <span
          className="block h-full rounded-[4px]"
          style={{
            width: `${width}%`,
            // A negative line (a loss-making year) is a different fact from a
            // small positive one, and a bar drawn from the same edge in the
            // same colour would say they were the same. A stub period is
            // muted for the same reason: it is not the same kind of number as
            // the full years beside it.
            background:
              bar.value < 0
                ? "hsl(var(--destructive))"
                : bar.partial
                  ? "hsl(var(--chart-1) / 0.45)"
                  : "hsl(var(--chart-1))",
          }}
        />
      </span>
      <strong className="text-xs tabular-nums whitespace-nowrap">{bar.display}</strong>
    </div>
  );
}

function MagnitudeChart({ groups }: { groups: SectionInfographic["groups"] }) {
  return (
    <div className="space-y-4">
      {groups.map((group) => {
        // Scaled per group, never across groups: one group is one measure in
        // one unit, and a shared scale would silently compare rupees to
        // percentages (the caption says which applies).
        const max = Math.max(...group.bars.map((bar) => Math.abs(bar.value)), 1);
        return (
          <div key={group.label ?? "single"} className="space-y-1.5">
            {group.label && <p className="text-xs font-semibold">{group.label}</p>}
            {group.bars.map((bar) => <MagnitudeRow key={`${group.label}-${bar.label}`} bar={bar} max={max} />)}
          </div>
        );
      })}
    </div>
  );
}

export default function IPOSectionInfographic({ chart, title }: { chart: SectionInfographic; title: string }) {
  return (
    <figure className="rounded-lg border border-border bg-muted/20 p-3 md:p-4">
      {chart.kind === "share" ? <ShareChart groups={chart.groups} /> : <MagnitudeChart groups={chart.groups} />}
      <figcaption className="mt-3 text-[11px] leading-snug text-muted-foreground">
        <span className="sr-only">{title}: </span>
        {chart.caption} Figures as published in the table below.
      </figcaption>
    </figure>
  );
}

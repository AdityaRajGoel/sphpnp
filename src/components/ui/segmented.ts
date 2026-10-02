/**
 * One look for the hand-rolled segmented controls (the chart range pickers and
 * the quarterly/annual switch), which had grown three different recipes.
 *
 * Markup: a <div role="group" aria-label> of <button aria-pressed>. A tablist
 * would promise arrow-key roving these controls do not need.
 *
 * The selected segment is solid green: the white pill on the muted track it
 * replaces measured 1.07:1 against the track, under the 3:1 a state needs.
 * The track's 4px padding is also what keeps the focus outline (2px, 2px
 * offset) from being clipped when the track scrolls sideways.
 */
export const segmentTrack = "inline-flex shrink-0 gap-0.5 rounded-md bg-muted p-1";

export const segmentItem = (selected: boolean): string =>
  [
    "shrink-0 rounded-sm px-3 py-2.5 text-xs font-semibold md:py-1.5",
    "transition-[transform,background-color,color] duration-fast ease-out active:scale-[0.97]",
    selected ? "bg-secondary text-secondary-foreground shadow-sm" : "text-muted-foreground hover:bg-background hover:text-foreground",
  ].join(" ");

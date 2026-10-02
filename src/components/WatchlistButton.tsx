import type { MouseEvent } from "react";
import { motion } from "motion/react";
import { Star } from "lucide-react";
import { DURATION, EASE_OUT } from "@/lib/motion";
import { useWatchlist } from "@/hooks/useWatchlist";

// The same press as the Button primitive; the filled star is the feedback, with no decorative burst.
const TAP = { whileTap: { scale: 0.97 }, transition: { duration: DURATION.press, ease: EASE_OUT } } as const;

type Props = { symbol: string; name: string; withLabel?: boolean; className?: string };

/** Star toggle for the watchlist. Safe inside clickable rows: it never lets the click bubble. */
export default function WatchlistButton({ symbol, name, withLabel = false, className = "" }: Props) {
  const { isInWatchlist, addToWatchlist, removeFromWatchlist, isFull } = useWatchlist();
  const on = isInWatchlist(symbol);
  const blocked = !on && isFull;

  const toggle = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (on) removeFromWatchlist(symbol);
    else addToWatchlist(symbol, name);
  };

  return (
    <motion.button
      type="button"
      {...TAP}
      onClick={toggle}
      disabled={blocked}
      aria-pressed={on}
      // One name in both states; aria-pressed says which. A name that flipped to
      // "Remove..." read as "Remove ITC from watchlist, pressed".
      aria-label={blocked ? "Watchlist is full (50 stocks)" : `Watch ${name}`}
      title={blocked ? "Watchlist is full" : on ? "Remove from watchlist" : "Add to watchlist"}
      className={`inline-flex items-center gap-1.5 rounded-md transition-colors hover:text-brand-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${withLabel ? "h-11 border border-border px-2.5 text-xs font-medium hover:border-brand-gold/50 md:h-8" : "p-1.5"} ${on ? "text-brand-gold" : "text-muted-foreground"} ${className}`}
    >
      <Star className={`h-4 w-4 ${on ? "fill-current" : ""}`} aria-hidden="true" />
      {withLabel && <span>Watch</span>}
    </motion.button>
  );
}

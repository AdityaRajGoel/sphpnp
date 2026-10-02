/**
 * The /markets/<slug> mover lists. Each reads one market_snapshots kind written by
 * sync-market-data's "movers" dataset. scripts/lib/market-list-routes.mjs lists the
 * same slugs for the sitemap and prerender (src/test/market-movers.test.ts checks).
 */
export type MoverColumn = "volume" | "value" | "volume_vs_week";

export type MoverListConfig = {
  slug: string;
  kind: string;
  /** Short name for the list switcher. */
  label: string;
  title: string;
  description: string;
  columns: MoverColumn[];
};

export const MOVER_LISTS: MoverListConfig[] = [
  {
    slug: "top-gainers", kind: "gainers", label: "Top gainers", title: "Top gainers on NSE today",
    description: "The 20 NSE stocks with the largest percentage rise today, with price, volume and traded value.",
    columns: ["volume", "value"],
  },
  {
    slug: "top-losers", kind: "losers", label: "Top losers", title: "Top losers on NSE today",
    description: "The 20 NSE stocks with the largest percentage fall today, with price, volume and traded value.",
    columns: ["volume", "value"],
  },
  {
    slug: "most-active", kind: "most_active_value", label: "Most active", title: "Most active stocks on NSE by value",
    description: "The NSE stocks with the highest traded value today, the rupee amount that changed hands.",
    columns: ["volume", "value"],
  },
  {
    slug: "volume-shockers", kind: "volume_gainers", label: "Volume shockers", title: "Volume shockers on NSE today",
    description: "NSE stocks trading far more shares than usual today, measured against their one-week average volume.",
    columns: ["volume", "volume_vs_week", "value"],
  },
  {
    slug: "52-week-high", kind: "week52_high", label: "New 52-week highs", title: "Stocks at a new 52-week high today",
    description: "NSE stocks that traded above their highest price of the past year today.",
    columns: [],
  },
  {
    slug: "52-week-low", kind: "week52_low", label: "New 52-week lows", title: "Stocks at a new 52-week low today",
    description: "NSE stocks that traded below their lowest price of the past year today.",
    columns: [],
  },
  {
    slug: "upper-circuit", kind: "upper_circuit", label: "Upper circuit", title: "Stocks that hit the upper circuit today",
    description: "NSE stocks that touched the top of their daily price band today, where the exchange stops the price rising further.",
    columns: ["volume", "value"],
  },
  {
    slug: "lower-circuit", kind: "lower_circuit", label: "Lower circuit", title: "Stocks that hit the lower circuit today",
    description: "NSE stocks that touched the bottom of their daily price band today, where the exchange stops the price falling further.",
    columns: ["volume", "value"],
  },
];

export const moverList = (slug: string | undefined): MoverListConfig | undefined =>
  MOVER_LISTS.find((list) => list.slug === slug);

/** "28 Sep 2026, 4:00 pm" in IST, whatever the visitor's clock. */
export const istDateTime = (iso: string | null): string | null =>
  iso
    ? new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })
    : null;

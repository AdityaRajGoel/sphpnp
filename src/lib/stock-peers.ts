import { METRIC_BY_ID, type MetricRow } from "@/lib/screener-metrics";

export const PEER_METRICS = ["market_cap", "pe", "pb", "roe", "roce", "opm", "debt_to_equity", "sales_growth_yoy"] as const;

export type PeerSet = {
  sector: string;
  /** Peers by market cap, largest first, always including the stock itself. */
  rows: MetricRow[];
  /** Sector-wide medians over every tracked stock in the sector, not only the rows shown. */
  median: Record<string, number | null>;
  /** Tracked stocks in the sector. */
  size: number;
};

export function median(values: (number | null)[]): number | null {
  const xs = values.filter((v): v is number => v !== null && Number.isFinite(v)).sort((a, b) => a - b);
  if (xs.length === 0) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}

/**
 * The stock's sector peers, screener.in's "Peer comparison" table. The largest
 * `limit` by market cap, with the stock swapped in for the smallest when it
 * would otherwise fall off - a small cap still sees itself beside the leaders.
 */
export function sectorPeers(universe: Map<string, MetricRow> | undefined, symbol: string, limit = 8): PeerSet | null {
  const self = universe?.get(symbol.toUpperCase());
  const sector = self?.quote?.sector;
  if (!universe || !self || !sector || sector === "General") return null;

  const inSector = [...universe.values()]
    .filter((r) => r.quote?.sector === sector)
    .sort((a, b) => (b.quote?.market_cap ?? 0) - (a.quote?.market_cap ?? 0));
  if (inSector.length < 2) return null;

  let rows = inSector.slice(0, limit);
  if (!rows.includes(self)) rows = [...rows.slice(0, limit - 1), self];

  const med: Record<string, number | null> = {};
  for (const id of PEER_METRICS) {
    const metric = METRIC_BY_ID.get(id);
    // Only a positive P/E is a multiple; a loss-maker's zero or negative would drag the median.
    med[id] = metric ? median(inSector.map((r) => metric.get(r)).filter((v) => id !== "pe" || (v !== null && v > 0))) : null;
  }
  return { sector, rows, median: med, size: inSector.length };
}

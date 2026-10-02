import { listSlug } from "@/lib/market-lists";

export type SectorTile = { name: string; slug: string; cap: number; changePct: number; count: number };

type Quote = { sector: string; market_cap: number; change_pct: number };

/** One tile per sector: total market value, and the day's change weighted by it. "General" is no sector. */
export function sectorTiles(stocks: Iterable<Quote>): SectorTile[] {
  const bySector = new Map<string, { cap: number; weighted: number; count: number }>();
  for (const { sector, market_cap, change_pct } of stocks) {
    const name = sector?.trim();
    if (!name || name === "General" || !(market_cap > 0) || !Number.isFinite(change_pct)) continue;
    const acc = bySector.get(name) ?? { cap: 0, weighted: 0, count: 0 };
    bySector.set(name, { cap: acc.cap + market_cap, weighted: acc.weighted + market_cap * change_pct, count: acc.count + 1 });
  }
  return [...bySector]
    .map(([name, v]) => ({ name, slug: listSlug(name), cap: v.cap, changePct: v.weighted / v.cap, count: v.count }))
    .sort((a, b) => b.cap - a.cap);
}

/** Signed colour step: 0 inside ±cuts[0], then 1, 2, 3 from each cut (a day's change by default: 0.25%, 1%, 2%). */
export function heatStep(changePct: number, cuts: readonly [number, number, number] = [0.25, 1, 2]): number {
  const size = Math.abs(changePct);
  const step = size < cuts[0] ? 0 : size < cuts[1] ? 1 : size < cuts[2] ? 2 : 3;
  return step === 0 ? 0 : Math.sign(changePct) * step;
}

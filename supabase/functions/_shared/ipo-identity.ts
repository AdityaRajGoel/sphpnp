// Keeps one stored row per IPO across runs.
//
// reconcileIpos merges the sources within a run, but that alone is not enough:
// the plain cron sees only IPO Watch while the browser run adds Chittorgarh and
// InvestorGain, and each could pick a different slug for the same issue. And
// before names were matched by ipoMatchKey, nine live issues were already
// stored twice. So sync-ipos, before writing, plans two things from what is
// already stored:
//
//   planIpoMerges - which duplicate rows fold into which surviving row, and
//                   which of the survivor's blank fields the duplicate can fill
//   resolveSlug   - which stored slug an incoming issue belongs to, so its URL
//                   and GMP history carry on rather than restarting
//
// Both are pure so the rules are unit tested; sync-ipos does the I/O.

import { ipoMatchKey } from "./ipo-parse.ts";
import { advanceStatus } from "./ipo-status.ts";
import type { IpoStatus } from "./ipo-parse.ts";

/** Columns a duplicate may contribute when the surviving row has none. */
export const FILLABLE = [
  "open_date", "close_date", "allotment_date", "listing_date",
  "price_band_min", "price_band_max", "lot_size", "issue_size_crore",
  "registrar", "rhp_url", "drhp_url",
  "subscription_qib", "subscription_nii", "subscription_retail",
  "listing_price", "listing_gain_pct",
] as const;

export type StoredIpo = {
  id: string;
  slug: string;
  name: string;
  created_at: string;
  status: IpoStatus;
} & { [K in (typeof FILLABLE)[number]]: string | number | null };

export type IpoMerge = {
  fromId: string;
  fromSlug: string;
  intoId: string;
  intoSlug: string;
  /** Fields to set on the surviving row, taken from the duplicate. */
  patch: Record<string, unknown>;
};

/**
 * Two rows can be one issue only if their open dates do not contradict each
 * other. The same name with a different open date is a different offering - a
 * company returning to market - and folding them together would graft one
 * issue's GMP history onto another's.
 */
const compatible = (a: { open_date: string | number | null }, b: { open_date: string | number | null }) =>
  a.open_date === null || b.open_date === null || a.open_date === b.open_date;

const groupByKey = (rows: StoredIpo[]): StoredIpo[][] => {
  const groups = new Map<string, StoredIpo[]>();
  for (const row of rows) {
    const key = ipoMatchKey(row.name) || row.slug;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.values()];
};

/**
 * The first-seen row of each issue survives - it owns the URL that has been
 * public longest and, usually, the longest GMP history - and every later,
 * compatible duplicate folds into it.
 */
export function planIpoMerges(rows: StoredIpo[]): { merges: IpoMerge[]; survivors: StoredIpo[] } {
  const merges: IpoMerge[] = [];
  const survivors: StoredIpo[] = [];

  for (const group of groupByKey(rows)) {
    const ordered = [...group].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.slug.localeCompare(b.slug));
    const keepers: StoredIpo[] = [];
    for (const row of ordered) {
      const keeper = keepers.find((k) => compatible(k, row));
      if (!keeper) {
        // A copy, so filling it in below never touches the caller's rows.
        keepers.push({ ...row });
        continue;
      }
      const patch: Record<string, unknown> = {};
      for (const field of FILLABLE) {
        if (keeper[field] === null && row[field] !== null) patch[field] = row[field];
      }
      const status = advanceStatus(keeper.status, row.status);
      if (status !== keeper.status) patch.status = status;
      merges.push({ fromId: row.id, fromSlug: row.slug, intoId: keeper.id, intoSlug: keeper.slug, patch });
      // Later duplicates in the same group see the filled-in keeper.
      Object.assign(keeper, patch);
    }
    survivors.push(...keepers);
  }
  return { merges, survivors };
}

/**
 * The slug an incoming issue should be written under: an existing row's when
 * one is the same issue, otherwise its own.
 */
export function resolveSlug(
  incoming: { slug: string; name: string; open_date: string | null },
  survivors: StoredIpo[],
): string {
  const key = ipoMatchKey(incoming.name) || incoming.slug;
  const match = survivors.find((row) => (ipoMatchKey(row.name) || row.slug) === key && compatible(row, incoming));
  return match?.slug ?? incoming.slug;
}

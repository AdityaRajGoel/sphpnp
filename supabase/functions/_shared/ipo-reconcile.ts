// Merges the three IPO sources into one catalogue entry per issue.
//
// Why three sources at all: the original tracker read a single site with a
// fixed column order, so when that table's layout drifted every field silently
// read the wrong column and the whole page went wrong at once. Three
// independent parsers make that failure mode visible instead of silent - the
// sources disagree, and the disagreement is recorded rather than averaged away.
//
// Two rules run through everything below:
//
//  1. A null is an absence, never an answer. A higher-precedence source that
//     does not know a field must not blank what a lower one does know.
//  2. Every field records which source it came from (`field_sources`), so the
//     page can attribute a number and a wrong one can be traced to its origin
//     without re-running the scrape.

import type {
  Board,
  ChittorgarhRow,
  CollectedIpo,
  InvestorGainRow,
  IpoStatus,
  IpoWatchGmpRow,
  ReconciledIpo,
  SourceName,
} from "./ipo-parse.ts";
import { canonicalIpoKey, ipoAliases } from "./ipo-parse.ts";

export type SourceBundle = {
  ipowatch: IpoWatchGmpRow[];
  investorgain: InvestorGainRow[];
  chittorgarh: ChittorgarhRow[];
};

/**
 * Which source wins each field, best first.
 *
 * The ordering is not arbitrary and is worth stating:
 *
 * - Issue facts (price band, dates, issue size, lot size, listing date) come
 *   from Chittorgarh first. It transcribes the RHP/prospectus, so its figures
 *   are the ones that match the offer document.
 * - InvestorGain sits second for lot size and issue size, which it publishes
 *   in a structured column while IPO Watch does not carry them at all.
 * - IPO Watch is the fallback for the subscription window because it is the
 *   most promptly updated of the three when dates move.
 * - GMP is deliberately handled outside this table (see `pickGmp`): it is an
 *   unofficial estimate that genuinely differs between sites, so taking the
 *   median of what the sources say is more honest than declaring a winner.
 *
 * Every reconciled field must appear here. A field with no declared order
 * would take whichever source merged last, which is order-dependent and
 * untraceable.
 */
export const FIELD_PRECEDENCE: Record<string, SourceName[]> = {
  price_band_min: ["chittorgarh", "ipowatch"],
  price_band_max: ["chittorgarh", "ipowatch"],
  open_date: ["chittorgarh", "ipowatch"],
  close_date: ["chittorgarh", "ipowatch"],
  listing_date: ["chittorgarh"],
  issue_size_crore: ["chittorgarh", "investorgain"],
  lot_size: ["investorgain"],
  est_listing_price: ["ipowatch"],
  listing_price: ["ipowatch"],
  detail_url: ["chittorgarh"],
};

/** Ranked most to least specific: a real status beats a default guess. */
const STATUS_RANK: Record<IpoStatus, number> = {
  listed: 3,
  closed: 2,
  open: 2,
  upcoming: 1,
};

type Candidate = { source: SourceName; row: Record<string, unknown> };

const usable = (value: unknown): boolean =>
  value !== null && value !== undefined && !(typeof value === "number" && !Number.isFinite(value));

/** First source in precedence order that actually supplied the field. */
function pickField(
  field: string,
  candidates: Candidate[],
): { value: unknown; source: SourceName } | null {
  for (const source of FIELD_PRECEDENCE[field] ?? []) {
    const candidate = candidates.find((c) => c.source === source && usable(c.row[field]));
    if (candidate) return { value: candidate.row[field], source };
  }
  return null;
}

/**
 * GMP is an unofficial grey-market estimate. IPO Watch and InvestorGain
 * routinely quote different numbers for the same issue because they poll
 * different dealers, and neither is authoritative. The median of what is
 * actually reported is more defensible than picking a favourite, and with two
 * sources it is simply their mean - which at least sits between two real
 * observations rather than being one site's number presented as fact.
 */
export function pickGmp(candidates: Candidate[]): { value: number; sources: SourceName[] } | null {
  const seen = candidates
    .filter((c) => typeof c.row.gmp === "number" && Number.isFinite(c.row.gmp as number))
    .map((c) => ({ source: c.source, gmp: c.row.gmp as number }));
  if (seen.length === 0) return null;

  const values = seen.map((s) => s.gmp).sort((a, b) => a - b);
  const middle = Math.floor(values.length / 2);
  const median = values.length % 2 === 0
    ? (values[middle - 1] + values[middle]) / 2
    : values[middle];

  return { value: median, sources: seen.map((s) => s.source) };
}

/** The most informative status any source reported, not the last one merged. */
function pickStatus(candidates: Candidate[]): IpoStatus {
  let best: IpoStatus = "upcoming";
  for (const candidate of candidates) {
    const status = candidate.row.status as IpoStatus | undefined;
    if (status && STATUS_RANK[status] > STATUS_RANK[best]) best = status;
  }
  return best;
}

/** SME is a positive assertion; only a source that says so should set it. */
function pickBoard(candidates: Candidate[]): Board {
  return candidates.some((c) => c.row.board === "sme") ? "sme" : "mainboard";
}

/** The longest name, which is the least aggressively abbreviated one. */
function pickName(candidates: Candidate[]): string {
  return candidates
    .map((c) => String(c.row.name ?? "").trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)[0] ?? "";
}

export type ReconciledWithGmp = ReconciledIpo & {
  gmp: number | null;
  gmp_sources: SourceName[];
};

/**
 * The shortest slug any source produced for an issue - the least decorated
 * name. Only a starting point: sync-ipos swaps in the stored slug when the issue
 * is already on record (see resolveSlug), which is what keeps URLs stable as
 * sources come and go.
 */
const pickSlug = (candidates: Candidate[]): string =>
  candidates
    .map((c) => String(c.row.slug))
    .sort((a, b) => a.length - b.length || a.localeCompare(b))[0];

/**
 * One entry per distinct issue across all three sources.
 *
 * Grouped by ipoMatchKey, not by slug: the sites decorate the same name
 * differently, and grouping on the raw slug split nine live issues into a row
 * with the dates and another with the GMP.
 *
 * An IPO seen by only one source is still returned: a partially known issue is
 * better than a missing one, and `field_sources` makes the thinness visible.
 */
export function reconcileIpos(bundle: SourceBundle): ReconciledWithGmp[] {
  const byKey = new Map<string, Candidate[]>();
  const aliases = ipoAliases(
    [bundle.chittorgarh, bundle.investorgain, bundle.ipowatch].flatMap((rows) => rows.map((row) => {
      const r = row as unknown as Record<string, unknown>;
      return {
        name: String(r.name ?? ""),
        open_date: typeof r.open_date === "string" ? r.open_date : null,
        price_band_max: typeof r.price_band_max === "number" ? r.price_band_max : null,
      };
    })),
  );
  const add = (source: SourceName, rows: Record<string, unknown>[]) => {
    for (const row of rows) {
      const slug = String(row.slug ?? "");
      if (!slug) continue;
      const key = canonicalIpoKey(String(row.name ?? ""), aliases) || slug;
      const existing = byKey.get(key);
      if (existing) existing.push({ source, row });
      else byKey.set(key, [{ source, row }]);
    }
  };

  add("chittorgarh", bundle.chittorgarh as unknown as Record<string, unknown>[]);
  add("investorgain", bundle.investorgain as unknown as Record<string, unknown>[]);
  add("ipowatch", bundle.ipowatch as unknown as Record<string, unknown>[]);

  const merged: ReconciledWithGmp[] = [];
  for (const candidates of byKey.values()) {
    const slug = pickSlug(candidates);
    const field_sources: Partial<Record<string, SourceName>> = {};
    const values: Record<string, unknown> = {};

    for (const field of Object.keys(FIELD_PRECEDENCE)) {
      const picked = pickField(field, candidates);
      if (picked) {
        values[field] = picked.value;
        field_sources[field] = picked.source;
      } else {
        values[field] = null;
      }
    }

    const gmp = pickGmp(candidates);
    const base: CollectedIpo = {
      slug,
      name: pickName(candidates),
      board: pickBoard(candidates),
      status: pickStatus(candidates),
      price_band_min: values.price_band_min as number | null,
      price_band_max: values.price_band_max as number | null,
      open_date: values.open_date as string | null,
      close_date: values.close_date as string | null,
    };

    merged.push({
      ...base,
      listing_date: values.listing_date as string | null,
      issue_size_crore: values.issue_size_crore as number | null,
      lot_size: values.lot_size as number | null,
      est_listing_price: values.est_listing_price as number | null,
      listing_price: values.listing_price as number | null,
      listing_gain_pct: null,
      detail_url: values.detail_url as string | null,
      field_sources,
      gmp: gmp ? gmp.value : null,
      gmp_sources: gmp ? gmp.sources : [],
    });
  }

  return merged;
}

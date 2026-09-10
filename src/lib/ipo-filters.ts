/**
 * Pure filtering/sorting/URL-state logic for the IPO hub.
 *
 * Kept separate from IpoPage.tsx so the rules that decide what a visitor sees
 * (which IPOs match, in what order, and what a shared link restores) can be
 * unit tested without mounting a page. Every predicate here treats a missing
 * figure as "excluded from a band that requires a value", never as zero.
 */

import { gmpPercent, type Ipo } from "@/lib/ipo";

export type StatusFilter = "all" | Ipo["status"];
export type BoardFilter = "all" | Ipo["board"];
export type GmpBandId = "all" | "awaited" | "negative" | "modest" | "strong" | "hot";
export type ListingWindowId = "all" | "past" | "next7" | "next30" | "later";
export type SortKey =
  | "name"
  | "status"
  | "board"
  | "price_band_max"
  | "issue_size_crore"
  | "lot_size"
  | "min_investment"
  | "open_date"
  | "close_date"
  | "listing_date"
  | "gmp"
  | "gmp_pct"
  | "subscription_total";
export type SortDir = "asc" | "desc";

export type IpoFilters = {
  status: StatusFilter;
  board: BoardFilter;
  gmpBand: GmpBandId;
  listingWindow: ListingWindowId;
};

export const DEFAULT_FILTERS: IpoFilters = {
  status: "all",
  board: "all",
  gmpBand: "all",
  listingWindow: "all",
};

/**
 * GMP bands, in rupees. "awaited" is its own band rather than folded into
 * "all" so a visitor can deliberately ask for "issues nobody has quoted yet" -
 * a meaningfully different question from "issues trading at/below par".
 */
export const GMP_BAND_OPTIONS: { id: GmpBandId; label: string; test: (gmp: number | null) => boolean }[] = [
  { id: "all", label: "Any GMP", test: () => true },
  { id: "awaited", label: "Not yet quoted", test: (gmp) => gmp === null },
  { id: "negative", label: "At or below par", test: (gmp) => gmp !== null && gmp <= 0 },
  { id: "modest", label: "₹1–50", test: (gmp) => gmp !== null && gmp > 0 && gmp <= 50 },
  { id: "strong", label: "₹51–150", test: (gmp) => gmp !== null && gmp > 50 && gmp <= 150 },
  { id: "hot", label: "₹150+", test: (gmp) => gmp !== null && gmp > 150 },
];

const DAY_MS = 24 * 60 * 60 * 1000;

/** Listing-date buckets. A null listing_date only ever matches "all". */
export const LISTING_WINDOW_OPTIONS: { id: ListingWindowId; label: string }[] = [
  { id: "all", label: "Any listing date" },
  { id: "past", label: "Already listed" },
  { id: "next7", label: "Next 7 days" },
  { id: "next30", label: "Next 30 days" },
  { id: "later", label: "Beyond 30 days" },
];

export function matchesListingWindow(listingDate: string | null, window: ListingWindowId, now: Date): boolean {
  if (window === "all") return true;
  if (listingDate === null) return false;
  const target = new Date(`${listingDate}T00:00:00Z`).getTime();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).getTime();
  const diffDays = (target - today) / DAY_MS;
  if (window === "past") return diffDays < 0;
  if (window === "next7") return diffDays >= 0 && diffDays <= 7;
  if (window === "next30") return diffDays > 7 && diffDays <= 30;
  return diffDays > 30;
}

/**
 * How long a listed issue stays "recent". The hub and the homepage are a
 * calendar of live issues; the catalogue itself reaches back months, because
 * Chittorgarh publishes the year's whole list.
 */
export const RECENT_LISTING_DAYS = 30;

/**
 * Whether a listed issue listed within RECENT_LISTING_DAYS. The close date
 * stands in when no listing date was recorded, and an issue with neither
 * cannot be shown to be recent, so it is not.
 */
export function isRecentlyListed(ipo: Ipo, now: Date): boolean {
  const anchor = ipo.listing_date ?? ipo.close_date;
  if (anchor === null) return false;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return (today - new Date(`${anchor}T00:00:00Z`).getTime()) / DAY_MS <= RECENT_LISTING_DAYS;
}

export function filterIpos(ipos: Ipo[], filters: IpoFilters, now: Date = new Date()): Ipo[] {
  const gmpTest = GMP_BAND_OPTIONS.find((option) => option.id === filters.gmpBand)?.test ?? (() => true);
  // Asking for listed issues (by status or by listing window) is asking for the
  // archive; only the unfiltered calendar view hides long-listed ones.
  const wantsArchive = filters.status === "listed" || filters.listingWindow !== "all";
  return ipos.filter((ipo) => {
    if (!wantsArchive && ipo.status === "listed" && !isRecentlyListed(ipo, now)) return false;
    if (filters.status !== "all" && ipo.status !== filters.status) return false;
    if (filters.board !== "all" && ipo.board !== filters.board) return false;
    if (!gmpTest(ipo.gmp)) return false;
    if (!matchesListingWindow(ipo.listing_date, filters.listingWindow, now)) return false;
    return true;
  });
}

const STATUS_RANK: Record<Ipo["status"], number> = { open: 0, upcoming: 1, closed: 2, listed: 3 };

/**
 * Within one status, the date a visitor actually cares about, and which way:
 * an open issue by when bidding shuts, an upcoming one by when it opens, a
 * closed one by when it lists - and a listed one newest first, because the
 * listing that happened last week is the news, not the oldest on record.
 */
const LIFECYCLE_DATE: Record<Ipo["status"], { date: (ipo: Ipo) => string | null; newestFirst: boolean }> = {
  open: { date: (ipo) => ipo.close_date, newestFirst: false },
  upcoming: { date: (ipo) => ipo.open_date, newestFirst: false },
  closed: { date: (ipo) => ipo.listing_date ?? ipo.close_date, newestFirst: false },
  listed: { date: (ipo) => ipo.listing_date ?? ipo.close_date, newestFirst: true },
};

/** Lifecycle order with each status's own date as the tiebreak; undated rows last within their status. */
function compareLifecycle(a: Ipo, b: Ipo): number {
  const byStatus = STATUS_RANK[a.status] - STATUS_RANK[b.status];
  if (byStatus !== 0) return byStatus;
  const { date, newestFirst } = LIFECYCLE_DATE[a.status];
  const da = date(a);
  const db = date(b);
  if (da === db) return 0;
  if (da === null) return 1;
  if (db === null) return -1;
  return (da < db ? -1 : 1) * (newestFirst ? -1 : 1);
}

/**
 * Null-safe comparator. Missing values always sort to the end regardless of
 * direction — a "—" is not a low or high value, it is an absence, and it
 * should never masquerade as the smallest or largest row in the table.
 */
export function sortIpos(ipos: Ipo[], key: SortKey, dir: SortDir): Ipo[] {
  const factor = dir === "asc" ? 1 : -1;
  if (key === "status") return [...ipos].sort((a, b) => compareLifecycle(a, b) * factor);
  const withValue = (ipo: Ipo): number | string | null => {
    switch (key) {
      case "name":
        return ipo.name.toLowerCase();
      case "board":
        return ipo.board;
      case "price_band_max":
        return ipo.price_band_max;
      case "issue_size_crore":
        return ipo.issue_size_crore;
      case "lot_size":
        return ipo.lot_size;
      case "min_investment":
        return ipo.min_investment;
      case "open_date":
        return ipo.open_date;
      case "close_date":
        return ipo.close_date;
      case "listing_date":
        return ipo.listing_date;
      case "gmp":
        return ipo.gmp;
      case "gmp_pct":
        return gmpPercent(ipo);
      case "subscription_total":
        return ipo.subscription_total;
      default:
        return null;
    }
  };

  return [...ipos].sort((a, b) => {
    const va = withValue(a);
    const vb = withValue(b);
    if (va === null && vb === null) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    if (va < vb) return -1 * factor;
    if (va > vb) return 1 * factor;
    return 0;
  });
}

// --- URL persistence -------------------------------------------------------

export function ipoFiltersFromSearchParams(params: URLSearchParams): IpoFilters {
  const status = params.get("status");
  const board = params.get("board");
  const gmpBand = params.get("gmp");
  const listingWindow = params.get("listing");
  return {
    status: isStatus(status) ? status : "all",
    board: isBoard(board) ? board : "all",
    gmpBand: GMP_BAND_OPTIONS.some((o) => o.id === gmpBand) ? (gmpBand as GmpBandId) : "all",
    listingWindow: LISTING_WINDOW_OPTIONS.some((o) => o.id === listingWindow) ? (listingWindow as ListingWindowId) : "all",
  };
}

function isStatus(value: string | null): value is Ipo["status"] {
  return value === "upcoming" || value === "open" || value === "closed" || value === "listed";
}
function isBoard(value: string | null): value is Ipo["board"] {
  return value === "mainboard" || value === "sme";
}

export function ipoFiltersToSearchParams(filters: IpoFilters, base: URLSearchParams = new URLSearchParams()): URLSearchParams {
  const params = new URLSearchParams(base);
  const set = (key: string, value: string, defaultValue: string) => {
    if (value === defaultValue) params.delete(key);
    else params.set(key, value);
  };
  set("status", filters.status, "all");
  set("board", filters.board, "all");
  set("gmp", filters.gmpBand, "all");
  set("listing", filters.listingWindow, "all");
  return params;
}

// --- Comparison selection ---------------------------------------------------

export const MAX_COMPARE = 4;

export function toggleCompareSlug(current: string[], slug: string, max: number = MAX_COMPARE): string[] {
  if (current.includes(slug)) return current.filter((s) => s !== slug);
  if (current.length >= max) return current;
  return [...current, slug];
}

export function parseCompareSlugs(param: string | null): string[] {
  if (!param) return [];
  return [...new Set(param.split(",").map((s) => s.trim()).filter(Boolean))].slice(0, MAX_COMPARE);
}

export function compareSlugsToParam(slugs: string[]): string | undefined {
  return slugs.length > 0 ? slugs.join(",") : undefined;
}

// --- Homepage tracker --------------------------------------------------------

/**
 * One tab of the homepage tracker: that status's issues in lifecycle order,
 * with "Recently Listed" held to RECENT_LISTING_DAYS so it means what it says.
 */
export function trackerTab<T extends Ipo>(ipos: T[], tab: Ipo["status"], now: Date = new Date()): T[] {
  return ipos
    .filter((ipo) => ipo.status === tab && (tab !== "listed" || isRecentlyListed(ipo, now)))
    .sort(compareLifecycle);
}

/**
 * True while scripts/prerender.js is capturing the page for static HTML.
 *
 * The capture only needs the page's indexable content. The interactive panels -
 * price charts, universe-wide peer and checklist math, legal filings, live
 * quotes - each issue their own database queries, and across ~400 routes that
 * load exhausted the database (statement timeouts, 5xx) and pushed the build
 * past Vercel's 45-minute limit. Live figures would also be stale the moment
 * they were baked into HTML. The app mounts with createRoot, not hydration, so
 * a visitor's browser renders every panel fresh regardless.
 */
export function isPrerender(): boolean {
  return typeof window !== "undefined" && (window as Window & { __PRERENDER__?: boolean }).__PRERENDER__ === true;
}

/**
 * The app mounts with createRoot, which throws the prerendered HTML away and
 * starts from each page's loading state. On a phone the stock page's short
 * skeleton let the footer into view, and the data then pushed it back out: one
 * layout shift of 0.78 on every stock page (0.1 is "good"). Measuring the
 * static content before React replaces it lets the loading state hold the same
 * height, so nothing below it moves when the data lands.
 */
const prerenderedHeights = new Map<string, number>();

/** Call once, before createRoot. Keyed by path: only the first page load has static HTML. */
export function rememberPrerenderedHeight(selector: string): void {
  const el = document.querySelector<HTMLElement>(selector);
  if (el && el.offsetHeight > 0) prerenderedHeights.set(window.location.pathname, el.offsetHeight);
}

export function prerenderedHeight(pathname: string): number | undefined {
  return prerenderedHeights.get(pathname);
}

/** The page's query data, written into the static HTML by scripts/prerender.js. */
export const PRERENDER_STATE_ID = "rq-state";
const MAX_QUERY_CHARS = 150_000;
const MAX_TOTAL_CHARS = 400_000;

/** True when a value survives JSON unchanged: no Map, Set, Date or class instance in it. */
export function isPlainJson(value: unknown, depth = 0): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object" || depth > 12) return false;
  if (Array.isArray(value)) return value.every((v) => isPlainJson(v, depth + 1));
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return false;
  return Object.values(value as Record<string, unknown>).every((v) => v === undefined || isPlainJson(v, depth + 1));
}

type Dehydrated = { mutations: unknown[]; queries: { queryHash: string; state: { data?: unknown; status: string } }[] };

/**
 * The queries worth shipping in the page: successful, JSON-safe, and small
 * enough. A page's own data comes first; the biggest are dropped until the
 * total fits, so one universe-wide list cannot double the HTML.
 */
export function pickDehydrated<T extends Dehydrated>(state: T): T {
  const sized = state.queries
    .filter((q) => q.state.status === "success" && q.state.data !== undefined && isPlainJson(q.state.data))
    .map((q) => ({ q, chars: JSON.stringify(q).length }))
    .filter(({ chars }) => chars <= MAX_QUERY_CHARS)
    .sort((a, b) => a.chars - b.chars);
  const kept: T["queries"] = [];
  let total = 0;
  for (const { q, chars } of sized) {
    if (total + chars > MAX_TOTAL_CHARS) break;
    kept.push(q);
    total += chars;
  }
  return { ...state, mutations: [], queries: kept };
}

/** The shipped query data, or null on a page that was not prerendered. */
export function readPrerenderedState(): unknown {
  const el = typeof document === "undefined" ? null : document.getElementById(PRERENDER_STATE_ID);
  if (!el?.textContent) return null;
  try {
    return JSON.parse(el.textContent);
  } catch {
    return null;
  }
}

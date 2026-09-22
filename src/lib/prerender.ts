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

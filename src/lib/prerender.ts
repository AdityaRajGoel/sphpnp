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

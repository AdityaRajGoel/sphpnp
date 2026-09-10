// Daily-report cache rules for ai-stock-analysis.
//
// Requirement: one AI report per symbol per Indian trading day is generated,
// stored, and served to every viewer for the rest of that day - no TTL, no
// price-drift recompute. Regenerate only once there is no report for
// "today", where "today" means the Asia/Kolkata (IST, UTC+5:30) calendar
// date, not UTC and not the server's local timezone.
//
// Extracted as pure functions (matching the house pattern used by
// screener-row.ts, ipo-parse.ts, period.ts, ratios.ts) because the edge
// function itself calls Deno.serve() at module scope and cannot be imported
// by vitest.

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // UTC+5:30. India has no DST.

/**
 * The Asia/Kolkata calendar date (YYYY-MM-DD) for a given instant.
 *
 * Computed explicitly by shifting the UTC timestamp by the fixed +5:30
 * offset rather than relying on the server's local timezone (Deno Deploy
 * runs UTC, but making this explicit is what makes the function testable
 * and correct regardless of where it runs).
 *
 * This matters at the boundary: a UTC day rolls over at 05:30 IST, in the
 * middle of the Indian pre-market. A report generated at, say, 23:45 UTC
 * (05:15 IST the next calendar day) must be treated as belonging to that
 * next IST trading day, not to the UTC date it was technically written
 * under - otherwise "today's report" would flip mid-morning IST instead of
 * at IST midnight.
 */
export function istDateKey(instant: Date | number | string): string {
  const ms = instant instanceof Date ? instant.getTime() : new Date(instant).getTime();
  const shifted = new Date(ms + IST_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Whether two instants fall on the same Asia/Kolkata calendar date. */
export function isSameIstTradingDay(
  a: Date | number | string,
  b: Date | number | string,
): boolean {
  return istDateKey(a) === istDateKey(b);
}

/**
 * Decide whether an existing cached report row should be served as-is.
 *
 * - Chat mode (`isChat`) is a live conversation, not a report: it must never
 *   be served from this cache no matter how fresh the row is, so it
 *   short-circuits before anything else is checked.
 * - No cached row (`cachedCreatedAt` missing) -> nothing to serve.
 * - Otherwise: serve if and only if the cached row's `created_at` falls on
 *   the same IST trading day as `now`. Deliberately no price-drift check -
 *   the old TTL+drift design invalidated a fresh cache row once the live
 *   price moved >2% from the cached price, which directly contradicts "one
 *   report per day": a daily report must not silently regenerate mid-session
 *   just because price moved.
 */
export function shouldServeCachedReport(params: {
  isChat: boolean;
  cachedCreatedAt: string | number | Date | null | undefined;
  now?: Date | number | string;
}): boolean {
  if (params.isChat) return false;
  if (params.cachedCreatedAt === null || params.cachedCreatedAt === undefined) return false;
  return isSameIstTradingDay(params.cachedCreatedAt, params.now ?? Date.now());
}

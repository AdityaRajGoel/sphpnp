// Validates the JSON payload the browser-rendering GitHub Actions runner posts
// to sync-ipos.
//
// InvestorGain and Chittorgarh both inject their rows with client-side
// JavaScript (see the module comment in sync-ipos/index.ts for the measured
// proof), so a Deno edge function can never render them itself. The runner
// renders each page in a real headless browser and runs the exact same
// parsers this repo already tests (parseInvestorGain / parseChittorgarh in
// ipo-parse.ts) against the resulting HTML, then POSTs the parsed rows here as
// plain JSON - not the raw HTML, which would just make sync-ipos re-implement
// parsing it already owns.
//
// That JSON still crossed a process boundary and a network hop it does not
// control, so it is validated exactly like any other external input: a
// malformed or truncated payload must degrade to zero usable rows for that
// source, never raise an exception that skips the sources that did parse
// cleanly, and never smuggle a bad value into the `ipos` catalogue table.
// Kept here rather than inline in sync-ipos/index.ts for the same reason
// ipo-parse.ts and ipo-reconcile.ts are split out: that file calls
// Deno.serve() at module scope and cannot be imported by the Node test
// runner, and this validation is pure logic worth testing directly.

import type { Board, ChittorgarhRow, InvestorGainRow, IpoStatus } from "./ipo-parse.ts";
import { CHITTORGARH_ISSUE_URL } from "./ipo-parse.ts";

const BOARDS: readonly Board[] = ["mainboard", "sme"];
const STATUSES: readonly IpoStatus[] = ["upcoming", "open", "closed", "listed"];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const numberOrNull = (value: unknown): number | null => (isFiniteNumber(value) ? value : null);

/** An ISO date string, or null - never a malformed string passed through to Postgres. */
const isoDateOrNull = (value: unknown): string | null =>
  typeof value === "string" && ISO_DATE.test(value) ? value : null;

const isBoard = (value: unknown): value is Board => BOARDS.includes(value as Board);
const isStatus = (value: unknown): value is IpoStatus => STATUSES.includes(value as IpoStatus);

/**
 * Keeps only well-formed InvestorGain rows from a POSTed payload.
 *
 * A row missing its identity (slug/name) or carrying a board/status outside
 * the known set is dropped rather than coerced - guessing "mainboard" for an
 * unrecognised board string would misfile an SME issue exactly the way the
 * fixed-column-order bug once did (see ipo-parse.ts's IpoWatchGmpRow comment).
 */
export function sanitizeInvestorGainRows(input: unknown): InvestorGainRow[] {
  if (!Array.isArray(input)) return [];
  const rows: InvestorGainRow[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (typeof row.slug !== "string" || !row.slug) continue;
    if (typeof row.name !== "string" || !row.name) continue;
    if (!isBoard(row.board) || !isStatus(row.status)) continue;

    rows.push({
      slug: row.slug,
      name: row.name,
      board: row.board,
      status: row.status,
      gmp: numberOrNull(row.gmp),
      lot_size: numberOrNull(row.lot_size),
      issue_size_crore: numberOrNull(row.issue_size_crore),
    });
  }
  return rows;
}

/**
 * Keeps only well-formed Chittorgarh rows from a POSTed payload.
 *
 * Unlike InvestorGain, a bad individual field here (say, an unparseable date)
 * degrades that one field to null instead of dropping the row - Chittorgarh
 * is the primary source for issue facts (FIELD_PRECEDENCE in
 * ipo-reconcile.ts), so a single stray field should not cost the whole row
 * when the identity and board are fine.
 */
export function sanitizeChittorgarhRows(input: unknown): ChittorgarhRow[] {
  if (!Array.isArray(input)) return [];
  const rows: ChittorgarhRow[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (typeof row.slug !== "string" || !row.slug) continue;
    if (typeof row.name !== "string" || !row.name) continue;
    if (!isBoard(row.board)) continue;

    rows.push({
      slug: row.slug,
      name: row.name,
      board: row.board,
      price_band_min: numberOrNull(row.price_band_min),
      price_band_max: numberOrNull(row.price_band_max),
      open_date: isoDateOrNull(row.open_date),
      close_date: isoDateOrNull(row.close_date),
      listing_date: isoDateOrNull(row.listing_date),
      issue_size_crore: numberOrNull(row.issue_size_crore),
      // A URL is followed later by sync-ipo-details, so only Chittorgarh's own
      // issue pages are accepted - never an arbitrary link from the payload.
      detail_url: typeof row.detail_url === "string" && CHITTORGARH_ISSUE_URL.test(row.detail_url) ? row.detail_url : null,
    });
  }
  return rows;
}

// An IPO's status, decided by its calendar first and a source's label second.
//
// The dates are the facts: an issue opens on open_date, stops taking bids after
// close_date and lists on listing_date. A status LABEL is only what one website
// last printed next to the name, and the sources are uneven about it:
// Chittorgarh carries the year's whole catalogue with dates but no label, and
// IPO Watch and InvestorGain drop an issue once it lists. Reconciling labels
// alone therefore left every Chittorgarh-only issue on the default "upcoming"
// forever - 70 of 113 stored IPOs, some closed since April.
//
// Imported by sync-ipos (so the stored status is right) and by fetch-ipos (so
// it stays right between syncs - an issue that closes on a Sunday must not read
// "open" until Monday's run).

import type { IpoStatus } from "./ipo-parse.ts";

/** Lifecycle order. An issue only ever moves forward through these. */
const LIFECYCLE: Record<IpoStatus, number> = { upcoming: 0, open: 1, closed: 2, listed: 3 };

/**
 * Days after close_date past which an issue with no recorded listing date is
 * taken as listed. SEBI's T+3 timeline lists an issue three working days after
 * it closes; seven calendar days covers a weekend plus a holiday. Beyond that a
 * missing listing date means the source never recorded one, not that the issue
 * is still waiting to list.
 */
const LISTED_AFTER_CLOSE_DAYS = 7;

export type IpoDates = {
  open_date: string | null;
  close_date: string | null;
  listing_date: string | null;
};

/** The later of two statuses in the lifecycle. */
export function advanceStatus(a: IpoStatus, b: IpoStatus): IpoStatus {
  return LIFECYCLE[a] >= LIFECYCLE[b] ? a : b;
}

/** Today's date in India as YYYY-MM-DD - the calendar IPO dates are written in. */
export function istDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);
}

const addDays = (isoDate: string, days: number): string => {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** What the calendar alone says, or null when there are no dates to go on. */
function statusFromDates(ipo: IpoDates, today: string): IpoStatus | null {
  if (ipo.listing_date && ipo.listing_date <= today) return "listed";
  if (ipo.close_date && ipo.close_date < today) {
    return addDays(ipo.close_date, LISTED_AFTER_CLOSE_DAYS) < today ? "listed" : "closed";
  }
  if (ipo.open_date && ipo.open_date <= today) return "open";
  if (ipo.open_date) return "upcoming";
  return null;
}

/**
 * The status to show for an issue today.
 *
 * Dates decide, and a label may only move the answer FORWARD: a GMP site that
 * already reports an issue listed is believed even before a listing date is
 * published, but a stale "open" can never pull a listed issue back. With no
 * dates at all the label is all there is.
 *
 * `today` is an ISO date in IST; ISO dates compare correctly as strings.
 */
export function deriveIpoStatus(ipo: IpoDates, label: IpoStatus, today: string): IpoStatus {
  const fromDates = statusFromDates(ipo, today);
  return fromDates === null ? label : advanceStatus(fromDates, label);
}

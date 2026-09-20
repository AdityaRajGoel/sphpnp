/**
 * Trimming the IPO list response.
 *
 * `details` (the issue page's own sections) and `news` are read only by the
 * detail page, which asks for one slug. Sent for every issue they made the list
 * response 1.8 MB for 119 IPOs - 730 KB even gzipped - and the VPS health check
 * timed out fetching it from GitHub's runners.
 */
export const LIST_OMITTED_FIELDS = ["details", "news"] as const;

/** A row as the list needs it; a single-slug response keeps every field. */
export function forListing<T extends Record<string, unknown>>(ipo: T, single = false): Partial<T> {
  if (single) return ipo;
  const trimmed = { ...ipo };
  for (const field of LIST_OMITTED_FIELDS) delete trimmed[field];
  return trimmed;
}

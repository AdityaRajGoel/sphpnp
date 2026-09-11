// Walking the tracked universe a batch at a time across invocations, resuming
// after the last symbol done (stored in sync_cursors). `wrapped` tells the
// workflow that the pass is complete, so it can stop calling.
//
// Pure: no I/O.

export type Batch = { batch: string[]; wrapped: boolean };

/**
 * The next `size` symbols after `cursor` in `symbols` (sorted). A cursor no
 * longer in the universe resumes from the first symbol after where it would
 * have sorted, so a delisting costs nothing and never restarts the pass.
 */
export function nextBatch(symbols: string[], cursor: string | null, size: number): Batch {
  if (symbols.length === 0 || size <= 0) return { batch: [], wrapped: true };
  const start = cursor === null ? 0 : symbols.findIndex((s) => s > cursor);
  if (start === -1) return { batch: [], wrapped: true };
  const batch = symbols.slice(start, start + size);
  return { batch, wrapped: start + batch.length >= symbols.length };
}

/**
 * The cursor to store after a batch: its last symbol done, null to start the
 * next pass from the top, or the previous cursor when nothing was done (a run
 * stopped by a rate limit must not restart the pass).
 */
export const cursorAfter = (previous: string | null, batch: string[], done: number, wrapped: boolean): string | null =>
  done <= 0 ? previous : wrapped && done >= batch.length ? null : batch[done - 1];

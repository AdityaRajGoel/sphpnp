/**
 * Bounded retry for a single database write.
 *
 * Written after a sync-macro run failed the build for one upsert out of six:
 * 132 macro_indicators rows and all 3 fx_rates rows landed, the same three
 * indicators had written all 197 rows cleanly the two days either side, and no
 * other sync job failed in the same window. That is a transient blip on the
 * write path - the connection, the pooler, a statement timeout - not a schema
 * or data fault, and it should not cost a red build when a second attempt a
 * moment later would have succeeded.
 *
 * Deliberately NOT a queue and NOT unbounded, matching submit-lead's
 * insertLeadWithRetry: try, wait, try again, then report honestly. A write
 * that is still failing after the last attempt is a real fault and must stay
 * visible - the retry exists to absorb blips, never to hide a broken table.
 *
 * No Supabase or Deno APIs here (the caller passes a closure, and `sleep` is
 * injectable) so Vitest can import and exercise this directly.
 */

export const WRITE_MAX_ATTEMPTS = 3;
export const WRITE_RETRY_DELAY_MS = 400;

export type WriteResult = { error: { message: string } | null };

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Runs `write` until it reports no error or the attempts run out.
 *
 * Takes a factory rather than a promise because a postgrest-js query builder
 * is a one-shot thenable - awaiting the same builder twice does not re-issue
 * the request, so retrying needs a fresh one each attempt.
 *
 * Returns null on success, or the LAST attempt's error message on failure -
 * the message is what the caller records, since a bare failure count is
 * exactly what left this incident undiagnosable the first time.
 */
export async function upsertWithRetry(
  write: () => PromiseLike<WriteResult>,
  label: string,
  options: { attempts?: number; delayMs?: number; sleep?: (ms: number) => Promise<void> } = {},
): Promise<string | null> {
  const attempts = options.attempts ?? WRITE_MAX_ATTEMPTS;
  const delayMs = options.delayMs ?? WRITE_RETRY_DELAY_MS;
  const sleep = options.sleep ?? defaultSleep;

  let lastMessage = "unknown write failure";

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const { error } = await write();
      if (!error) return null;
      lastMessage = error.message;
    } catch (err) {
      // postgrest-js resolves with an error rather than throwing, so reaching
      // here means the transport itself died (a dropped connection, a fetch
      // abort) - the most transient class of all, and the one most worth a
      // second attempt.
      lastMessage = (err as Error).message;
    }

    console.error(`${label} write failed (attempt ${attempt}/${attempts}): ${lastMessage}`);
    if (attempt < attempts) await sleep(delayMs);
  }

  return lastMessage;
}

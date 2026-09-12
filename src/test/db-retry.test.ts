import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { upsertWithRetry, WRITE_MAX_ATTEMPTS } from "../../supabase/functions/_shared/db-retry";

// The helper exists because one transient upsert failure failed a sync-macro
// run that had already written 135 of 200 rows (sync_observations run 997,
// 2026-09-12). These tests pin the three behaviors that incident asked for:
// a blip is absorbed, a persistent fault still surfaces, and the message the
// caller records is the real one rather than a bare count.

const ok = { error: null };
const fail = (message: string) => ({ error: { message } });

describe("upsertWithRetry", () => {
  // Injected so the retry delay costs no wall-clock time in the suite; the
  // real sleep is exercised only in production.
  const sleep = () => Promise.resolve();

  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null and writes once when the first attempt succeeds", async () => {
    const write = vi.fn().mockResolvedValue(ok);

    const result = await upsertWithRetry(write, "macro_indicators/TEST", { sleep });

    expect(result).toBeNull();
    expect(write).toHaveBeenCalledTimes(1);
  });

  it("absorbs a transient failure and succeeds on a later attempt", async () => {
    const write = vi
      .fn()
      .mockResolvedValueOnce(fail("canceling statement due to statement timeout"))
      .mockResolvedValueOnce(ok);

    const result = await upsertWithRetry(write, "macro_indicators/TEST", { sleep });

    expect(result).toBeNull();
    expect(write).toHaveBeenCalledTimes(2);
  });

  it("returns the last error message after exhausting every attempt", async () => {
    const write = vi.fn().mockResolvedValue(fail("duplicate key value violates unique constraint"));

    const result = await upsertWithRetry(write, "fx_rates/USD/INR", { sleep });

    // The message, not a boolean: a persistent fault has to stay diagnosable
    // from the observation row alone.
    expect(result).toBe("duplicate key value violates unique constraint");
    expect(write).toHaveBeenCalledTimes(WRITE_MAX_ATTEMPTS);
  });

  it("treats a thrown transport error as a retryable failure", async () => {
    // postgrest-js resolves with an error rather than throwing, so a throw
    // means the transport itself died - the most transient class of all.
    const write = vi.fn().mockRejectedValueOnce(new Error("fetch failed")).mockResolvedValueOnce(ok);

    const result = await upsertWithRetry(write, "macro_indicators/TEST", { sleep });

    expect(result).toBeNull();
    expect(write).toHaveBeenCalledTimes(2);
  });

  it("calls a fresh builder each attempt rather than re-awaiting one", async () => {
    // A postgrest-js builder is a one-shot thenable: awaiting the same object
    // twice does not re-issue the request. The factory signature is what makes
    // the retry actually retry, so it is asserted rather than assumed.
    const builders: unknown[] = [];
    const write = vi.fn().mockImplementation(() => {
      const builder = Promise.resolve(builders.length === 0 ? fail("connection reset") : ok);
      builders.push(builder);
      return builder;
    });

    await upsertWithRetry(write, "macro_indicators/TEST", { sleep });

    expect(builders).toHaveLength(2);
    expect(builders[0]).not.toBe(builders[1]);
  });
});

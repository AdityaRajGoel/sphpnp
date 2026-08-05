/**
 * Whether a source's failure was transient or structural, and what HTTP status a
 * run carrying those failures should return.
 *
 * This exists because the previous rule - any entry in `failures` returns 500 -
 * turned a one-off dealer timeout red in exactly the same way as a dealer whose
 * markup changed. A red build for every network blip trains people to ignore red
 * builds, which costs us the one signal that matters. The two failures are
 * genuinely different facts about a run:
 *
 *   structural  our parser or the URL is now wrong. Nobody notices this on their
 *               own: the last-good rows stay in the table and age out on screen
 *               while the comparison block quietly freezes. Must stay red.
 *   transient   the dealer's server or the network was briefly unreachable, and
 *               it has already been retried once inside getHtml. Tomorrow's run
 *               will very likely succeed. Worth seeing, not worth blocking on.
 *
 * The distinction only pays off if it is right, so this module is kept free of
 * Deno globals and npm: imports and lives in _shared, where the vitest suite can
 * import it directly. The edge function around it cannot be run locally at all -
 * an untested status rule is how the previous one stayed wrong for so long.
 */

export type FailureKind = "transient" | "structural";

/**
 * One source's failure, with the kind decided at the throw site rather than
 * re-derived later by matching on message text. Source and message are kept
 * apart so the pure summary owns the wire format.
 */
export interface SourceFailure {
  source: string;
  message: string;
  kind: FailureKind;
}

/**
 * An error that knows whether it was transient. Only the throw site can tell:
 * "fetch never returned" and "the server returned 404" are indistinguishable by
 * the time they are a string, and guessing from message text is how this sort of
 * classification rots.
 */
export class SourceError extends Error {
  readonly kind: FailureKind;

  constructor(kind: FailureKind, message: string) {
    super(message);
    this.name = "SourceError";
    this.kind = kind;
  }
}

/**
 * 5xx means the dealer's server answered badly and may answer well next time.
 * 4xx is not retried and not forgiven: a 404 or 403 means the URL or our access
 * changed, which is precisely a structural break. 429 is deliberately structural
 * too - being rate-limited is a standing fact about how we are calling the
 * source, and quietly staying green would let us keep doing it.
 */
export function classifyHttpStatus(status: number): FailureKind {
  // 429 is the one 4xx that says nothing about whether our URL or parser is
  // still right - HTTP defines it as retryable and it normally carries
  // Retry-After. Grouping it with 404/403 would turn every rate-limited day
  // into a red build, which is the cry-wolf failure this classification exists
  // to prevent. A permanent 429 is still not hidden: it warns on every run, and
  // if it is why nothing was written the upserted-zero rule reds the run.
  if (status === 429) return "transient";
  return status >= 500 ? "transient" : "structural";
}

/**
 * Anything that did not arrive as a SourceError is structural. Failing closed is
 * the right default here: an unclassified throw is far more often a bug in our
 * own parsing - a TypeError walking a changed shape, a JSON.parse on markup that
 * is no longer JSON - than a network blip, and those are exactly the failures
 * that must not be downgraded to a warning.
 */
export function classifyFailure(err: unknown): FailureKind {
  return err instanceof SourceError ? err.kind : "structural";
}

/** Never let a non-Error throw surface as "undefined" in the run body. */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export interface RunSummary {
  status: number;
  body: {
    upserted: number;
    /** Structural failures only - the ones that must fail the run. */
    failures: string[];
    /** Transient failures, present only when there are any. */
    warnings?: string[];
  };
}

/**
 * The three-way rule:
 *
 *   any structural failure            -> 500. The whole point of the policy.
 *   transient only, and rows written  -> 200 with warnings. Something was
 *                                        briefly unreachable and has already
 *                                        been retried; the run still did its job.
 *   nothing written at all            -> 500 whatever the cause, because the run
 *                                        achieved nothing and a human should look.
 *
 * Transient failures are reported under `warnings` in every case, including the
 * 500s - a failure that shaped the outcome is never dropped from the body.
 * `warnings` is omitted rather than sent empty so that a clean run's body stays
 * byte-for-byte what it always was, and the key's mere presence is a signal the
 * workflow can annotate on.
 */
export function summarizeRun(upserted: number, failures: SourceFailure[]): RunSummary {
  const format = (f: SourceFailure) => `${f.source}: ${f.message}`;
  const structural = failures.filter((f) => f.kind === "structural").map(format);
  const transient = failures.filter((f) => f.kind === "transient").map(format);

  const status = structural.length > 0 || upserted === 0 ? 500 : 200;

  return {
    status,
    body: {
      upserted,
      failures: structural,
      ...(transient.length > 0 ? { warnings: transient } : {}),
    },
  };
}

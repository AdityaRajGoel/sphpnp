/**
 * Runs AI providers in order until one answers, inside one shared deadline.
 *
 * Each step gets the smaller of its own cap and what is left of the deadline,
 * and a step is skipped once too little is left to produce an answer. Fixed
 * per-provider timeouts used to stack: two free OpenRouter models timed out at
 * 22s each before Groq answered every report, and reports took ~53s (Oct 2026).
 */
export type CascadeStep<T> = { name: string; maxMs: number; run: () => Promise<T> };

export type CascadeOptions = {
  startedAt: number;
  deadlineMs: number;
  /** A step is not started with less than this left. */
  minStepMs: number;
  now?: () => number;
  log?: (line: string) => void;
};

/** Edge functions stop at 60s; this leaves room for the reconcile and cache write after a hit. */
export const AI_DEADLINE_MS = 52_000;
export const AI_MIN_STEP_MS = 5_000;

const withTimeout = <T>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

export async function runCascade<T>(steps: CascadeStep<T>[], opts: CascadeOptions): Promise<{ result: T | null; served: string | null; errors: string[] }> {
  const now = opts.now ?? Date.now;
  const log = opts.log ?? (() => {});
  const errors: string[] = [];
  for (const step of steps) {
    const left = opts.deadlineMs - (now() - opts.startedAt);
    if (left < opts.minStepMs) {
      errors.push(`${step.name}: skipped, ${Math.round(left / 1000)}s left`);
      log(`Skipping ${step.name}: ${Math.round(left / 1000)}s of the deadline left`);
      continue;
    }
    const budget = Math.min(step.maxMs, left);
    try {
      log(`→ ${step.name} (${Math.round(budget / 1000)}s)...`);
      const result = await withTimeout(step.run(), budget, step.name);
      return { result, served: step.name, errors };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log(`✗ ${step.name}: ${msg.slice(0, 160)}`);
      errors.push(`${step.name}: ${msg.slice(0, 120)}`);
    }
  }
  return { result: null, served: null, errors };
}

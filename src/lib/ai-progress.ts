/**
 * The AI report's loading bar, driven by elapsed time rather than a step timer.
 *
 * The old bar stepped every 550ms and sat at 100% for most of a 20-50s wait.
 * This one eases toward CEILING (half way at ~8s, ~90% by ~30s) and only
 * reaches 100 when the report has actually arrived.
 */
const CEILING = 95;
const TIME_CONSTANT_MS = 12_000;

export function analysisProgress(elapsedMs: number, ready: boolean): number {
  if (ready) return 100;
  return CEILING * (1 - Math.exp(-Math.max(0, elapsedMs) / TIME_CONSTANT_MS));
}

/** The step the bar has reached; the last step stays active until the report is in. */
export function progressStep(progress: number, stepCount: number, ready: boolean): number {
  if (ready) return stepCount;
  return Math.min(stepCount - 1, Math.floor((progress / CEILING) * stepCount));
}

/** Past this the loader says it is trying another model rather than looking stuck. */
export const SLOW_ANALYSIS_MS = 20_000;

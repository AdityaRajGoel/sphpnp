import { useEffect, useState } from "react";
import { getScoreSummaries, type ScoreSummary } from "@/lib/screener-scores";

/** Every stock's composite scores and cash-flow ratios, keyed by symbol. Empty until loaded or on failure. */
export function useScoreSummaries() {
  const [summaries, setSummaries] = useState<Map<string, ScoreSummary>>(new Map());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getScoreSummaries()
      .then((map) => { if (!cancelled) setSummaries(map); })
      .catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : "Could not load scores"); });
    return () => { cancelled = true; };
  }, []);

  return { summaries, error };
}

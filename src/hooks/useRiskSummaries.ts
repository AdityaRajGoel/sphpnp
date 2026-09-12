import { useEffect, useState } from "react";
import { getRiskSummaries, type RiskSummary } from "@/lib/screener-risk";

/** Every stock's computed risk and trend measures, keyed by symbol. Empty until loaded or on failure. */
export function useRiskSummaries() {
  const [summaries, setSummaries] = useState<Map<string, RiskSummary>>(new Map());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getRiskSummaries()
      .then((map) => { if (!cancelled) setSummaries(map); })
      .catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : "Could not load risk measures"); });
    return () => { cancelled = true; };
  }, []);

  return { summaries, error };
}

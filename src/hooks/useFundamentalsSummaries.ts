import { useEffect, useState } from "react";
import { getFundamentalsSummaries, type FundamentalsSummary } from "@/lib/screener-fundamentals";

/** Every stock's screener fundamentals, keyed by symbol. Empty until loaded or on failure. */
export function useFundamentalsSummaries() {
  const [summaries, setSummaries] = useState<Map<string, FundamentalsSummary>>(new Map());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getFundamentalsSummaries()
      .then((map) => { if (!cancelled) setSummaries(map); })
      .catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : "Could not load fundamentals"); });
    return () => { cancelled = true; };
  }, []);

  return { summaries, error };
}

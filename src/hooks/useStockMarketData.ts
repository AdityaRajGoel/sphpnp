import { useQuery } from "@tanstack/react-query";
import { istToday, loadStockMarketData } from "@/lib/market-data";

/** One cached read of a stock's market data, shared by every panel that shows part of it. */
export function useStockMarketData(symbol: string | undefined) {
  return useQuery({
    queryKey: ["stock-market", symbol?.toUpperCase()],
    queryFn: () => loadStockMarketData(symbol!.toUpperCase(), istToday()),
    enabled: !!symbol,
    staleTime: 10 * 60_000,
  });
}

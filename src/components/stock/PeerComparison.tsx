import { useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { revealSection } from "@/lib/motion";
import { useScreenerUniverse } from "@/hooks/useScreenerUniverse";
import { displayMetric, formatMetric, METRIC_BY_ID } from "@/lib/screener-metrics";
import { PEER_METRICS, sectorPeers } from "@/lib/stock-peers";

/**
 * screener.in's peer comparison: the sector's largest tracked companies with
 * the stock beside them, and the sector median underneath. A figure better
 * than the median is tinted, so the table reads at a glance.
 */
export default function PeerComparison({ symbol }: { symbol: string }) {
  const { data } = useScreenerUniverse();
  const peers = useMemo(() => sectorPeers(data, symbol), [data, symbol]);
  if (!peers) return null;

  const columns = PEER_METRICS.map((id) => METRIC_BY_ID.get(id)!);
  const self = symbol.toUpperCase();

  return (
    <motion.section {...revealSection} aria-labelledby="peers-heading">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="peers-heading" className="flex items-center gap-2 text-2xl font-bold">
          <Users className="h-5 w-5 text-secondary" aria-hidden="true" /> Peer comparison
        </h2>
        <Link to={`/screener?sector=${encodeURIComponent(peers.sector)}`} className="link-arrow text-sm font-medium text-secondary">
          All {peers.size} in {peers.sector}
        </Link>
      </div>
      <Card className="overflow-hidden p-0">
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <caption className="sr-only">Largest {peers.sector} companies tracked, with sector medians</caption>
            <thead>
              <tr className="border-b bg-muted/40">
                <th scope="col" className="sticky left-0 bg-muted/40 p-3 text-left font-medium">Company</th>
                {columns.map((m) => (
                  <th key={m.id} scope="col" title={m.title} className="whitespace-nowrap p-3 text-right font-medium">{m.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {peers.rows.map((r) => {
                const isSelf = r.symbol === self;
                return (
                  <tr key={r.symbol} aria-current={isSelf ? "true" : undefined} className={`border-b transition-colors last:border-0 ${isSelf ? "bg-secondary/[0.07]" : "hover:bg-muted/30"}`}>
                    <th scope="row" className={`sticky left-0 p-3 text-left font-normal ${isSelf ? "bg-card font-semibold" : "bg-card"}`}>
                      {isSelf ? (
                        <span>{r.quote?.name ?? r.symbol}</span>
                      ) : (
                        <Link to={`/stock/${r.symbol}`} className="hover:text-secondary hover:underline underline-offset-4">{r.quote?.name ?? r.symbol}</Link>
                      )}
                      <span className="ml-2 font-mono text-[0.6875rem] text-muted-foreground">{r.symbol}</span>
                    </th>
                    {columns.map((m) => {
                      const v = m.get(r);
                      const med = peers.median[m.id];
                      const better = v !== null && med !== null && m.id !== "market_cap" && (m.lowerIsBetter ? v < med : v > med) && !(m.id === "pe" && v <= 0);
                      return (
                        <td key={m.id} className={`whitespace-nowrap p-3 text-right tabular-nums ${better ? "text-secondary" : ""}`}>
                          {displayMetric(m, r)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 bg-muted/30 text-muted-foreground">
                <th scope="row" className="sticky left-0 bg-muted/30 p-3 text-left font-medium">Sector median</th>
                {columns.map((m) => (
                  <td key={m.id} className="p-3 text-right tabular-nums">{formatMetric(peers.median[m.id], m.unit)}</td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
      <p className="mt-2 text-xs text-muted-foreground">
        Sector as classified in the tracked universe; medians use every tracked {peers.sector} company, and P/E only profitable ones. Tinted figures beat the median.
      </p>
    </motion.section>
  );
}

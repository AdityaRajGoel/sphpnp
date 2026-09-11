import { motion } from "motion/react";
import { Card } from "@/components/ui/card";
import { revealSection } from "@/lib/motion";
import { useStockMarketData } from "@/hooks/useStockMarketData";
import { lakhs, shortDate } from "@/lib/market-data";

const KIND = { bulk: "Bulk", block: "Block", short: "Short sale" } as const;

/** Bulk, block and short-selling deals NSE reported in this stock. */
export default function StockDeals({ symbol }: { symbol: string }) {
  const { data } = useStockMarketData(symbol);
  const deals = data?.deals ?? [];
  if (deals.length === 0) return null;
  const bought = deals.filter((d) => d.side === "buy" && d.kind !== "short").reduce((a, d) => a + (d.quantity ?? 0), 0);
  const sold = deals.filter((d) => d.side === "sell" && d.kind !== "short").reduce((a, d) => a + (d.quantity ?? 0), 0);

  return (
    <motion.section {...revealSection} aria-labelledby="deals-heading">
      <div className="flex flex-wrap items-end justify-between gap-2 mb-4">
        <h2 id="deals-heading" className="text-2xl font-bold">Bulk &amp; block deals</h2>
        {(bought > 0 || sold > 0) && <span className="text-sm text-muted-foreground">Bought <strong className="text-secondary">{lakhs(bought)}</strong> · sold <strong className="text-destructive">{lakhs(sold)}</strong> shares</span>}
      </div>
      <Card className="p-0 overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <caption className="sr-only">Large deals reported to NSE in this stock</caption>
          <thead><tr className="border-b text-left text-muted-foreground">
            <th className="p-3 font-medium">Date</th><th className="p-3 font-medium">Client</th><th className="p-3 font-medium">Type</th>
            <th className="p-3 text-right font-medium">Quantity</th><th className="p-3 text-right font-medium">Price</th>
          </tr></thead>
          <tbody>
            {deals.slice(0, 20).map((d) => (
              <tr key={d.deal_key} className="border-b last:border-0">
                <td className="p-3 whitespace-nowrap text-muted-foreground">{shortDate(d.trade_date)}</td>
                <td className="p-3">{d.client ?? "—"}</td>
                <td className="p-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${d.side === "buy" ? "bg-secondary/10 text-secondary" : "bg-destructive/10 text-destructive"}`}>{KIND[d.kind]}{d.kind !== "short" && d.side ? ` ${d.side}` : ""}</span></td>
                <td className="p-3 text-right tabular-nums">{d.quantity?.toLocaleString("en-IN") ?? "—"}</td>
                <td className="p-3 text-right tabular-nums">{d.price === null ? "—" : `₹${d.price.toLocaleString("en-IN")}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="mt-3 text-xs text-muted-foreground">Deals of more than 0.5% of shares (bulk), large single trades (block) and short sales, as NSE reports them.</p>
    </motion.section>
  );
}

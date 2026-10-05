import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import type { ScreenerStock } from "@/hooks/useScreenerStocks";
import { formatCrore } from "@/lib/fundamentals";

/** Symmetric steps either side of flat: the same move up or down gets the same strength of colour. */
const STEPS = [0.1, 1, 2, 3];
const ALPHA = [0.2, 0.4, 0.55, 0.9];

/** The tile's fill: grey within ±0.1%, then green or red in four matching steps. */
export const heatColor = (pct: number): string => {
  const size = Math.abs(pct);
  if (size < STEPS[0]) return "hsl(var(--muted))";
  const step = STEPS.filter((s) => size >= s).length - 1;
  return `hsl(var(${pct > 0 ? "--secondary" : "--destructive"}) / ${ALPHA[step]})`;
};

/**
 * The strongest step is near-solid, so it takes the fill's own foreground token
 * (white in light, dark ink on the brighter dark-theme green/red). Every lighter
 * step is a tint of the card, where the page's text colour reads: white on the
 * light-theme tints measured 2.0-3.8:1.
 */
export const heatTextColor = (pct: number): string =>
  Math.abs(pct) >= STEPS[3] ? `hsl(var(${pct > 0 ? "--secondary-foreground" : "--destructive-foreground"}))` : "hsl(var(--foreground))";

const formatCap = (cr: number) => formatCrore(cr);

export type HeatmapStock = Pick<ScreenerStock, "symbol" | "name" | "price" | "change_pct" | "market_cap">;

type Props = {
  stocks: HeatmapStock[];
  maxItems?: number;
};

const StockHeatmap = ({ stocks, maxItems = 50 }: Props) => {
  // Top N by market cap; tiles sized by their share of it.
  const data = stocks
    .filter(s => s.market_cap > 0)
    .sort((a, b) => b.market_cap - a.market_cap)
    .slice(0, maxItems);

  const totalCap = data.reduce((sum, s) => sum + s.market_cap, 0);

  if (data.length === 0) return null;

  return (
    <Card className="p-3 md:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-foreground">Market Heatmap <span className="font-normal text-muted-foreground">· tile size is market cap; click a tile to open the stock</span></h3>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground" aria-label="Colour scale">
          <span>−3%</span>
          {[-3, -2, -1, -0.5, 0, 0.5, 1, 2, 3].map((p) => (
            <span key={p} className="w-3.5 h-2.5 rounded-sm" style={{ background: heatColor(p) }} />
          ))}
          <span>+3%</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {data.map((stock, i) => {
          const pctArea = Math.max((stock.market_cap / totalCap) * 100, 2);
          const minW = pctArea > 8 ? 130 : 80;
          const minH = pctArea > 8 ? 70 : 48;
          const change = `${stock.change_pct >= 0 ? "+" : ""}${stock.change_pct.toFixed(2)}%`;
          return (
            <motion.div
              key={stock.symbol}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.015 }}
              className="flex"
              style={{ flexBasis: `${pctArea}%`, flexGrow: 1, minWidth: `${minW}px`, minHeight: `${minH}px`, maxWidth: `${Math.max(pctArea * 2, 14)}%` }}
            >
              <Link
                to={`/stock/${encodeURIComponent(stock.symbol)}`}
                className="flex-1 rounded-md flex flex-col items-center justify-center transition-transform hover:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                style={{ background: heatColor(stock.change_pct), color: heatTextColor(stock.change_pct) }}
                title={`${stock.name} | ₹${stock.price.toLocaleString("en-IN")} | ${change} | MCap: ${formatCap(stock.market_cap)}`}
                aria-label={`${stock.name} (${stock.symbol}) ${change}, open stock page`}
              >
                <span className="font-bold text-[10px] md:text-xs leading-tight">{stock.symbol}</span>
                <span className="text-[9px] md:text-[10px] font-medium tabular-nums">{change}</span>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </Card>
  );
};

export default StockHeatmap;

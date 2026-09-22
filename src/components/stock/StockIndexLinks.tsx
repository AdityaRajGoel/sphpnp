import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Calculator, Layers } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { INDEX_NAMES, indexTitle, listSlug } from "@/lib/market-lists";

type Membership = { indices: string[]; lotSize: number | null };

async function loadMembership(symbol: string): Promise<Membership> {
  const [idx, lot] = await Promise.all([
    supabase.from("index_constituents" as never).select("index_name").eq("symbol", symbol),
    supabase.from("fo_lot_sizes" as never).select("lot_size").eq("symbol", symbol).limit(1),
  ]);
  if (idx.error) throw new Error(idx.error.message);
  if (lot.error) throw new Error(lot.error.message);
  const names = new Set(((idx.data ?? []) as { index_name: string }[]).map((r) => r.index_name));
  return {
    // In INDEX_NAMES order: broad indices first, then sectoral.
    indices: INDEX_NAMES.filter((n) => names.has(n)),
    lotSize: ((lot.data ?? []) as { lot_size: number }[])[0]?.lot_size ?? null,
  };
}

/**
 * Which NSE indices the stock belongs to, each linking to that index's list
 * page, and for an F&O stock a link to the margin for one lot. Plain links, so
 * they are baked into the static HTML: the index pages and the margin
 * calculator (~600 search impressions a quarter, ranked ~27) gain an internal
 * link from every stock page that has one.
 */
export default function StockIndexLinks({ symbol }: { symbol: string }) {
  const { data } = useQuery({ queryKey: ["stock-membership", symbol], queryFn: () => loadMembership(symbol), staleTime: 60 * 60_000 });
  if (!data || (data.indices.length === 0 && data.lotSize === null)) return null;

  return (
    <section aria-labelledby="stock-links" className="mt-6 rounded-lg border bg-card px-4 py-3">
      <h2 id="stock-links" className="flex items-center gap-2 text-sm font-semibold">
        <Layers className="h-4 w-4 text-secondary" aria-hidden="true" /> {symbol} in NSE indices and F&amp;O
      </h2>
      {data.indices.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {data.indices.map((n) => (
            <li key={n}>
              <Link to={`/indices/${listSlug(n)}`} className="inline-block rounded-md border px-2 py-1 text-xs font-medium text-muted-foreground hover:border-secondary/50 hover:text-secondary transition-colors">
                {indexTitle(n)}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {data.lotSize !== null && (
        <Link to={`/margin-calculator?symbol=${encodeURIComponent(symbol)}`} className="link-arrow mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-secondary">
          <Calculator className="h-4 w-4" aria-hidden="true" /> F&amp;O margin for one lot of {symbol} ({data.lotSize.toLocaleString("en-IN")} shares)
        </Link>
      )}
    </section>
  );
}

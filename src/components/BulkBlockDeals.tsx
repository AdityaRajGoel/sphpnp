import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Handshake, Boxes } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useBulkDeals, type BulkDealRow } from "@/hooks/useBulkDeals";

const TOP_N = 8;
const CRORE = 1e7;

const fmtQty = (n: number | null) => {
  if (n == null) return "-";
  if (n >= 1e7) return `${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `${(n / 1e5).toFixed(1)} L`;
  return n.toLocaleString("en-IN");
};

const dealValueCr = (d: BulkDealRow) =>
  d.quantity != null && d.price != null ? (d.quantity * d.price) / CRORE : 0;

/**
 * NSE bulk & block deals board (EOD): the day's largest negotiated trades,
 * ranked by deal value, with the counterparty named - the single most-watched
 * "smart money" signal on the exchange sites.
 */
const BulkBlockDeals = () => {
  const { deals, asOf, loading } = useBulkDeals();
  const [tab, setTab] = useState<"bulk" | "block">("bulk");

  const counts = useMemo(() => ({
    bulk: deals.filter((d) => d.deal_type === "bulk").length,
    block: deals.filter((d) => d.deal_type === "block").length,
  }), [deals]);

  const rows = useMemo(
    () => deals
      .filter((d) => d.deal_type === tab)
      .sort((a, b) => dealValueCr(b) - dealValueCr(a))
      .slice(0, TOP_N),
    [deals, tab],
  );

  const asOfLabel = asOf
    ? new Date(asOf).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
    : null;

  // Nothing deployed / synced yet - render nothing rather than an empty shell.
  if (!loading && deals.length === 0) return null;

  return (
    <Card className="p-4 h-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-heading font-bold flex items-center gap-2">
          <Handshake className="w-4 h-4 text-brand-orange" />
          Bulk &amp; Block Deals
        </h2>
        <span className="text-[10px] text-muted-foreground">{asOfLabel ? `EOD · ${asOfLabel}` : "EOD"}</span>
      </div>

      <div className="flex gap-2 mb-3">
        {(["bulk", "block"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${tab === t ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:text-foreground"}`}
          >
            <Boxes className="w-3 h-3" />
            {t === "bulk" ? "Bulk" : "Block"} ({counts[t]})
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
          {rows.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">
              No {tab} deals reported for the latest session.
            </p>
          ) : (
            <div className="space-y-0.5">
              {rows.map((d, i) => {
                const isBuy = d.buy_sell === "BUY";
                const val = dealValueCr(d);
                return (
                  <div key={`${d.symbol}-${d.client_name}-${i}`} className="flex items-center gap-2.5 py-1.5 border-b border-border/30 last:border-0">
                    <span className={`shrink-0 w-9 text-center text-[9px] font-black uppercase px-1 py-0.5 rounded ${isBuy ? "bg-secondary/15 text-secondary" : "bg-destructive/10 text-destructive"}`}>
                      {d.buy_sell ?? "-"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-foreground truncate">{d.symbol}</div>
                      <div className="text-[10px] text-muted-foreground truncate" title={d.client_name ?? undefined}>{d.client_name ?? "-"}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-mono font-semibold text-foreground">₹{val.toFixed(1)} Cr</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{fmtQty(d.quantity)} @ ₹{d.price?.toLocaleString("en-IN") ?? "-"}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
      <p className="text-[9px] text-muted-foreground mt-2.5 text-center">
        Source: NSE daily disclosures. Deals ≥0.5% of equity (bulk) / ≥₹10 Cr single trade (block).
      </p>
    </Card>
  );
};

export default BulkBlockDeals;

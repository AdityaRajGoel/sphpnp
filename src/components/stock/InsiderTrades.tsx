import { motion } from "motion/react";
import { Card } from "@/components/ui/card";
import { revealSection } from "@/lib/motion";
import { insiderSummary, shortRupees, webHref, type InsiderTrade } from "@/lib/stock-disclosures";

const LABEL: Record<InsiderTrade["transaction"], string> = { buy: "Buy", sell: "Sell", pledge: "Pledge", revoke: "Pledge released", other: "Other" };
const TONE: Record<InsiderTrade["transaction"], string> = {
  buy: "text-secondary bg-secondary/10", sell: "text-destructive bg-destructive/10",
  pledge: "text-brand-orange bg-brand-orange/10", revoke: "text-muted-foreground bg-muted", other: "text-muted-foreground bg-muted",
};
const day = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

/** Trades by promoters, directors and employees disclosed to NSE under SEBI's insider-trading rules. */
export default function InsiderTrades({ trades }: { trades: InsiderTrade[] }) {
  if (trades.length === 0) return null;
  const s = insiderSummary(trades);
  const total = s.boughtValue + s.soldValue;
  const buyShare = total > 0 ? (s.boughtValue / total) * 100 : 50;

  return (
    <motion.section {...revealSection} aria-labelledby="insider-heading">
      <h2 id="insider-heading" className="text-2xl font-bold mb-4">Insider trades</h2>
      <Card className="p-4 mb-3">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
          <div>
            <div className="text-xs text-muted-foreground">Last 12 months, market trades</div>
            <div className={`text-2xl font-bold tabular-nums ${s.net >= 0 ? "text-secondary" : "text-destructive"}`}>
              {total > 0 ? `Net ${s.net >= 0 ? "buying" : "selling"} ${shortRupees(Math.abs(s.net))}` : "No market trades"}
            </div>
          </div>
          <div className="text-sm text-right">
            <div><span className="text-secondary font-semibold">{s.buys} buys</span> · {shortRupees(s.boughtValue)}</div>
            <div><span className="text-destructive font-semibold">{s.sells} sells</span> · {shortRupees(s.soldValue)}</div>
          </div>
        </div>
        {total > 0 && (
          <div className="h-2 rounded-full bg-destructive/50 overflow-hidden" role="img" aria-label={`Buying ${buyShare.toFixed(0)}% of traded value`}>
            <div className="h-full bg-secondary" style={{ width: `${buyShare}%` }} />
          </div>
        )}
      </Card>
      <Card className="p-0 overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <caption className="sr-only">Latest insider trades disclosed to NSE</caption>
          <thead>
            <tr className="border-b text-left">
              <th scope="col" className="p-3 font-medium">Person</th>
              <th scope="col" className="p-3 font-medium">Type</th>
              <th scope="col" className="p-3 font-medium text-right">Shares</th>
              <th scope="col" className="p-3 font-medium text-right">Value</th>
              <th scope="col" className="p-3 font-medium text-right">Disclosed</th>
            </tr>
          </thead>
          <tbody>
            {trades.slice(0, 12).map((t) => (
              <tr key={t.disclosure_id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="p-3">
                  <div className="font-medium">{t.person}</div>
                  <div className="text-xs text-muted-foreground">{[t.category, t.mode].filter(Boolean).join(" · ")}</div>
                </td>
                <td className="p-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TONE[t.transaction]}`}>{LABEL[t.transaction]}</span></td>
                <td className="p-3 text-right tabular-nums">{t.quantity === null ? "—" : t.quantity.toLocaleString("en-IN")}</td>
                <td className="p-3 text-right tabular-nums">{t.value === null ? "—" : shortRupees(t.value)}</td>
                <td className="p-3 text-right text-muted-foreground whitespace-nowrap">
                  {webHref(t.xbrl_url) ? <a href={webHref(t.xbrl_url)} target="_blank" rel="noopener noreferrer nofollow" className="hover:text-primary hover:underline">{day(t.disclosed_at)}</a> : day(t.disclosed_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="mt-3 text-xs text-muted-foreground">Disclosures filed with NSE under SEBI (Prohibition of Insider Trading) Regulations. Pledges and releases are not trades and are not counted above.</p>
    </motion.section>
  );
}

import { AlertTriangle, CalendarClock, Layers, Lock, ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useStockMarketData } from "@/hooks/useStockMarketData";
import { SURVEILLANCE_LABEL, shortDate } from "@/lib/market-data";

type Props = { symbol: string; price: number | null };

/**
 * What a trader should know before anything else: exchange surveillance, F&O
 * ban, promoter pledges, index membership, lot size, the 52-week range
 * adjusted for corporate actions, and board meetings coming up.
 */
export default function StockSignals({ symbol, price }: Props) {
  const { data } = useStockMarketData(symbol);
  if (!data) return null;
  const { flags, pledge, indices, lotSize, week52, events } = data;
  const pledged = pledge?.pledged_pct_of_promoter ?? 0;
  const range = week52?.adj_high && week52.adj_low ? week52.adj_high - week52.adj_low : null;
  const position = range && price !== null ? Math.min(100, Math.max(0, ((price - week52!.adj_low!) / range) * 100)) : null;
  const hasAnything = flags.length > 0 || pledged > 0 || indices.length > 0 || lotSize || week52 || events.length > 0;
  if (!hasAnything) return null;

  return (
    <section aria-label="Key signals" className="space-y-3">
      {(flags.length > 0 || pledged > 0) && (
        <div className="flex flex-wrap gap-2">
          {flags.map((f) => (
            <span key={f.flag} title={f.detail ?? undefined}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${f.flag === "fo_ban" ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-brand-orange/40 bg-brand-orange/10 text-brand-orange"}`}>
              <ShieldAlert className="w-3.5 h-3.5" aria-hidden="true" />
              {SURVEILLANCE_LABEL[f.flag]}{f.stage ? ` · ${f.stage}` : ""}
            </span>
          ))}
          {pledged > 0 && (
            <span title={`As of ${shortDate(pledge!.shp_date)} (NSE pledge disclosures)`}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${pledged >= 10 ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-brand-orange/40 bg-brand-orange/10 text-brand-orange"}`}>
              <Lock className="w-3.5 h-3.5" aria-hidden="true" />
              Promoters pledged {pledged.toFixed(1)}% of their shares
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {week52?.adj_high && week52.adj_low && (
          <Card className="min-w-0 p-3">
            <div className="text-xs text-muted-foreground mb-2">52-week range, adjusted for splits and bonuses</div>
            <div className="flex items-center gap-2 text-xs tabular-nums">
              <span className="text-destructive font-semibold">₹{week52.adj_low.toLocaleString("en-IN")}</span>
              <div className="relative h-2 flex-1 rounded-full bg-gradient-to-r from-destructive/60 via-muted to-secondary/60" role="img" aria-label={position === null ? "52-week range" : `Price at ${position.toFixed(0)}% of its 52-week range`}>
                {position !== null && <span className="absolute top-1/2 h-4 w-1.5 -translate-y-1/2 rounded-full bg-foreground" style={{ left: `calc(${position}% - 3px)` }} />}
              </div>
              <span className="text-secondary font-semibold">₹{week52.adj_high.toLocaleString("en-IN")}</span>
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-muted-foreground"><span>{shortDate(week52.low_date)}</span><span>{shortDate(week52.high_date)}</span></div>
          </Card>
        )}
        {(indices.length > 0 || lotSize) && (
          <Card className="min-w-0 p-3">
            <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5"><Layers className="w-3.5 h-3.5" aria-hidden="true" />Index membership{lotSize ? " & F&O" : ""}</div>
            <div className="flex flex-wrap gap-1.5">
              {indices.map((i) => <span key={i} className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">{i}</span>)}
              {lotSize && <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold">F&amp;O lot {lotSize.toLocaleString("en-IN")}</span>}
            </div>
          </Card>
        )}
        {events.length > 0 && (
          <Card className="min-w-0 p-3">
            <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5"><CalendarClock className="w-3.5 h-3.5" aria-hidden="true" />Coming up</div>
            <ul className="space-y-1">
              {events.slice(0, 3).map((e) => (
                <li key={e.event_key} className="text-sm"><span className="font-semibold tabular-nums">{shortDate(e.event_date)}</span> · {e.purpose}</li>
              ))}
            </ul>
          </Card>
        )}
      </div>
      {flags.some((f) => f.flag === "fo_ban") && (
        <p className="flex items-start gap-2 text-xs text-destructive"><AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />In the F&amp;O ban period: open interest crossed 95% of the market-wide limit, so only positions that reduce exposure may be taken.</p>
      )}
    </section>
  );
}

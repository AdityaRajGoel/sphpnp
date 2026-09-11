import { useQuery } from "@tanstack/react-query";
import { Landmark, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { nseIpoFor, shortDate } from "@/lib/market-data";
import type { Ipo } from "@/lib/ipo";

const band = (lo: number | null, hi: number | null) => (hi === null ? "—" : lo !== null && lo !== hi ? `₹${lo}–${hi}` : `₹${hi}`);

/**
 * The exchange's own record of the issue - NSE's price band, dates and the
 * subscription it reports - beside the figures the three IPO websites give,
 * with a note wherever they disagree.
 */
export default function NseExchangeCard({ ipo }: { ipo: Ipo }) {
  const { data: nse } = useQuery({ queryKey: ["nse-ipo", ipo.slug], queryFn: () => nseIpoFor(ipo.slug), staleTime: 10 * 60_000 });
  if (!nse) return null;
  const bandDiffers = nse.price_band_max !== null && ipo.price_band_max !== null && nse.price_band_max !== ipo.price_band_max;
  const datesDiffer = !!nse.issue_start && !!ipo.open_date && nse.issue_start !== ipo.open_date;

  return (
    <Card className="min-w-0 border-primary/30"><CardContent className="p-4 md:p-5">
      <div className="flex items-center gap-2 mb-3">
        <Landmark className="w-5 h-5 text-primary" aria-hidden="true" />
        <div>
          <h2 className="font-heading text-lg font-bold">As NSE lists it</h2>
          <p className="text-xs text-muted-foreground">The exchange's own issue data, NSE symbol {nse.symbol} · read {new Date(nse.fetched_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div><dt className="text-xs text-muted-foreground">Price band</dt><dd className="font-semibold tabular-nums">{band(nse.price_band_min, nse.price_band_max)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Bidding</dt><dd className="font-semibold">{shortDate(nse.issue_start)} – {shortDate(nse.issue_end)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Subscribed (NSE)</dt><dd className="font-semibold tabular-nums">{nse.subscription_times === null ? "—" : `${nse.subscription_times.toFixed(2)}x`}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Shares offered</dt><dd className="font-semibold tabular-nums">{nse.issue_size_shares?.toLocaleString("en-IN") ?? "—"}</dd></div>
        {nse.shares_bid !== null && <div><dt className="text-xs text-muted-foreground">Shares bid</dt><dd className="font-semibold tabular-nums">{nse.shares_bid.toLocaleString("en-IN")}</dd></div>}
        {nse.listing_date && <div><dt className="text-xs text-muted-foreground">Listed</dt><dd className="font-semibold">{shortDate(nse.listing_date)}</dd></div>}
        {nse.issue_price !== null && <div><dt className="text-xs text-muted-foreground">Issue price</dt><dd className="font-semibold tabular-nums">₹{nse.issue_price}</dd></div>}
      </dl>
      {(bandDiffers || datesDiffer) && (
        <p className="mt-3 flex items-start gap-2 text-xs text-brand-orange">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
          {bandDiffers && `NSE's upper band (₹${nse.price_band_max}) differs from the ₹${ipo.price_band_max} our sources give. `}
          {datesDiffer && `NSE opens bidding on ${shortDate(nse.issue_start)}, our sources say ${shortDate(ipo.open_date)}. `}
          The exchange's figures are the authoritative ones.
        </p>
      )}
      <p className="mt-3 text-xs text-muted-foreground">NSE's subscription counts bids on its own platform and can differ from the combined NSE + BSE figure above.</p>
    </CardContent></Card>
  );
}

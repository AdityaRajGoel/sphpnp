import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import AnimatedNumber from "@/components/ui/animated-number";
import { formatSubscription, gmpPercent, type Ipo } from "@/lib/ipo";

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const signed = (v: number | null, digits = 1) => (v === null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(digits)}%`);
const tone = (v: number | null) => (v === null ? "" : v >= 0 ? "text-secondary" : "text-destructive");

export type IpoStats = {
  open: number;
  closingSoon: Ipo[];
  upcoming: number;
  avgOpenGmpPct: number | null;
  listedThisYear: Ipo[];
  /** Of those, how many carry a recorded listing gain. */
  withGain: number;
  avgListingGain: number | null;
  positiveListings: number;
  best: Ipo | null;
  worst: Ipo | null;
  mostSubscribed: Ipo[];
  raisedCr: number;
};

/** Everything the strip shows, from the catalogue alone. `today` is an ISO date. */
export function ipoStats(ipos: Ipo[], today: string): IpoStats {
  const year = today.slice(0, 4);
  const open = ipos.filter((i) => i.status === "open");
  // Counted by listing date alone: the catalogue records a listing gain for few
  // issues, and a count that required one would report no listings at all.
  const listed = ipos.filter((i) => i.status === "listed" && !!i.listing_date?.startsWith(year));
  const withGain = listed.filter((i) => i.listing_gain_pct !== null);
  const soon = new Date(Date.parse(`${today}T00:00:00Z`) + 2 * 86_400_000).toISOString().slice(0, 10);
  const byGain = [...withGain].sort((a, b) => b.listing_gain_pct! - a.listing_gain_pct!);
  return {
    open: open.length,
    closingSoon: open.filter((i) => i.close_date !== null && i.close_date <= soon).sort((a, b) => a.close_date!.localeCompare(b.close_date!)),
    upcoming: ipos.filter((i) => i.status === "upcoming").length,
    avgOpenGmpPct: mean(open.map(gmpPercent).filter((v): v is number => v !== null)),
    listedThisYear: listed,
    withGain: withGain.length,
    avgListingGain: mean(withGain.map((i) => i.listing_gain_pct!)),
    positiveListings: withGain.filter((i) => i.listing_gain_pct! > 0).length,
    best: byGain[0] ?? null,
    worst: byGain.length > 1 ? byGain[byGain.length - 1] : null,
    mostSubscribed: ipos.filter((i) => (i.status === "open" || i.status === "closed") && i.subscription_total !== null).sort((a, b) => b.subscription_total! - a.subscription_total!).slice(0, 5),
    raisedCr: listed.reduce((sum, i) => sum + (i.issue_size_crore ?? 0), 0),
  };
}

/**
 * The IPO market at a glance: what is open and closing, how this year's
 * listings have done, and where demand is heaviest - above the calendar.
 */
export default function IpoMarketStats({ ipos, today }: { ipos: Ipo[]; today: string }) {
  const s = useMemo(() => ipoStats(ipos, today), [ipos, today]);
  if (ipos.length === 0) return null;
  const hitRate = s.withGain ? (s.positiveListings / s.withGain) * 100 : null;

  return (
    <section aria-labelledby="ipo-market" className="mb-10">
      <h2 id="ipo-market" className="font-heading text-2xl font-bold mb-4">IPO market this year</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Open now</div>
          <AnimatedNumber value={s.open} className="mt-1 block text-3xl font-bold" />
          <div className="text-xs text-muted-foreground">{s.upcoming} upcoming · {s.closingSoon.length} closing within 2 days</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Average GMP, open issues</div>
          <AnimatedNumber value={s.avgOpenGmpPct} format={(v) => signed(v)} className={`mt-1 block text-3xl font-bold ${tone(s.avgOpenGmpPct)}`} />
          <div className="text-xs text-muted-foreground">of the upper price band · unofficial</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Average listing gain, {today.slice(0, 4)}</div>
          <AnimatedNumber value={s.avgListingGain} format={(v) => signed(v)} className={`mt-1 block text-3xl font-bold ${tone(s.avgListingGain)}`} />
          <div className="text-xs text-muted-foreground">
            {s.listedThisYear.length} listings · {hitRate === null ? "listing prices not yet recorded" : `${hitRate.toFixed(0)}% of ${s.withGain} listed above issue`}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Raised by this year's listings</div>
          <div className="mt-1 text-3xl font-bold tabular-nums">{s.raisedCr <= 0 ? "—" : `₹${s.raisedCr >= 1000 ? `${(s.raisedCr / 1000).toFixed(1)}K` : s.raisedCr.toFixed(0)} Cr`}</div>
          <div className="text-xs text-muted-foreground">where issue size is known</div>
        </Card>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-2">Closing soon</h3>
          {s.closingSoon.length === 0 ? <p className="text-sm text-muted-foreground">No open issue closes in the next two days.</p> : (
            <ul className="space-y-1.5">
              {s.closingSoon.slice(0, 5).map((i) => (
                <li key={i.id} className="flex items-baseline justify-between gap-2 text-sm">
                  <Link to={`/ipo/${i.slug}`} className="truncate font-medium hover:text-primary">{i.name}</Link>
                  <span className="shrink-0 text-xs text-muted-foreground">closes {i.close_date === today ? "today" : new Date(`${i.close_date}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" })}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-2">Heaviest demand</h3>
          {s.mostSubscribed.length === 0 ? <p className="text-sm text-muted-foreground">Subscription figures appear once bidding opens.</p> : (
            <ul className="space-y-1.5">
              {s.mostSubscribed.map((i) => (
                <li key={i.id} className="flex items-baseline justify-between gap-2 text-sm">
                  <Link to={`/ipo/${i.slug}`} className="truncate font-medium hover:text-primary">{i.name}</Link>
                  <span className="shrink-0 font-semibold tabular-nums">{formatSubscription(i.subscription_total)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-2">Best and worst listings</h3>
          {!s.best ? <p className="text-sm text-muted-foreground">No listings with a recorded listing price this year.</p> : (
            <ul className="space-y-1.5">
              {[s.best, s.worst].filter((i): i is Ipo => i !== null).map((i) => (
                <li key={i.id} className="flex items-baseline justify-between gap-2 text-sm">
                  <Link to={`/ipo/${i.slug}`} className="truncate font-medium hover:text-primary">{i.name}</Link>
                  <span className={`shrink-0 font-semibold tabular-nums ${tone(i.listing_gain_pct)}`}>{signed(i.listing_gain_pct)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Listing gain is the listing-day price against the issue price. Past listings do not indicate future ones; GMP is unregulated. Not investment advice.</p>
    </section>
  );
}

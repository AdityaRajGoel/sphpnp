import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { ArrowUpRight, Info, Layers, Scale } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { revealBar, revealItem, revealSection } from "@/lib/motion";
import { isQuoteStale } from "@/lib/unlisted";

/**
 * What other dealers are quoting for the same pre-IPO companies.
 *
 * Every number here belongs to somebody else, collected daily by the
 * sync-unlisted-quotes edge function, and that shapes the whole component:
 *
 * - Nothing renders without a date. A quote past the staleness window is
 *   dropped rather than shown as current. This file sits in a codebase that has
 *   twice deleted price displays for presenting unverifiable numbers as fact.
 * - Every price deep-links to the page it came from, so a reader can check it
 *   rather than take our word for it.
 * - A company quoted by only one dealer is omitted. One price is not a
 *   comparison, and including it would overstate how much is being compared.
 *
 * Our own rate is deliberately absent. These are reference rates; our desk
 * quotes on its own terms, lot size and settlement, and putting the two in one
 * row invites a comparison that is not like-for-like.
 */

interface MarketQuote {
  match_key: string;
  company_name: string;
  source: string;
  source_url: string;
  price: number;
  fetched_at: string;
  sector: string | null;
  lot_size: number | null;
  as_of: string | null;
  quote_url: string | null;
}

interface ComparisonRow {
  key: string;
  label: string;
  sector: string | null;
  lotSize: number | null;
  quotes: MarketQuote[];
  low: number;
  high: number;
  /** Gap between the cheapest and dearest dealer, as a percentage of the low. */
  spreadPct: number;
}

/**
 * `unlisted_market_quotes` post-dates the checked-in generated types, so it is
 * reached through the same cast the bulk-deals hook uses (useBulkDeals.ts:18).
 */
const quotesTable = () =>
  supabase.from("unlisted_market_quotes" as never) as ReturnType<typeof supabase.from>;

const inr = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const UnlistedPriceComparison = () => {
  const [quotes, setQuotes] = useState<MarketQuote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const { data, error } = await quotesTable()
        .select(
          "match_key, company_name, source, source_url, price, fetched_at, sector, lot_size, as_of, quote_url",
        )
        .order("company_name");

      if (cancelled) return;
      if (error) {
        console.error("Failed to load market quotes:", error);
        setQuotes([]);
      } else {
        setQuotes((data ?? []) as unknown as MarketQuote[]);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useMemo<ComparisonRow[]>(() => {
    const grouped = new Map<string, MarketQuote[]>();
    for (const q of quotes) {
      // A quote we cannot date never reaches the page at all.
      if (isQuoteStale(q.fetched_at)) continue;
      const list = grouped.get(q.match_key) ?? [];
      list.push(q);
      grouped.set(q.match_key, list);
    }

    const out: ComparisonRow[] = [];
    for (const [key, list] of grouped) {
      const bySource = new Map<string, MarketQuote>();
      for (const q of list) bySource.set(q.source, q);
      if (bySource.size < 2) continue;

      const sorted = [...bySource.values()].sort((a, b) => a.price - b.price);
      const low = sorted[0].price;
      const high = sorted[sorted.length - 1].price;

      out.push({
        key,
        // Prefer the fullest name any dealer uses rather than whichever came first.
        label: list.reduce(
          (a, b) => (b.company_name.length > a.length ? b.company_name : a),
          list[0].company_name,
        ),
        sector: list.find((q) => q.sector)?.sector ?? null,
        lotSize: list.find((q) => q.lot_size)?.lot_size ?? null,
        quotes: sorted,
        low,
        high,
        spreadPct: low > 0 ? ((high - low) / low) * 100 : 0,
      });
    }

    // Widest disagreement first: where dealers differ most is where calling the
    // desk is actually worth a reader's time.
    return out.sort((a, b) => b.spreadPct - a.spreadPct);
  }, [quotes]);

  const sources = useMemo(() => {
    const map = new Map<string, string>();
    for (const q of quotes) map.set(q.source, q.source_url);
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [quotes]);

  const asOf = useMemo(() => {
    // The dealers' own stamp where they publish one, since that dates the quote
    // rather than dating our collection of it.
    const stamps = quotes.map((q) => q.as_of).filter((d): d is string => !!d).sort();
    if (stamps.length) return stamps[stamps.length - 1];
    const times = quotes.map((q) => Date.parse(q.fetched_at)).filter(Number.isFinite);
    return times.length ? new Date(Math.max(...times)).toISOString().slice(0, 10) : null;
  }, [quotes]);

  // Nothing to compare is a normal state, not an error: the block does not
  // appear rather than rendering an empty shell.
  if (!loading && rows.length === 0) return null;

  return (
    <section className="py-10 md:py-16 bg-muted/20" aria-labelledby="unlisted-compare-heading">
      <div className="container mx-auto px-4">
        <motion.div className="text-center mb-8" {...revealSection}>
          <span className="inline-flex items-center gap-1.5 text-secondary font-semibold text-xs uppercase tracking-wider mb-3">
            <Scale className="w-3.5 h-3.5" /> Market Rates
          </span>
          <h2
            id="unlisted-compare-heading"
            className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-3"
          >
            What Other Dealers Are Quoting
          </h2>
          <motion.div
            className="w-20 h-1 bg-gradient-to-r from-secondary to-brand-gold mx-auto rounded-full mb-4"
            {...revealBar}
          />
          <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
            Indicative rates published by other unlisted dealers for the same companies, collected
            automatically each morning. Reference only — every dealer quotes on their own lot size
            and settlement terms. Call our desk for a firm price.
          </p>
        </motion.div>

        {loading ? (
          <div className="max-w-4xl mx-auto grid sm:grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-36 w-full rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            <div className="grid sm:grid-cols-2 gap-3">
              {rows.map((row, i) => (
                <motion.article
                  key={row.key}
                  className="bg-card border border-border/60 rounded-xl p-4 hover:border-secondary/40 transition-colors duration-base"
                  // Index capped so the last card in a long list is not left
                  // waiting seconds behind the first.
                  {...revealItem(Math.min(i, 6))}
                >
                  <header className="mb-3">
                    <h3 className="font-heading font-bold text-foreground text-sm leading-snug">
                      {row.label}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      {row.sector && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-secondary/10 text-secondary">
                          {row.sector}
                        </span>
                      )}
                      {row.lotSize && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Layers className="w-3 h-3" aria-hidden="true" />
                          Min lot {row.lotSize.toLocaleString("en-IN")}
                        </span>
                      )}
                    </div>
                  </header>

                  <dl className="space-y-1.5">
                    {row.quotes.map((q) => (
                      <div key={q.source} className="flex items-baseline justify-between gap-3">
                        <dt className="text-xs text-muted-foreground">
                          {q.quote_url ? (
                            <a
                              href={q.quote_url}
                              target="_blank"
                              rel="noopener noreferrer nofollow"
                              className="hover:text-secondary hover:underline inline-flex items-center gap-0.5"
                            >
                              {q.source}
                              <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
                            </a>
                          ) : (
                            q.source
                          )}
                        </dt>
                        <dd
                          className={`text-sm tabular-nums ${
                            q.price === row.low ? "font-bold text-secondary" : "text-foreground"
                          }`}
                        >
                          {inr(q.price)}
                        </dd>
                      </div>
                    ))}
                  </dl>

                  {row.spreadPct > 0 && (
                    <p className="mt-3 pt-2.5 border-t border-border/50 text-[11px] text-muted-foreground">
                      Dealers differ by{" "}
                      <strong className="text-foreground">{row.spreadPct.toFixed(1)}%</strong> here —{" "}
                      {inr(row.low)} to {inr(row.high)}.
                    </p>
                  )}
                </motion.article>
              ))}
            </div>

            <div className="mt-5 flex items-start gap-3 text-xs text-muted-foreground">
              <Info className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <p>
                Showing {rows.length} {rows.length === 1 ? "company" : "companies"} quoted by more
                than one dealer. Companies only one dealer lists, or whose names could not be matched
                with confidence, are left out.
                {asOf && (
                  <>
                    {" "}
                    Rates as of <time dateTime={asOf}>{asOf}</time>.
                  </>
                )}{" "}
                Sources:{" "}
                {sources.map(([name, url], i) => (
                  <span key={name}>
                    {i > 0 && ", "}
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="text-secondary font-semibold hover:underline"
                    >
                      {name}
                    </a>
                  </span>
                ))}
                . Parasram is not a party to these quotes and does not verify them.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default UnlistedPriceComparison;

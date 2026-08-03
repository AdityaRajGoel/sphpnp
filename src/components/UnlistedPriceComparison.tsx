import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { ExternalLink, Info, Scale } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { revealBar, revealSection } from "@/lib/motion";
import { isQuoteStale, unlistedMatchKey } from "@/lib/unlisted";

/**
 * Rate comparison against other unlisted dealers.
 *
 * Everything here is somebody else's published indicative rate, collected daily
 * by the sync-unlisted-quotes edge function. That shapes the whole component:
 *
 * - No row renders without a collection date, and a quote past the staleness
 *   window is labelled rather than shown as current. This file exists in a
 *   codebase that has twice deleted price displays for presenting unverifiable
 *   numbers as fact; a comparison table is the same hazard with more surface.
 * - Every dealer column links to the page the number came from, so a reader can
 *   check it rather than take our word.
 * - Companies only we quote are omitted. A row with one price is not a
 *   comparison, and padding the table with them would overstate coverage.
 */

interface MarketQuote {
  match_key: string;
  company_name: string;
  source: string;
  source_url: string;
  price: number;
  fetched_at: string;
}

interface OwnShare {
  name: string;
  price: string;
}

interface ComparisonRow {
  key: string;
  label: string;
  ourPrice: number | null;
  quotes: MarketQuote[];
  best: number;
}

/**
 * `unlisted_market_quotes` post-dates the checked-in generated types, so it is
 * reached through the same cast the bulk-deals hook uses (useBulkDeals.ts:18).
 * Regenerating types after the migration is applied makes this redundant.
 */
const quotesTable = () =>
  supabase.from("unlisted_market_quotes" as never) as ReturnType<typeof supabase.from>;

const parsePrice = (raw: string): number | null => {
  const n = Number(String(raw).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
};

const inr = (n: number) =>
  `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const UnlistedPriceComparison = () => {
  const [quotes, setQuotes] = useState<MarketQuote[]>([]);
  const [ownShares, setOwnShares] = useState<OwnShare[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      // Fired together rather than in sequence: neither depends on the other,
      // and this block sits below the fold where a waterfall is pure delay.
      const [quoteRes, shareRes] = await Promise.all([
        quotesTable()
          .select("match_key, company_name, source, source_url, price, fetched_at")
          .order("company_name"),
        supabase.functions.invoke("manage-unlisted-shares", { body: { action: "list" } }),
      ]);

      if (cancelled) return;

      if (quoteRes.error) {
        console.error("Failed to load market quotes:", quoteRes.error);
        setQuotes([]);
      } else {
        setQuotes((quoteRes.data ?? []) as unknown as MarketQuote[]);
      }

      const shareData = shareRes.data as { success?: boolean; data?: unknown } | null;
      if (shareData?.success && Array.isArray(shareData.data)) {
        setOwnShares(
          (shareData.data as Array<{ is_active?: boolean; name: string; price: string }>)
            .filter((s) => s.is_active !== false)
            .map((s) => ({ name: s.name, price: s.price })),
        );
      }

      setLoading(false);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useMemo<ComparisonRow[]>(() => {
    const ourByKey = new Map<string, OwnShare>();
    for (const s of ownShares) ourByKey.set(unlistedMatchKey(s.name), s);

    const grouped = new Map<string, MarketQuote[]>();
    for (const q of quotes) {
      // A quote we cannot date never reaches the table at all.
      if (isQuoteStale(q.fetched_at)) continue;
      const list = grouped.get(q.match_key) ?? [];
      list.push(q);
      grouped.set(q.match_key, list);
    }

    const out: ComparisonRow[] = [];
    for (const [key, list] of grouped) {
      const ours = ourByKey.get(key);
      const ourPrice = ours ? parsePrice(ours.price) : null;

      // Needs at least two independent numbers to be a comparison.
      const distinct = new Set(list.map((q) => q.source)).size;
      if (distinct + (ourPrice ? 1 : 0) < 2) continue;

      const candidates = [...list.map((q) => q.price), ...(ourPrice ? [ourPrice] : [])];
      out.push({
        key,
        label: ours?.name ?? list[0].company_name,
        ourPrice,
        quotes: [...list].sort((a, b) => a.source.localeCompare(b.source)),
        best: Math.min(...candidates),
      });
    }

    return out.sort((a, b) => a.label.localeCompare(b.label));
  }, [quotes, ownShares]);

  const sources = useMemo(() => {
    const map = new Map<string, string>();
    for (const q of quotes) map.set(q.source, q.source_url);
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [quotes]);

  const collectedAt = useMemo(() => {
    const times = quotes.map((q) => Date.parse(q.fetched_at)).filter(Number.isFinite);
    return times.length ? new Date(Math.max(...times)) : null;
  }, [quotes]);

  // Nothing to compare is a normal state, not an error: the table simply does
  // not appear rather than rendering an empty shell.
  if (!loading && rows.length === 0) return null;

  return (
    <section className="py-10 md:py-16 bg-muted/20" aria-labelledby="unlisted-compare-heading">
      <div className="container mx-auto px-4">
        <motion.div className="text-center mb-8" {...revealSection}>
          <span className="inline-flex items-center gap-1.5 text-secondary font-semibold text-xs uppercase tracking-wider mb-3">
            <Scale className="w-3.5 h-3.5" /> Rate Comparison
          </span>
          <h2
            id="unlisted-compare-heading"
            className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-3"
          >
            How Our Rates Compare
          </h2>
          <motion.div
            className="w-20 h-1 bg-gradient-to-r from-secondary to-brand-gold mx-auto rounded-full mb-4"
            {...revealBar}
          />
          <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
            Indicative rates other dealers publish for the same companies, collected automatically
            each morning. Shown for reference only — every dealer quotes on their own terms, lot
            size and settlement.
          </p>
        </motion.div>

        {loading ? (
          <div className="max-w-4xl mx-auto space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <caption className="sr-only">
                  Indicative unlisted share rates from Parasram and other dealers
                </caption>
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th scope="col" className="text-left font-semibold text-foreground px-4 py-3">
                      Company
                    </th>
                    <th scope="col" className="text-right font-semibold text-secondary px-4 py-3 whitespace-nowrap">
                      Parasram
                    </th>
                    {sources.map(([name]) => (
                      <th
                        key={name}
                        scope="col"
                        className="text-right font-semibold text-muted-foreground px-4 py-3 whitespace-nowrap"
                      >
                        {name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.key} className="border-b border-border/50 last:border-0">
                      <th scope="row" className="text-left font-medium text-foreground px-4 py-3">
                        {row.label}
                      </th>
                      <td
                        className={`text-right px-4 py-3 whitespace-nowrap tabular-nums ${
                          row.ourPrice !== null && row.ourPrice === row.best
                            ? "font-bold text-secondary"
                            : "text-foreground"
                        }`}
                      >
                        {row.ourPrice !== null ? inr(row.ourPrice) : "—"}
                      </td>
                      {sources.map(([name]) => {
                        const q = row.quotes.find((x) => x.source === name);
                        return (
                          <td
                            key={name}
                            className={`text-right px-4 py-3 whitespace-nowrap tabular-nums ${
                              q && q.price === row.best
                                ? "font-bold text-foreground"
                                : "text-muted-foreground"
                            }`}
                          >
                            {q ? inr(q.price) : "—"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-col sm:flex-row sm:items-start gap-3 text-xs text-muted-foreground">
              <Info className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <p>
                A dash means that dealer does not publish a rate for that company, or the name could
                not be matched with confidence.{" "}
                {collectedAt && (
                  <>
                    Collected{" "}
                    <time dateTime={collectedAt.toISOString()}>
                      {collectedAt.toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </time>
                    .{" "}
                  </>
                )}
                Sources:{" "}
                {sources.map(([name, url], i) => (
                  <span key={name}>
                    {i > 0 && ", "}
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="text-secondary font-semibold hover:underline inline-flex items-center gap-0.5"
                    >
                      {name}
                      <ExternalLink className="w-3 h-3" aria-hidden="true" />
                    </a>
                  </span>
                ))}
                . Parasram rates are our own desk quotes — call us to confirm before dealing.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default UnlistedPriceComparison;

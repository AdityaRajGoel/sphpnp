import { motion, AnimatePresence } from "motion/react";
import { useState, useEffect, useCallback } from "react";
import {
  Calendar, TrendingUp, ArrowUpRight, ArrowDownRight,
  ChevronRight, Rocket, CheckCircle2, Timer, Hourglass, IndianRupee,
  RefreshCw, Loader2
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

import { revealBar, revealItem, revealSection } from "@/lib/motion";
import { formatGmp, formatGmpPercent, formatListingGain, formatSourceList, formatSubscription, gmpPercent, type Ipo } from "@/lib/ipo";
import { trackerTab } from "@/lib/ipo-filters";

/** The reconciled catalogue row plus the two display-only fields derived from it. */
type DisplayIpo = Ipo & { listingGain: string | null };

type TabKey = Ipo["status"];

const tabs: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: "upcoming", label: "Upcoming", icon: Timer },
  { key: "open", label: "Open Now", icon: Rocket },
  { key: "closed", label: "Closed", icon: Hourglass },
  { key: "listed", label: "Recently Listed", icon: CheckCircle2 },
];

const IPOCard = ({ ipo, index }: { ipo: DisplayIpo; index: number }) => (
  <motion.div
    className="bg-card border border-border/50 rounded-xl p-4 hover:shadow-lg hover:border-brand-orange/30 transition-[box-shadow,color,background-color,border-color] cursor-pointer group"
    {...revealItem()}
    transition={{ delay: index * 0.06 }}
    whileHover={{ y: -3 }}
  >
    <div className="flex items-start justify-between mb-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-sm font-bold text-foreground truncate group-hover:text-brand-orange transition-colors">{ipo.name}</h3>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${ipo.type === "Mainboard" ? "bg-primary/10 text-primary" : "bg-brand-gold/10 text-brand-gold"}`}>
            {ipo.type}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <Calendar className="w-3 h-3" />
          <span>{ipo.date}</span>
        </div>
      </div>
    </div>

    <div className="grid grid-cols-3 gap-3">
      <div>
        <div className="text-[10px] text-muted-foreground mb-0.5">Price Band</div>
        <div className="text-xs font-bold text-foreground">{ipo.price}</div>
      </div>
      <div>
        <div className="text-[10px] text-muted-foreground mb-0.5">Issue Size</div>
        <div className="text-xs font-bold text-foreground">{ipo.size}</div>
      </div>
      <div>
        {ipo.status === "listed" && ipo.listingGain !== null ? (
          <>
            <div className="text-[10px] text-muted-foreground mb-0.5">Listing Gain</div>
            <div className={`text-xs font-bold flex items-center gap-0.5 ${ipo.listingGain.startsWith("-") ? "text-destructive" : "text-secondary"}`}>
              {ipo.listingGain.startsWith("-") ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
              {ipo.listingGain}
            </div>
          </>
        ) : (
          <>
            <div className="text-[10px] text-muted-foreground mb-0.5">GMP</div>
            <div className={`text-xs font-bold flex items-center gap-0.5 ${ipo.gmp === null ? "text-muted-foreground" : ipo.gmp >= 0 ? "text-secondary" : "text-destructive"}`}>
              {ipo.gmp !== null && (ipo.gmp >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />)}
              {formatGmp(ipo.gmp)}
              {gmpPercent(ipo) !== null && <span className="font-medium">({formatGmpPercent(gmpPercent(ipo))})</span>}
            </div>
          </>
        )}
      </div>
    </div>

    {ipo.subscription_total !== null && (
      <div className="mt-2 text-[10px] text-muted-foreground">
        Subscribed <span className="font-bold text-foreground">{formatSubscription(ipo.subscription_total)}</span>
      </div>
    )}

    {(ipo.status === "open" || ipo.status === "closed") && (
      <motion.div className="mt-3 pt-3 border-t border-border/30">
        <Link
          to={ipo.slug ? `/ipo/${ipo.slug}` : "/ipo"}
          className="inline-flex items-center gap-1.5 btn-shine bg-gradient-to-r from-secondary to-brand-green text-secondary-foreground text-[11px] font-bold px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity"
        >
          <IndianRupee className="w-3 h-3" />
          View details
          <ChevronRight className="w-3 h-3" />
        </Link>
      </motion.div>
    )}
  </motion.div>
);

type FetchIposResponse = { success: boolean; ipos?: Ipo[]; error?: string; fetchedAt?: string };

const IPOTracker = () => {
  const [activeTab, setActiveTab] = useState<TabKey>("upcoming");
  const [ipos, setIpos] = useState<DisplayIpo[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<string>("");
  const [fetchedAt, setFetchedAt] = useState<string>("");

  const fetchIPOs = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke<FetchIposResponse>('fetch-ipos');
      // Status is derived server-side by fetch-ipos from the stored ISO dates
      // (see supabase/functions/_shared/ipo-status.ts) — trusted as-is rather
      // than re-derived here from the formatted date string, which used to
      // miscategorise every "closed" (bidding shut, not yet listed) issue.
      if (!error && data?.success && data.ipos && data.ipos.length > 0) {
        setIpos(data.ipos.map((ipo) => ({ ...ipo, listingGain: formatListingGain(ipo.listing_gain_pct) })));
        setSource(formatSourceList(data.ipos.map((ipo) => ipo.source).join("+")));
        setFetchedAt(data.fetchedAt || "");
      }
    } catch {
      // fall through to the fallback list
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIPOs();
  }, [fetchIPOs]);

  // "Recently Listed" is held to the last 30 days: the catalogue reaches back
  // months, and a tab of that name must not open on an issue from April.
  const now = new Date();
  const filtered = trackerTab(ipos, activeTab, now);
  const tabCounts: Record<TabKey, number> = {
    upcoming: trackerTab(ipos, "upcoming", now).length,
    open: trackerTab(ipos, "open", now).length,
    closed: trackerTab(ipos, "closed", now).length,
    listed: trackerTab(ipos, "listed", now).length,
  };

  return (
    <section id="ipo-corner" className="py-8 md:py-16 bg-muted/20 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-gradient-to-br from-brand-orange/5 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <motion.div className="text-center mb-10" {...revealSection}>
          <motion.span className="inline-flex items-center gap-1.5 bg-brand-orange/10 text-brand-orange text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full mb-3">
            <Rocket className="w-3.5 h-3.5" />
            IPO Central
          </motion.span>
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-2">IPO Tracker</h2>
          <p className="text-muted-foreground text-sm max-w-lg mx-auto">
            Track upcoming, open, and recently listed IPOs with GMP updates
          </p>
          <motion.div className="w-20 h-1 bg-gradient-to-r from-brand-orange to-brand-gold mx-auto rounded-full mt-3" {...revealBar} />
          {fetchedAt && (
            <div className="flex items-center justify-center gap-2 mt-3 text-[10px] text-muted-foreground">
              <span>Last updated: {new Date(fetchedAt).toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}</span>
              {source && <><span>•</span><span>Reconciled from {source}</span></>}
              <button onClick={fetchIPOs} className="ml-1 p-0.5 rounded hover:bg-muted transition-colors" title="Refresh">
                <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          )}
        </motion.div>

        {/* Tabs */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors ${
                  activeTab === tab.key
                    ? "bg-brand-orange text-white shadow-lg shadow-brand-orange/30"
                    : "bg-card border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === tab.key ? "bg-white/20" : "bg-muted"}`}>
                  {tabCounts[tab.key]}
                </span>
              </button>
            );
          })}
        </div>

        {/* IPO Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-8 md:py-16">
            <Loader2 className="w-6 h-6 animate-spin text-brand-orange" />
            <span className="ml-2 text-sm text-muted-foreground">Loading IPO data...</span>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid md:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {filtered.length > 0 ? filtered.map((ipo, i) => (
                <IPOCard key={ipo.id} ipo={ipo} index={i} />
              )) : (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  <p className="text-sm">No {activeTab} IPOs at the moment.</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}

        {/* How to apply - compact 4-step strip (parent-site pattern) */}
        <motion.div
          className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-3"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-40px" }}
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.12 } } }}
        >
          {[
            { num: "01", title: "Open a Demat A/c", desc: "Free with Parasram India - ready in 1-2 days" },
            { num: "02", title: "Pick an IPO", desc: "Track open & upcoming issues with GMP above" },
            { num: "03", title: "Apply via UPI/ASBA", desc: "Funds stay blocked in your bank till allotment" },
            { num: "04", title: "Allotment & Listing", desc: "Shares credit to your Demat on allotment" },
          ].map((s) => (
            <motion.div
              key={s.num}
              className="relative bg-card border border-border/50 rounded-xl p-4 hover:border-brand-orange/40 hover:shadow-md transition-[color,background-color,border-color,box-shadow]"
              variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } }}
            >
              <span className="absolute -top-2.5 left-4 text-[10px] font-bold bg-brand-orange text-white px-2 py-0.5 rounded-full">
                Step {s.num}
              </span>
              <h4 className="font-heading text-sm font-bold text-foreground mt-2 mb-1">{s.title}</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* CTA */}
        <motion.div className="mt-8 text-center" {...revealItem()}>
          <p className="text-sm text-muted-foreground mb-3">
            Want to apply for IPOs? Open your Demat account with Parasram India today.
          </p>
          <Link
            to="/ipo"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-brand-orange to-brand-gold text-white font-bold text-sm px-6 py-3 rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-brand-orange/20"
          >
            <TrendingUp className="w-4 h-4" />
            Explore IPO tracker
            <ChevronRight className="w-4 h-4" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

export default IPOTracker;

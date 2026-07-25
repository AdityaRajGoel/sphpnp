import { motion, AnimatePresence } from "motion/react";
import { useState, useEffect, useCallback } from "react";
import {
  Calendar, TrendingUp, ArrowUpRight, ArrowDownRight,
  ChevronRight, Rocket, CheckCircle2, Timer, Star, IndianRupee,
  RefreshCw, Loader2
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

type IPO = {
  name: string;
  price: string;
  date: string;
  size: string;
  status: "upcoming" | "open" | "listed";
  gmp?: string;
  gmpUp?: boolean;
  listingGain?: string;
  listingUp?: boolean;
  rating?: number;
  type: "Mainboard" | "SME";
};

type TabKey = "upcoming" | "open" | "listed";

const tabs: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: "upcoming", label: "Upcoming", icon: Timer },
  { key: "open", label: "Open Now", icon: Rocket },
  { key: "listed", label: "Recently Listed", icon: CheckCircle2 },
];

const IPOCard = ({ ipo, index }: { ipo: IPO; index: number }) => (
  <motion.div
    className="bg-card border border-border/50 rounded-xl p-4 hover:shadow-lg hover:border-brand-orange/30 transition-[box-shadow,color,background-color,border-color] cursor-pointer group"
    initial={{ opacity: 0, y: 16 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
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
      {ipo.rating && (
        <div className="flex items-center gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className={`w-3 h-3 ${i < ipo.rating! ? "text-brand-gold fill-brand-gold" : "text-muted"}`} />
          ))}
        </div>
      )}
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
        {ipo.status === "listed" && ipo.listingGain ? (
          <>
            <div className="text-[10px] text-muted-foreground mb-0.5">Listing Gain</div>
            <div className={`text-xs font-bold flex items-center gap-0.5 ${ipo.listingUp ? "text-secondary" : "text-destructive"}`}>
              {ipo.listingUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {ipo.listingGain}
            </div>
          </>
        ) : (
          <>
            <div className="text-[10px] text-muted-foreground mb-0.5">GMP</div>
            <div className={`text-xs font-bold flex items-center gap-0.5 ${ipo.gmpUp ? "text-secondary" : "text-destructive"}`}>
              {ipo.gmpUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {ipo.gmp}
            </div>
          </>
        )}
      </div>
    </div>

    {ipo.status === "open" && (
      <motion.div className="mt-3 pt-3 border-t border-border/30">
        <a
          href="/open-account"
          className="inline-flex items-center gap-1.5 btn-shine bg-gradient-to-r from-secondary to-brand-green text-secondary-foreground text-[11px] font-bold px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity"
        >
          <IndianRupee className="w-3 h-3" />
          Apply Now
          <ChevronRight className="w-3 h-3" />
        </a>
      </motion.div>
    )}
  </motion.div>
);

const IPOTracker = () => {
  const [activeTab, setActiveTab] = useState<TabKey>("upcoming");
  const [ipos, setIpos] = useState<IPO[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<string>("");
  const [fetchedAt, setFetchedAt] = useState<string>("");

  const fetchIPOs = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-ipos');
      if (!error && data?.success && data.ipos?.length > 0) {
        // Dynamically recalculate status based on current date
        const now = new Date();
        const currentYear = now.getFullYear();
        const months: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
        
        const processedIpos = data.ipos.map((ipo: IPO) => {
          let calculatedStatus = ipo.status;
          
          if (ipo.date && ipo.date !== 'TBA') {
            let dateRange = ipo.date.match(/(\d{1,2})\s*[-–]\s*(\d{1,2})\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i);
            if (!dateRange) {
              const altRange = ipo.date.match(/(\d{1,2})\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*[-–]\s*(\d{1,2})\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i);
              if (altRange) {
                dateRange = [altRange[0], altRange[1], altRange[3], altRange[4]];
              }
            }

            if (dateRange) {
              const monthNum = months[dateRange[3].toLowerCase()];
              const startDay = parseInt(dateRange[1]);
              const endDay = parseInt(dateRange[2]);
              
              const startDate = new Date(currentYear, monthNum, startDay);
              const endDate = new Date(currentYear, monthNum, endDay, 23, 59, 59);

              if (now >= startDate && now <= endDate) {
                calculatedStatus = 'open';
              } else if (now > endDate) {
                calculatedStatus = 'listed';
              } else {
                calculatedStatus = 'upcoming';
              }
            }
          }
          
          return { ...ipo, status: calculatedStatus };
        });

        setIpos(processedIpos);
        setSource(data.source || "");
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

  const filtered = ipos.filter(i => i.status === activeTab);
  const tabCounts = {
    upcoming: ipos.filter(i => i.status === "upcoming").length,
    open: ipos.filter(i => i.status === "open").length,
    listed: ipos.filter(i => i.status === "listed").length,
  };

  return (
    <section className="py-8 md:py-16 bg-muted/20 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-gradient-to-br from-brand-orange/5 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <motion.div className="text-center mb-10" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <motion.span className="inline-flex items-center gap-1.5 bg-brand-orange/10 text-brand-orange text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full mb-3">
            <Rocket className="w-3.5 h-3.5" />
            IPO Central
          </motion.span>
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-2">IPO Tracker</h2>
          <p className="text-muted-foreground text-sm max-w-lg mx-auto">
            Track upcoming, open, and recently listed IPOs with GMP updates
          </p>
          <motion.div className="w-20 h-1 bg-gradient-to-r from-brand-orange to-brand-gold mx-auto rounded-full mt-3" initial={{ width: 0 }} whileInView={{ width: 80 }} viewport={{ once: true }} transition={{ delay: 0.3, duration: 0.6 }} />
          {fetchedAt && (
            <div className="flex items-center justify-center gap-2 mt-3 text-[10px] text-muted-foreground">
              <span>Last updated: {new Date(fetchedAt).toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}</span>
              <span>•</span>
              <span className="capitalize">{source} data</span>
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
                <IPOCard key={ipo.name} ipo={ipo} index={i} />
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
        <motion.div className="mt-8 text-center" initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <p className="text-sm text-muted-foreground mb-3">
            Want to apply for IPOs? Open your Demat account with Parasram India today.
          </p>
          <a
            href="/open-account"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-brand-orange to-brand-gold text-white font-bold text-sm px-6 py-3 rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-brand-orange/20"
          >
            <TrendingUp className="w-4 h-4" />
            Open Free Demat Account
            <ChevronRight className="w-4 h-4" />
          </a>
        </motion.div>
      </div>
    </section>
  );
};

export default IPOTracker;

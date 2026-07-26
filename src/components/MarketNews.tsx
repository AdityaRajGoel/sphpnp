import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Newspaper, Globe, TrendingUp, Clock, ChevronRight, RefreshCw, Search, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

import { revealItem, revealSection } from "@/lib/motion";
type NewsItem = {
  title: string;
  summary: string;
  category: string;
  timeAgo: string;
  timestamp?: string;
  source: string;
  url?: string;
};

const fallbackIndian: NewsItem[] = [
  { title: "Sensex rallies 400 pts as IT stocks surge on strong Q4 results", summary: "Benchmark indices rose sharply led by gains in IT heavyweights after better-than-expected quarterly earnings.", category: "Markets", timeAgo: "2h ago", source: "Economic Times" },
  { title: "RBI keeps repo rate unchanged at 6.5% for eighth consecutive time", summary: "The central bank maintained its accommodative stance citing inflation concerns and global uncertainty.", category: "Policy", timeAgo: "4h ago", source: "LiveMint" },
  { title: "Reliance Industries crosses ₹20 lakh crore market cap milestone", summary: "The conglomerate became the first Indian company to achieve this historic valuation.", category: "Business", timeAgo: "5h ago", source: "Moneycontrol" },
  { title: "FIIs turn net buyers, pump ₹3,500 crore into Indian equities", summary: "Foreign institutional investors reversed their selling trend amid improved global risk appetite.", category: "Markets", timeAgo: "6h ago", source: "NDTV Profit" },
  { title: "India's GDP growth projected at 7.2% for FY26 by IMF", summary: "The International Monetary Fund raised India's growth forecast citing strong domestic demand.", category: "Economy", timeAgo: "8h ago", source: "Business Standard" },
  { title: "HDFC Bank reports 20% jump in net profit for Q4 FY25", summary: "The private lender posted strong results with improved asset quality and loan growth.", category: "Banking", timeAgo: "10h ago", source: "Financial Express" },
];

const fallbackWorld: NewsItem[] = [
  { title: "Fed signals potential rate cut in September amid cooling inflation", summary: "Federal Reserve Chair hinted at easing monetary policy as US inflation shows signs of moderating.", category: "Global", timeAgo: "1h ago", source: "Reuters" },
  { title: "Wall Street hits record high as tech stocks lead broad rally", summary: "S&P 500 and Nasdaq reached new all-time highs driven by AI-related tech gains.", category: "Markets", timeAgo: "3h ago", source: "Bloomberg" },
  { title: "Crude oil prices drop 3% on rising US inventory data", summary: "Brent crude fell below $80/barrel as unexpected build in US crude stockpiles weighed on prices.", category: "Commodities", timeAgo: "4h ago", source: "CNBC" },
  { title: "European markets close higher on positive economic data", summary: "Major European indices rallied after strong PMI data suggested economic recovery.", category: "Global", timeAgo: "6h ago", source: "Financial Times" },
  { title: "Bitcoin surges past $70,000 as institutional adoption grows", summary: "The largest cryptocurrency hit new highs amid increasing ETF inflows and institutional interest.", category: "Tech", timeAgo: "7h ago", source: "CoinDesk" },
  { title: "Bank of Japan maintains ultra-loose monetary policy stance", summary: "BOJ kept interest rates negative despite growing pressure to normalize monetary policy.", category: "Policy", timeAgo: "9h ago", source: "Nikkei Asia" },
];

const categoryColors: Record<string, string> = {
  Markets: "bg-secondary/20 text-secondary",
  Economy: "bg-brand-gold/20 text-brand-gold",
  Business: "bg-primary/10 text-primary",
  Policy: "bg-destructive/10 text-destructive",
  Banking: "bg-brand-lightBlue/20 text-brand-lightBlue",
  Tech: "bg-accent/60 text-accent-foreground",
  Global: "bg-brand-navy/20 text-brand-navy",
  Commodities: "bg-brand-green/20 text-brand-green",
};

// Only allow http(s) links through to href (defends against javascript:/data:).
const safeUrl = (url?: string): string | undefined =>
  url && /^https?:\/\//i.test(url) ? url : undefined;

// Stories younger than this get a live "fresh" pulse dot.
const FRESH_WINDOW_MS = 60 * 60 * 1000;
const isFresh = (item: NewsItem): boolean =>
  !!item.timestamp && Date.now() - new Date(item.timestamp).getTime() < FRESH_WINDOW_MS;

// Cards shown before the "Show more" button reveals the rest.
const INITIAL_GRID_COUNT = 9;

// Live "x ago" label from a timestamp, falling back to the pre-baked string.
function useTimeAgo(item: NewsItem): string {
  const [display, setDisplay] = useState(item.timeAgo);
  useEffect(() => {
    if (!item.timestamp) return;
    const update = () => {
      const diffHrs = (Date.now() - new Date(item.timestamp!).getTime()) / 3_600_000;
      if (diffHrs < 1) setDisplay(`${Math.max(0, Math.floor(diffHrs * 60))}m ago`);
      else if (diffHrs < 24) setDisplay(`${Math.floor(diffHrs)}h ago`);
      else setDisplay(`${Math.floor(diffHrs / 24)}d ago`);
    };
    update();
    const interval = setInterval(update, 60_000);
    return () => clearInterval(interval);
  }, [item.timestamp, item.timeAgo]);
  return display;
}

const CategoryTag = ({ category }: { category: string }) => (
  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${categoryColors[category] || "bg-muted text-muted-foreground"}`}>
    {category}
  </span>
);

// Featured lead story — larger, top of the feed (Moneycontrol-style hero).
const FeaturedCard = ({ item }: { item: NewsItem }) => {
  const displayTime = useTimeAgo(item);
  const href = safeUrl(item.url);
  const Wrapper = href ? "a" : "div";
  const linkProps = href ? { href, target: "_blank", rel: "noopener noreferrer" } : {};
  return (
    <motion.div {...revealItem()}>
      <Card className="group overflow-hidden border-border/50 hover:border-secondary/40 hover:shadow-xl transition-[color,background-color,border-color,box-shadow] duration-base">
        <Wrapper {...linkProps} className="block">
          <CardContent className="p-5 md:p-7">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">Top Story</span>
              <CategoryTag category={item.category} />
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />{displayTime}
              </span>
            </div>
            <h3 className="font-heading font-bold text-xl md:text-2xl text-foreground leading-tight group-hover:text-secondary transition-colors">
              {item.title}
            </h3>
            <p className="text-sm md:text-base text-muted-foreground mt-2.5 line-clamp-3 max-w-3xl">{item.summary}</p>
            <div className="flex items-center gap-2 mt-4 text-xs font-semibold text-muted-foreground">
              <span>{item.source}</span>
              {href && <span className="inline-flex items-center gap-1 text-secondary">Read <ExternalLink className="w-3 h-3 transition-transform duration-fast ease-out group-hover:translate-x-0.5" /></span>}
            </div>
          </CardContent>
        </Wrapper>
      </Card>
    </motion.div>
  );
};

const NewsCard = ({ item, index }: { item: NewsItem; index: number }) => {
  const displayTime = useTimeAgo(item);
  const href = safeUrl(item.url);
  const Wrapper = href ? "a" : "div";
  const linkProps = href ? { href, target: "_blank", rel: "noopener noreferrer" } : {};
  return (
    <motion.div {...revealSection} transition={{ delay: Math.min(index, 6) * 0.06, duration: 0.4 }}>
      <Card className="h-full bg-card hover:shadow-lg hover:border-secondary/30 transition-[box-shadow,color,background-color,border-color] duration-base group border-border/50">
        <Wrapper {...linkProps} className="block h-full">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <CategoryTag category={item.category} />
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />{displayTime}
                  </span>
                  {isFresh(item) && (
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold text-secondary uppercase">
                      <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />New
                    </span>
                  )}
                </div>
                <h3 className="font-heading font-semibold text-sm text-foreground leading-snug group-hover:text-secondary transition-colors line-clamp-2">
                  {item.title}
                </h3>
                <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{item.summary}</p>
                <p className="text-[10px] text-muted-foreground/60 mt-2 font-medium flex items-center gap-1">
                  {item.source}{href && <ExternalLink className="w-2.5 h-2.5" />}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-secondary transition-colors flex-shrink-0 mt-1" />
            </div>
          </CardContent>
        </Wrapper>
      </Card>
    </motion.div>
  );
};

const MarketNews = () => {
  const [activeTab, setActiveTab] = useState<"indian" | "world">("indian");
  const [indianNews, setIndianNews] = useState<NewsItem[]>(fallbackIndian);
  const [worldNews, setWorldNews] = useState<NewsItem[]>(fallbackWorld);
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeSource, setActiveSource] = useState("All");
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);

  const fetchNews = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-news");
      if (!error && data?.success) {
        if (data.indian?.length > 0) setIndianNews(data.indian);
        if (data.world?.length > 0) setWorldNews(data.world);
      }
    } catch {
      // fall through to fallback content
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
    const interval = setInterval(() => {
      if (!document.hidden) fetchNews();
    }, 5 * 60 * 1000);
    const handleVisibility = () => { if (!document.hidden) fetchNews(); };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  const news = activeTab === "indian" ? indianNews : worldNews;

  // Category chips from whatever the feed actually returned for this tab.
  const categories = useMemo(() => {
    const seen = new Set<string>();
    news.forEach((n) => seen.add(n.category));
    return ["All", ...[...seen].sort()];
  }, [news]);

  // Source dropdown options from the live feed for this tab.
  const sources = useMemo(() => {
    const seen = new Set<string>();
    news.forEach((n) => n.source && seen.add(n.source));
    return ["All", ...[...seen].sort()];
  }, [news]);

  // Reset filters when they no longer exist in the current tab.
  useEffect(() => {
    if (activeCategory !== "All" && !categories.includes(activeCategory)) setActiveCategory("All");
  }, [categories, activeCategory]);
  useEffect(() => {
    if (activeSource !== "All" && !sources.includes(activeSource)) setActiveSource("All");
  }, [sources, activeSource]);

  // Collapse the expanded grid whenever the view changes.
  useEffect(() => {
    setShowAll(false);
  }, [activeTab, activeCategory, activeSource, query]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return news.filter((n) => {
      if (activeCategory !== "All" && n.category !== activeCategory) return false;
      if (activeSource !== "All" && n.source !== activeSource) return false;
      if (q && !(n.title.toLowerCase().includes(q) || n.summary.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [news, activeCategory, activeSource, query]);

  const [featured, ...rest] = filtered;
  const visibleRest = showAll ? rest : rest.slice(0, INITIAL_GRID_COUNT);
  const hiddenCount = rest.length - visibleRest.length;

  return (
    <section id="news" className="py-12 md:py-20 bg-background relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 right-10 w-80 h-80 bg-secondary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-10 w-96 h-96 bg-brand-gold/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <motion.div className="text-center mb-8" {...revealSection}>
          <span className="inline-block text-secondary font-semibold text-sm uppercase tracking-wider mb-3">Stay Informed</span>
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-4">Market News &amp; Updates</h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">Latest financial news from India and around the world</p>
        </motion.div>

        {/* Tab switcher + refresh */}
        <div className="flex items-center justify-center gap-2 mb-5">
          <div className="inline-flex bg-muted rounded-xl p-1 border border-border/50">
            <button onClick={() => setActiveTab("indian")} className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors duration-base ${activeTab === "indian" ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground"}`}>
              <TrendingUp className="w-4 h-4" />India
            </button>
            <button onClick={() => setActiveTab("world")} className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors duration-base ${activeTab === "world" ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground"}`}>
              <Globe className="w-4 h-4" />World
            </button>
          </div>
          <Button variant="ghost" size="icon" onClick={fetchNews} disabled={loading} className="ml-1" aria-label="Refresh news">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* Category chips + search (Moneycontrol-style filter bar) */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-8">
          <div className="flex gap-2 overflow-x-auto pb-1 flex-1 -mb-1">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`shrink-0 text-xs font-semibold px-3.5 py-1.5 rounded-full border transition-colors ${activeCategory === cat ? "bg-secondary text-secondary-foreground border-secondary" : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-secondary/40"}`}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="flex gap-2 shrink-0">
            <select
              value={activeSource}
              onChange={(e) => setActiveSource(e.target.value)}
              aria-label="Filter by news source"
              className="h-9 rounded-md border border-input bg-card px-2.5 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring max-w-[150px]"
            >
              {sources.map((s) => (
                <option key={s} value={s}>{s === "All" ? "All Sources" : s}</option>
              ))}
            </select>
            <div className="relative w-full lg:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search headlines..." className="pl-9 h-9 text-sm" aria-label="Search news headlines" />
            </div>
          </div>
        </div>

        {/* Feed */}
        <AnimatePresence mode="wait">
          <motion.div key={`${activeTab}-${activeCategory}-${activeSource}-${query}`} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}>
            {filtered.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Newspaper className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="font-semibold">No stories match your filter</p>
                <p className="text-sm">Try a different category or clear the search</p>
              </div>
            ) : (
              <>
                {featured && <div className="mb-4"><FeaturedCard item={featured} /></div>}
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {visibleRest.map((item, i) => (
                    <NewsCard key={`${activeTab}-${item.title}-${i}`} item={item} index={i} />
                  ))}
                </div>
                {hiddenCount > 0 && (
                  <div className="flex justify-center mt-6">
                    <Button variant="outline" size="sm" onClick={() => setShowAll(true)} className="gap-1.5">
                      Show {hiddenCount} more stories
                    </Button>
                  </div>
                )}
              </>
            )}
          </motion.div>
        </AnimatePresence>

        <p className="text-center text-xs text-muted-foreground/50 mt-8">
          <Newspaper className="w-3 h-3 inline mr-1" />
          News auto-refreshes every 5 minutes • Sources: ET, Moneycontrol, Business Standard, LiveMint, Reuters, Bloomberg
        </p>
      </div>
    </section>
  );
};

export default MarketNews;

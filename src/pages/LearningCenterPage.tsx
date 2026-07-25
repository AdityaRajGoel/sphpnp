import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useT } from "@/i18n/LanguageContext";
import VisibleBreadcrumbs from "@/components/VisibleBreadcrumbs";
import SEOHead from "@/components/SEOHead";
import PageTransition from "@/components/PageTransition";
import WhatsAppButton from "@/components/WhatsAppButton";
import ScrollProgress from "@/components/ScrollProgress";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { LEARN_ARTICLES } from "@/data/learnContent";
import { motion, AnimatePresence } from "motion/react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, Search, Clock, ChevronRight, TrendingUp, GraduationCap, BarChart3, Shield, ExternalLink, Newspaper, Radio, RefreshCw, Globe, IndianRupee, AlertTriangle, Star, CheckCircle2, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Article = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: string;
  cover_image: string | null;
  read_time: number;
  published: boolean;
  created_at: string;
  source?: string;
  source_url?: string;
  difficulty?: "Beginner" | "Intermediate" | "Advanced";
  featured?: boolean;
};

type NewsItem = {
  title: string;
  summary: string;
  category: string;
  timeAgo: string;
  source: string;
};

const CATEGORIES = [
  { key: "all", label: "All", icon: BookOpen },
  { key: "basics", label: "Basics", icon: GraduationCap },
  { key: "trading", label: "Trading", icon: TrendingUp },
  { key: "analysis", label: "Analysis", icon: BarChart3 },
  { key: "investing", label: "Investing", icon: Shield },
];

const REAL_ARTICLES: Article[] = [
  {
    id: "r21", title: "Full-Service vs Discount Broker: Which to Pick?", slug: "full-service-vs-discount-broker",
    excerpt: "Flat-fee app or a broker who picks up the phone? Compare costs, research, call-to-trade and support to find what fits your investing style.",
    content: "", category: "basics", cover_image: null, read_time: 7, published: true, created_at: "2026-07-10",
    source: "Parasram Research", source_url: "",
    difficulty: "Beginner", featured: true,
  },
  {
    id: "r22", title: "Tax on Share Market Income: STCG, LTCG & F&O", slug: "tax-on-share-market-income",
    excerpt: "20% STCG, 12.5% LTCG above ₹1.25 lakh, F&O as business income - how every type of market income is taxed in India, with a compliance checklist.",
    content: "", category: "investing", cover_image: null, read_time: 8, published: true, created_at: "2026-07-10",
    source: "Parasram Research", source_url: "",
    difficulty: "Intermediate", featured: true,
  },
  {
    id: "r23", title: "How to Buy Unlisted Shares in India", slug: "how-to-buy-unlisted-shares",
    excerpt: "Off-market transfers, negotiated pricing, the 6-month post-IPO lock-in and 24-month LTCG rule - the full process and risks of pre-IPO investing.",
    content: "", category: "investing", cover_image: null, read_time: 7, published: true, created_at: "2026-07-10",
    source: "Parasram Research", source_url: "",
    difficulty: "Intermediate",
  },
  {
    id: "r24", title: "Futures & Options (F&O) Basics for Beginners", slug: "fno-basics",
    excerpt: "Lots, expiry, SPAN margins, CE/PE premiums and the SEBI loss study - what every beginner should know before touching derivatives.",
    content: "", category: "trading", cover_image: null, read_time: 8, published: true, created_at: "2026-07-10",
    source: "Parasram Research", source_url: "",
    difficulty: "Intermediate",
  },
  {
    id: "r25", title: "What is MTF? Margin Trading Facility Explained", slug: "margin-trading-facility-mtf",
    excerpt: "Buy delivery stocks by paying part of the value while your broker funds the rest. How pledging, interest and margin calls actually work.",
    content: "", category: "trading", cover_image: null, read_time: 6, published: true, created_at: "2026-07-10",
    source: "Parasram Research", source_url: "",
    difficulty: "Intermediate",
  },
  {
    id: "r1", title: "What is a Demat Account?", slug: "demat-account",
    excerpt: "A demat account holds your shares in electronic format. Learn how it works, how to open one, and why it's essential for stock market investing in India.",
    content: "", category: "basics", cover_image: null, read_time: 5, published: true, created_at: "2025-12-01",
    source: "Parasram Research", source_url: "",
    difficulty: "Beginner", featured: true,
  },
  {
    id: "r2", title: "Understanding P/E Ratio: How to Value Stocks", slug: "pe-ratio",
    excerpt: "The P/E ratio is the most widely used valuation metric. Learn how to interpret it to evaluate whether a stock is cheap or expensive relative to earnings.",
    content: "", category: "analysis", cover_image: null, read_time: 7, published: true, created_at: "2025-11-28",
    source: "Parasram Research", source_url: "",
    difficulty: "Beginner", featured: true,
  },
  {
    id: "r3", title: "SIP vs Lumpsum: Which Investment Strategy Wins?", slug: "sip-vs-lumpsum",
    excerpt: "Compare rupee cost averaging through SIPs with lumpsum investing. Which strategy delivers better returns across market cycles?",
    content: "", category: "investing", cover_image: null, read_time: 8, published: true, created_at: "2025-11-25",
    source: "Parasram Research", source_url: "",
    difficulty: "Beginner",
  },
  {
    id: "r4", title: "Intraday Trading: Strategies and Risk Management", slug: "intraday-trading",
    excerpt: "Master day trading fundamentals including momentum, breakout, and scalping strategies with proper position sizing and stop-loss techniques.",
    content: "", category: "trading", cover_image: null, read_time: 10, published: true, created_at: "2025-11-22",
    source: "Investopedia", source_url: "https://www.investopedia.com/terms/d/daytrader.asp",
    difficulty: "Intermediate",
  },
  {
    id: "r5", title: "How to Read Candlestick Chart Patterns", slug: "candlestick-patterns",
    excerpt: "Master Japanese candlestick patterns - Doji, Hammer, Engulfing, Morning Star. Learn to identify trend reversals and continuations with visual examples.",
    content: "", category: "analysis", cover_image: null, read_time: 12, published: true, created_at: "2025-11-20",
    source: "Investopedia", source_url: "https://www.investopedia.com/trading/candlestick-charting-what-is-it/",
    difficulty: "Intermediate",
  },
  {
    id: "r6", title: "Mutual Funds: Types, Benefits & How to Invest", slug: "mutual-funds-guide",
    excerpt: "Everything about mutual funds - equity, debt, hybrid, index funds. Understand NAV, expense ratios, and CAGR returns. SEBI classification explained.",
    content: "", category: "basics", cover_image: null, read_time: 8, published: true, created_at: "2025-11-18",
    source: "Parasram Research", source_url: "",
    difficulty: "Beginner",
  },
  {
    id: "r7", title: "Options Trading: Calls, Puts & Basic Strategies", slug: "options-trading-101",
    excerpt: "Introduction to options - contracts, premiums, Greeks (Delta, Theta, Gamma, Vega), and basic strategies like covered calls and protective puts.",
    content: "", category: "trading", cover_image: null, read_time: 15, published: true, created_at: "2025-11-15",
    source: "Investopedia", source_url: "https://www.investopedia.com/options-basics-tutorial-4583012",
    difficulty: "Advanced",
  },
  {
    id: "r8", title: "The Power of Compounding: Why Start Early", slug: "power-of-compounding",
    excerpt: "Even small monthly investments can grow into crores over decades. Understand compound interest with real examples and the Rule of 72.",
    content: "", category: "investing", cover_image: null, read_time: 5, published: true, created_at: "2025-11-12",
    source: "Parasram Research", source_url: "",
    difficulty: "Beginner",
  },
  {
    id: "r9", title: "How to Analyse Financial Statements", slug: "financial-statements",
    excerpt: "Read balance sheets, income statements, and cash flow statements. Key ratios like ROE, ROCE, Debt-to-Equity, and current ratio explained with examples.",
    content: "", category: "analysis", cover_image: null, read_time: 14, published: true, created_at: "2025-11-10",
    source: "Investopedia", source_url: "https://www.investopedia.com/terms/f/financial-statements.asp",
    difficulty: "Intermediate",
  },
  {
    id: "r10", title: "Index Funds vs Active Funds: Which is Better?", slug: "index-vs-active",
    excerpt: "Research shows most active funds underperform their benchmark over 10 years. Explore passive investing and when active management genuinely adds value.",
    content: "", category: "investing", cover_image: null, read_time: 7, published: true, created_at: "2025-11-08",
    source: "Investopedia", source_url: "https://www.investopedia.com/ask/answers/033015/what-difference-between-index-fund-and-actively-managed-fund.asp",
    difficulty: "Beginner",
  },
  {
    id: "r11", title: "Understanding IPO: Process, Allotment & Listing", slug: "ipo-guide",
    excerpt: "Complete guide to IPOs in India - DRHP, price bands, lot sizes, ASBA application process, GMP, listing day strategy, and grey market explained.",
    content: "", category: "basics", cover_image: null, read_time: 10, published: true, created_at: "2025-11-05",
    source: "Parasram Research", source_url: "",
    difficulty: "Beginner",
  },
  {
    id: "r12", title: "Moving Averages: SMA, EMA & Trading Signals", slug: "moving-averages",
    excerpt: "Use Simple and Exponential Moving Averages for trend identification. Golden Cross, Death Cross, and EMA crossover strategies explained with charts.",
    content: "", category: "trading", cover_image: null, read_time: 9, published: true, created_at: "2025-11-02",
    source: "Investopedia", source_url: "https://www.investopedia.com/terms/m/movingaverage.asp",
    difficulty: "Intermediate",
  },
  {
    id: "r13", title: "F&O Basics: Futures & Options for Beginners", slug: "fno-basics",
    excerpt: "Unlock the world of derivatives. Futures contracts, option buying vs selling, margin requirements, and why F&O has a higher risk profile than equities.",
    content: "", category: "trading", cover_image: null, read_time: 13, published: true, created_at: "2025-10-28",
    source: "NSE India", source_url: "https://www.nseindia.com/products/content/derivatives/equities/homepage.htm",
    difficulty: "Advanced",
  },
  {
    id: "r14", title: "Tax on Stock Market: STCG, LTCG & F&O Income", slug: "tax-on-stocks",
    excerpt: "India's complete guide to capital gains tax. Short-term (15%) vs long-term (10% above ₹1L), F&O as business income, ITR-3 filing, and advance tax.",
    content: "", category: "basics", cover_image: null, read_time: 11, published: true, created_at: "2025-10-24",
    source: "ClearTax", source_url: "https://cleartax.in/s/capital-gains-tax-on-sale-of-shares",
    difficulty: "Intermediate",
  },
  {
    id: "r15", title: "Portfolio Construction: Diversification Principles", slug: "portfolio-diversification",
    excerpt: "Build a resilient portfolio using asset allocation, modern portfolio theory, sector diversification, and rebalancing strategies that reduce risk without sacrificing returns.",
    content: "", category: "investing", cover_image: null, read_time: 10, published: true, created_at: "2025-10-20",
    source: "Investopedia", source_url: "https://www.investopedia.com/terms/d/diversification.asp",
    difficulty: "Intermediate", featured: true,
  },
  {
    id: "r16", title: "RSI, MACD & Bollinger Bands: A Practical Guide", slug: "technical-indicators",
    excerpt: "Three of the most popular technical indicators explained with real stock examples. When to trust them, when to ignore them, and how to combine signals.",
    content: "", category: "analysis", cover_image: null, read_time: 14, published: true, created_at: "2025-10-16",
    source: "Investopedia", source_url: "https://www.investopedia.com/terms/t/technicalanalysis.asp",
    difficulty: "Advanced",
  },
  {
    id: "r17", title: "Fundamental vs Technical Analysis: When to Use Which", slug: "fundamental-vs-technical",
    excerpt: "Understand the key differences between fundamental (Warren Buffett style) and technical (chart-based) analysis and how smart investors combine both.",
    content: "", category: "analysis", cover_image: null, read_time: 9, published: true, created_at: "2025-10-12",
    source: "Investopedia", source_url: "https://www.investopedia.com/ask/answers/difference-between-fundamental-and-technical-analysis/",
    difficulty: "Intermediate",
  },
  {
    id: "r18", title: "Psychology of Trading: Avoiding Common Mistakes", slug: "trading-psychology",
    excerpt: "FOMO, loss aversion, overconfidence, and revenge trading are the biggest wealth destroyers. Master your emotions for consistent trading success.",
    content: "", category: "trading", cover_image: null, read_time: 8, published: true, created_at: "2025-10-08",
    source: "Trading Psychology", source_url: "https://www.investopedia.com/articles/trading/02/soldier.asp",
    difficulty: "Beginner",
  },
  {
    id: "r19", title: "Unlisted Shares: How to Invest in Pre-IPO Companies", slug: "unlisted-shares",
    excerpt: "Access pre-IPO opportunities through the unlisted share market. How pricing works, risks, documents needed, and how Parasram facilitates these transactions.",
    content: "", category: "investing", cover_image: null, read_time: 7, published: true, created_at: "2025-10-04",
    source: "Parasram India", source_url: "/unlisted-space",
    difficulty: "Intermediate",
  },
  {
    id: "r20", title: "Risk Management: Stop-Loss, Position Sizing & R-Multiples", slug: "risk-management",
    excerpt: "Professional traders never risk more than 1-2% per trade. Learn stop-loss placement, position sizing formulas, and R-multiple tracking for consistent performance.",
    content: "", category: "trading", cover_image: null, read_time: 12, published: true, created_at: "2025-10-01",
    source: "Investopedia", source_url: "https://www.investopedia.com/articles/stocks/09/trade-stop-loss.asp",
    difficulty: "Intermediate",
  },
];

const CATEGORY_COLORS: Record<string, string> = {
  basics: "bg-primary/10 text-primary",
  trading: "bg-brand-orange/10 text-brand-orange",
  analysis: "bg-secondary/10 text-secondary",
  investing: "bg-brand-gold/10 text-brand-gold",
};

const NEWS_CATEGORY_COLORS: Record<string, string> = {
  Markets: "bg-secondary/10 text-secondary",
  Economy: "bg-brand-gold/10 text-brand-gold",
  Business: "bg-primary/10 text-primary",
  Policy: "bg-brand-orange/10 text-brand-orange",
  Banking: "bg-brand-copper/10 text-brand-copper",
  Tech: "bg-purple-500/10 text-purple-500",
  Global: "bg-blue-500/10 text-blue-500",
  Commodities: "bg-brand-gold/10 text-brand-gold",
};

const LIVE_CHANNELS = [
  {
    name: "Zee Business",
    handle: "ZeeBusiness",
    channelId: "UCkXopQ3ubd-rnXnStZqCl2w",
    description: "India's leading Hindi business news channel covering markets, economy, and corporate news"
  },
  {
    name: "CNBC Awaaz",
    handle: "CNBCAwaaz",
    channelId: "UCQIycDaLsBpMKjOCeaKUYVg",
    description: "Hindi business news with live market analysis, stock recommendations, and expert opinions"
  },
];

const LearningCenterPage = () => {
  const { t } = useT();
  const location = useLocation();
  const navigate = useNavigate();
  const [articles, setArticles] = useState<Article[]>(REAL_ARTICLES);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [difficulty, setDifficulty] = useState("all");
  const [loading, setLoading] = useState(true);
  const [readArticles, setReadArticles] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("pnp_read_articles");
      return new Set(stored ? JSON.parse(stored) : []);
    } catch { return new Set(); }
  });

  const markRead = (id: string) => {
    setReadArticles(prev => {
      const next = new Set(prev);
      next.add(id);
      try { localStorage.setItem("pnp_read_articles", JSON.stringify([...next])); } catch { /* private mode */ }
      return next;
    });
  };

  // Internal content pages (/learn/:slug) take priority; otherwise open the source.
  const openArticle = (article: Article) => {
    markRead(article.id);
    if (LEARN_ARTICLES[article.slug]) {
      navigate(`/learn/${article.slug}`);
    } else if (article.source_url) {
      if (article.source_url.startsWith("/")) navigate(article.source_url);
      else window.open(article.source_url, "_blank", "noopener,noreferrer");
    }
  };

  // Map hash to section
  const hashToSection = (hash: string): "articles" | "news" | "live" => {
    if (hash === "#news") return "news";
    if (hash === "#live-tv") return "live";
    return "articles";
  };

  const [activeSection, setActiveSection] = useState<"articles" | "news" | "live">(hashToSection(location.hash));
  const [indianNews, setIndianNews] = useState<NewsItem[]>([]);
  const [worldNews, setWorldNews] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsTab, setNewsTab] = useState<"indian" | "world">("indian");
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveEmbeds, setLiveEmbeds] = useState<Record<string, { embedUrl: string | null; watchUrl: string; title?: string | null }>>({});
  const [iframeErrors, setIframeErrors] = useState<Record<string, boolean>>({});
  // Facade pattern: the heavy YouTube player only mounts after the user clicks
  // play, so an offline/non-embeddable stream can never render a broken frame on load.
  const [activePlayers, setActivePlayers] = useState<Record<string, boolean>>({});
  const healthCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Respond to hash changes
  useEffect(() => {
    const section = hashToSection(location.hash);
    setActiveSection(section);
  }, [location.hash]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("blog_articles")
        .select("*")
        .eq("published", true)
        .order("created_at", { ascending: false });
      if (data && data.length > 0) {
        setArticles(data as Article[]);
      }
      setLoading(false);
    };
    load();
  }, []);

  const fetchNews = async () => {
    setNewsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-news');
      if (!error && data?.success) {
        setIndianNews(data.indian || []);
        setWorldNews(data.world || []);
      }
    } catch (e) {
      console.error('News fetch error:', e);
    } finally {
      setNewsLoading(false);
    }
  };

  const fetchLiveBroadcasts = async () => {
    setLiveLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-live-broadcasts');
      if (!error && data?.success && Array.isArray(data.channels)) {
        const nextEmbeds = data.channels.reduce((acc: Record<string, { embedUrl: string | null; watchUrl: string; title?: string | null }>, channel: { channelId: string; handle?: string; embedUrl?: string; watchUrl?: string; liveUrl?: string; title?: string | null }) => {
          acc[channel.channelId] = {
            // Only a resolved videoId embed is trustworthy; if none, treat as offline
            // and show the watch-on-YouTube state instead of a guaranteed-broken frame.
            embedUrl: channel.embedUrl || null,
            watchUrl: channel.watchUrl || channel.liveUrl || `https://www.youtube.com/@${channel.handle}/live`,
            title: channel.title || null,
          };
          return acc;
        }, {});
        setLiveEmbeds(nextEmbeds);
        setIframeErrors({});
      }
    } catch (e) {
      console.error('Live TV fetch error:', e);
    } finally {
      setLiveLoading(false);
    }
  };

  const handleIframeError = (channelId: string) => {
    setIframeErrors(prev => ({ ...prev, [channelId]: true }));
  };

  // Resolve broadcasts when the Live tab opens, then refresh the "now playing"
  // metadata every 2 min - but skip the refresh while a player is active so we
  // never reload a stream the user is actually watching.
  useEffect(() => {
    if (activeSection !== "live") {
      if (healthCheckRef.current) {
        clearInterval(healthCheckRef.current);
        healthCheckRef.current = null;
      }
      return;
    }

    if (Object.keys(liveEmbeds).length === 0) {
      fetchLiveBroadcasts();
    }

    healthCheckRef.current = setInterval(() => {
      setActivePlayers((current) => {
        if (Object.values(current).some(Boolean)) return current; // someone is watching
        fetchLiveBroadcasts();
        return current;
      });
    }, 120000);

    return () => {
      if (healthCheckRef.current) clearInterval(healthCheckRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch helper is stable by design; re-run only on tab switch
  }, [activeSection]);

  useEffect(() => {
    if (activeSection === "news" && indianNews.length === 0) {
      fetchNews();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on symbol/mount by design; object identities change every render
  }, [activeSection]);

  const filtered = useMemo(() => articles.filter(a => {
    const matchCat = category === "all" || a.category === category;
    const matchDiff = difficulty === "all" || (a.difficulty ?? "Beginner") === difficulty;
    const matchSearch = !search.trim() || a.title.toLowerCase().includes(search.toLowerCase()) || a.excerpt.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchDiff && matchSearch;
  }), [articles, category, search, difficulty]);

  const featuredArticles = useMemo(() => filtered.filter(a => a.featured), [filtered]);
  const regularArticles = useMemo(() => filtered.filter(a => !a.featured), [filtered]);

  const currentNews = newsTab === "indian" ? indianNews : worldNews;

  return (
    <PageTransition>
      <div className="min-h-screen bg-background">
      <SEOHead 
        title="Stock Market Learning Center | Invest Smarter | Parasram India"
        description="Learn about stock market investing, trading strategies, technical analysis, and personal finance. Free educational resources, live market news, and business TV." 
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Learning Center" },
        ]}
        jsonLd={{
          "@type": "EducationalOrganization",
          "name": "Parasram India Learning Center",
          "description": "Free stock market educational resources covering investing basics, trading strategies, technical analysis, mutual funds, F&O, and tax on capital gains.",
          "url": "https://www.sphpnp.com/learn",
          "provider": {
            "@type": "Organization",
            "name": "Shri Parasram Holdings Panipat",
            "url": "https://www.sphpnp.com"
          },
          "hasCourse": REAL_ARTICLES.slice(0, 10).map(a => ({
            "@type": "Course",
            "name": a.title,
            "description": a.excerpt,
            "educationalLevel": a.difficulty || "Beginner",
            "provider": {
              "@type": "Organization",
              "name": "Shri Parasram Holdings Panipat"
            }
          }))
        }}
      />
      <ScrollProgress />
      <Header />
      <VisibleBreadcrumbs items={[{ name: "Home", url: "/" }, { name: "Learning Center" }]} />
      <main className="container mx-auto px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <BookOpen className="w-8 h-8 text-primary" />
            <h1 className="text-3xl md:text-4xl font-heading font-bold text-foreground">{t("page.learn")}</h1>
          </div>
          <p className="text-muted-foreground">Educational resources, live market news & business TV</p>
        </motion.div>

        {/* Section tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto scrollbar-hide pb-1">
          {[
            { key: "articles" as const, label: "Articles & Guides", icon: BookOpen },
            { key: "news" as const, label: "Live Market News", icon: Newspaper },
            { key: "live" as const, label: "Live Business TV", icon: Radio },
          ].map((s) => (
            <button key={s.key} onClick={() => setActiveSection(s.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap ${
                activeSection === s.key
                  ? "bg-primary text-primary-foreground shadow-lg"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}>
              <s.icon className="w-4 h-4" />
              {s.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* ARTICLES */}
          {activeSection === "articles" && (
            <motion.div key="articles" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              {/* Filters row */}
              <div className="flex flex-col sm:flex-row gap-3 mb-6 flex-wrap">
                <div className="relative flex-1 min-w-0 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Search articles..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
                </div>
                <Tabs value={category} onValueChange={setCategory}>
                  <TabsList>
                    {CATEGORIES.map(c => (
                      <TabsTrigger key={c.key} value={c.key} className="text-xs sm:text-sm">{c.label}</TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
                <div className="flex gap-1.5">
                  {["all", "Beginner", "Intermediate", "Advanced"].map(d => (
                    <button key={d} onClick={() => setDifficulty(d)}
                      className={`text-xs px-3 py-2.5 md:py-1.5 rounded-full border transition-colors font-medium whitespace-nowrap ${
                        difficulty === d
                          ? d === "Beginner" ? "bg-secondary text-secondary-foreground border-secondary"
                            : d === "Intermediate" ? "bg-brand-gold text-black border-brand-gold"
                            : d === "Advanced" ? "bg-destructive text-destructive-foreground border-destructive"
                            : "bg-primary text-primary-foreground border-primary"
                          : "border-border text-muted-foreground hover:bg-muted"
                      }`}>
                      {d === "all" ? "All Levels" : d}
                    </button>
                  ))}
                </div>
              </div>

              {loading ? (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[1, 2, 3, 4, 5, 6].map(i => (
                    <Card key={i} className="p-6 animate-pulse">
                      <div className="h-4 bg-muted rounded w-20 mb-4" />
                      <div className="h-6 bg-muted rounded w-full mb-2" />
                      <div className="h-4 bg-muted rounded w-3/4 mb-4" />
                      <div className="h-3 bg-muted rounded w-1/3" />
                    </Card>
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <Card className="p-12 text-center text-muted-foreground">
                  <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium">No articles found</p>
                  <p className="text-sm mt-1">Try adjusting your search or category filter</p>
                </Card>
                ) : (
                <div className="space-y-8">
                  {/* Featured hero cards */}
                  {featuredArticles.length > 0 && search.trim() === "" && (
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        <span className="text-sm font-semibold text-foreground">Featured Articles</span>
                      </div>
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {featuredArticles.map((article, i) => {
                          const isRead = readArticles.has(article.id);
                          return (
                            <motion.div key={article.id} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: i * 0.06 }} whileHover={{ y: -4 }}>
                              <Card className={`p-6 h-full flex flex-col cursor-pointer group overflow-hidden border-t-4 ${{
                                basics: "border-t-primary", trading: "border-t-brand-orange",
                                analysis: "border-t-secondary", investing: "border-t-brand-gold",
                              }[article.category] || "border-t-border"} ${isRead ? "opacity-75" : ""}`}
                                onClick={() => openArticle(article)}>
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-2">
                                    <Badge className={`text-xs ${CATEGORY_COLORS[article.category] || ""}`} variant="outline">
                                      {article.category.charAt(0).toUpperCase() + article.category.slice(1)}
                                    </Badge>
                                    {article.difficulty && (
                                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                        article.difficulty === "Beginner" ? "bg-secondary/10 text-secondary" :
                                        article.difficulty === "Advanced" ? "bg-destructive/10 text-destructive" :
                                        "bg-brand-gold/10 text-brand-gold"
                                      }`}>{article.difficulty}</span>
                                    )}
                                  </div>
                                  {isRead 
                                    ? <CheckCircle2 className="w-4 h-4 text-secondary" />
                                    : article.source && <span className="text-[10px] text-muted-foreground flex items-center gap-1"><ExternalLink className="w-3 h-3" />{article.source}</span>
                                  }
                                </div>
                                <h3 className="font-semibold text-lg text-foreground mb-2 group-hover:text-primary transition-colors line-clamp-2">{article.title}</h3>
                                <p className="text-sm text-muted-foreground flex-1 line-clamp-3 mb-4">{article.excerpt}</p>
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{article.read_time} min read</span>
                                  {LEARN_ARTICLES[article.slug] ? (
                                    <Link to={`/learn/${article.slug}`} onClick={(e) => e.stopPropagation()} className="relative z-10 flex items-center gap-1 py-3.5 -my-3.5 pr-3 -mr-3 group text-primary font-medium">Read guide <ChevronRight className="w-3.5 h-3.5 transition-transform duration-fast ease-out group-hover:translate-x-0.5" /></Link>
                                  ) : (
                                    <span className="flex items-center gap-1 text-primary font-medium">Read <ChevronRight className="w-3.5 h-3.5 transition-transform duration-fast ease-out group-hover:translate-x-0.5" /></span>
                                  )}
                                </div>
                              </Card>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Regular articles grid */}
                  {regularArticles.length > 0 && (
                    <div>
                      {featuredArticles.length > 0 && search.trim() === "" && (
                        <div className="flex items-center gap-2 mb-4">
                          <BookOpen className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm font-semibold text-foreground">All Articles</span>
                          <span className="text-xs text-muted-foreground">({readArticles.size} read)</span>
                        </div>
                      )}
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {regularArticles.map((article, i) => {
                          const isRead = readArticles.has(article.id);
                          return (
                            <motion.div key={article.id} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: i * 0.04 }} whileHover={{ y: -3 }}>
                              <Card className={`p-5 h-full flex flex-col cursor-pointer group overflow-hidden border-l-4 ${{
                                basics: "border-l-primary/40", trading: "border-l-brand-orange/40",
                                analysis: "border-l-secondary/40", investing: "border-l-brand-gold/40",
                              }[article.category] || "border-l-border"} ${isRead ? "opacity-70" : "hover:shadow-md"} transition-[opacity,box-shadow]`}
                                onClick={() => openArticle(article)}>
                                <div className="flex items-center justify-between mb-2.5">
                                  <div className="flex items-center gap-1.5">
                                    <Badge className={`text-xs ${CATEGORY_COLORS[article.category] || ""}`} variant="outline">
                                      {article.category.charAt(0).toUpperCase() + article.category.slice(1)}
                                    </Badge>
                                    {article.difficulty && (
                                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                        article.difficulty === "Beginner" ? "bg-secondary/10 text-secondary" :
                                        article.difficulty === "Advanced" ? "bg-destructive/10 text-destructive" :
                                        "bg-brand-gold/10 text-brand-gold"
                                      }`}>{article.difficulty}</span>
                                    )}
                                  </div>
                                  {isRead
                                    ? <CheckCircle2 className="w-3.5 h-3.5 text-secondary shrink-0" />
                                    : article.source && <span className="text-[10px] text-muted-foreground flex items-center gap-1"><ExternalLink className="w-3 h-3" />{article.source}</span>
                                  }
                                </div>
                                <h3 className="font-semibold text-base text-foreground mb-2 group-hover:text-primary transition-colors line-clamp-2">{article.title}</h3>
                                <p className="text-xs text-muted-foreground flex-1 line-clamp-3 mb-3">{article.excerpt}</p>
                                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{article.read_time} min</span>
                                  {LEARN_ARTICLES[article.slug] ? (
                                    <Link to={`/learn/${article.slug}`} onClick={(e) => e.stopPropagation()} className="relative z-10 flex items-center gap-1 py-3.5 -my-3.5 pr-3 -mr-3 group text-primary font-medium">Read guide <ChevronRight className="w-3 h-3 transition-transform duration-fast ease-out group-hover:translate-x-0.5" /></Link>
                                  ) : (
                                    <span className="flex items-center gap-1 text-primary font-medium">Read <ChevronRight className="w-3 h-3 transition-transform duration-fast ease-out group-hover:translate-x-0.5" /></span>
                                  )}
                                </div>
                              </Card>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* NEWS */}
          {activeSection === "news" && (
            <motion.div key="news" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex gap-2">
                  <button onClick={() => setNewsTab("indian")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${newsTab === "indian" ? "bg-brand-orange/10 text-brand-orange border border-brand-orange/30" : "text-muted-foreground hover:bg-muted"}`}>
                    <IndianRupee className="w-4 h-4" />
                    Indian Markets
                  </button>
                  <button onClick={() => setNewsTab("world")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${newsTab === "world" ? "bg-blue-500/10 text-blue-500 border border-blue-500/30" : "text-muted-foreground hover:bg-muted"}`}>
                    <Globe className="w-4 h-4" />
                    World Markets
                  </button>
                </div>
                <button onClick={fetchNews} disabled={newsLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <RefreshCw className={`w-3.5 h-3.5 ${newsLoading ? "animate-spin" : ""}`} />
                  Refresh
                </button>
              </div>

              {newsLoading && currentNews.length === 0 ? (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3, 4, 5, 6].map(i => (
                    <Card key={i} className="p-5 animate-pulse">
                      <div className="h-3 bg-muted rounded w-16 mb-3" />
                      <div className="h-5 bg-muted rounded w-full mb-2" />
                      <div className="h-4 bg-muted rounded w-3/4" />
                    </Card>
                  ))}
                </div>
              ) : currentNews.length === 0 ? (
                <Card className="p-12 text-center text-muted-foreground">
                  <Newspaper className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium">Loading latest news...</p>
                  <p className="text-sm mt-1">Click Refresh to fetch the latest market headlines</p>
                </Card>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {currentNews.map((item, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                      <Card className="p-5 h-full flex flex-col hover:shadow-lg transition-shadow">
                        <div className="flex items-center justify-between mb-3">
                          <Badge className={`text-[10px] ${NEWS_CATEGORY_COLORS[item.category] || "bg-muted text-muted-foreground"}`} variant="outline">
                            {item.category}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">{item.timeAgo}</span>
                        </div>
                        <h3 className="font-semibold text-sm text-foreground mb-2 line-clamp-2">{item.title}</h3>
                        <p className="text-xs text-muted-foreground flex-1 line-clamp-2 mb-3">{item.summary}</p>
                        <div className="text-[10px] text-muted-foreground font-medium">{item.source}</div>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* LIVE TV */}
          {activeSection === "live" && (
            <motion.div key="live" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div className="flex justify-end mb-4">
                <button
                  onClick={fetchLiveBroadcasts}
                  disabled={liveLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${liveLoading ? "animate-spin" : ""}`} />
                  Refresh Broadcasts
                </button>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {LIVE_CHANNELS.map((channel) => {
                  const channelEmbed = liveEmbeds[channel.channelId];
                  const watchUrl = channelEmbed?.watchUrl || `https://www.youtube.com/@${channel.handle}/live`;
                  const hasError = iframeErrors[channel.channelId];
                  // Only a resolved videoId embed is trustworthy; use the privacy-friendly
                  // nocookie host. Null => offline/non-embeddable => show a link-out state.
                  const embedUrl = !hasError && channelEmbed?.embedUrl
                    ? channelEmbed.embedUrl.replace("www.youtube.com", "www.youtube-nocookie.com")
                    : null;
                  const isPlaying = !!activePlayers[channel.channelId];

                  return (
                    <Card key={channel.name} className="overflow-hidden">
                      <div className="aspect-video bg-gradient-to-br from-brand-navy to-primary relative overflow-hidden">
                        {isPlaying && embedUrl ? (
                          <iframe
                            src={`${embedUrl}${embedUrl.includes("?") ? "&" : "?"}autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1`}
                            title={`${channel.name} Live`}
                            className="w-full h-full absolute inset-0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            referrerPolicy="strict-origin-when-cross-origin"
                            allowFullScreen
                            onError={() => handleIframeError(channel.channelId)}
                          />
                        ) : embedUrl ? (
                          // Resolved broadcast available - facade: load the heavy player only on click.
                          <button
                            type="button"
                            onClick={() => setActivePlayers((p) => ({ ...p, [channel.channelId]: true }))}
                            aria-label={`Play ${channel.name}`}
                            className="group w-full h-full absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/90 hover:text-white transition-colors"
                          >
                            <span className="w-16 h-16 rounded-full bg-white/15 group-hover:bg-brand-orange flex items-center justify-center transition-colors">
                              <Play className="w-7 h-7 ml-0.5" fill="currentColor" />
                            </span>
                            <span className="text-sm font-semibold px-4 text-center line-clamp-2">
                              {channelEmbed?.title || `Watch ${channel.name}`}
                            </span>
                          </button>
                        ) : (
                          // No embeddable broadcast resolved - honest offline state, link out.
                          <a
                            href={watchUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group w-full h-full absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/80 hover:text-white transition-colors"
                          >
                            <AlertTriangle className="w-8 h-8 text-brand-gold" />
                            <span className="text-sm font-medium">Currently offline</span>
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
                              <ExternalLink className="w-3.5 h-3.5" /> Watch latest on YouTube
                            </span>
                          </a>
                        )}
                      </div>
                      <div className="p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                          <span className="text-xs font-bold text-destructive">LIVE</span>
                          <h3 className="font-heading text-lg font-bold text-foreground">{channel.name}</h3>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{channel.description}</p>
                        {channelEmbed?.title && (
                          <p className="text-xs text-muted-foreground mb-3 line-clamp-2">Now Playing: {channelEmbed.title}</p>
                        )}
                        <a
                          href={watchUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Open Live on YouTube
                        </a>
                      </div>
                    </Card>
                  );
                })}
              </div>
              <Card className="mt-6 p-6 bg-muted/30 border-border/50">
                <div className="text-center">
                  <Radio className="w-8 h-8 text-brand-orange mx-auto mb-3" />
                  <h3 className="font-semibold text-foreground mb-2">Live Business News Broadcast</h3>
                  <p className="text-sm text-muted-foreground max-w-lg mx-auto">
                    Tap a channel to start its latest broadcast. When a channel is off-air, we link
                    you straight to its live page on YouTube - so you never hit a broken player.
                  </p>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <Footer />
      <WhatsAppButton />
      </div>
    </PageTransition>
  );
};

export default LearningCenterPage;

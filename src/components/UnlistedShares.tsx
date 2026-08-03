import { Search, Phone, TrendingUp, TrendingDown, ShieldCheck, Handshake, ArrowRight, Sparkles, Star, ChevronRight, BadgeCheck, Clock, AlertTriangle, Building2, MapPin, Calendar, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { motion, Variants, AnimatePresence } from "motion/react";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { EASE_OUT, revealFade, revealPop, revealSection } from "@/lib/motion";

type StockItem = {
  name: string; short: string; tag: string; tagColor: string; price: string;
  buyPrice?: string | null; sellPrice?: string | null; minQty: string; color: string;
  imageUrl?: string | null; description?: string | null; sector?: string | null;
  foundedYear?: string | null; headquarters?: string | null;
};

const benefits = [
  { icon: TrendingUp, title: "High Growth Potential", desc: "Invest early in companies before they go public for maximum returns.", stat: "300%+", statLabel: "Avg. Pre-IPO Returns" },
  { icon: ShieldCheck, title: "100% Verified", desc: "We deal only in thoroughly vetted and verified unlisted companies.", stat: "50+", statLabel: "Companies Listed" },
  { icon: Handshake, title: "Expert Guidance", desc: "Our team helps you choose the right unlisted shares based on your goals.", stat: "35+", statLabel: "Years Experience" },
];

const howItWorks = [
  { step: "01", title: "Choose a Share", desc: "Browse our curated list of pre-IPO and unlisted shares." },
  { step: "02", title: "Contact Us", desc: "Call or WhatsApp for live pricing and availability." },
  { step: "03", title: "Complete KYC", desc: "Quick, simple KYC verification." },
  { step: "04", title: "Start Investing", desc: "Get shares transferred to your Demat account." },
];

const containerVariants: Variants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
const itemVariants: Variants = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT } } };

type SortKey = "name" | "price-asc" | "price-desc";

/**
 * Quoted prices arrive as display strings ("₹1,250", "1,250.50"), not numbers,
 * so sorting by value needs the digits pulled back out. Anything unparseable
 * sorts last rather than being treated as zero, which would put it at the top
 * of an ascending sort and read as the cheapest share on offer.
 */
const priceValue = (raw: string): number => {
  const n = Number(String(raw).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : Number.POSITIVE_INFINITY;
};

const UnlistedShares = () => {
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStock, setSelectedStock] = useState<StockItem | null>(null);
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("name");

  useEffect(() => {
    const fetchShares = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("manage-unlisted-shares", {
          body: { action: "list" }
        });
        
        if (error) {
          console.error('Error fetching unlisted shares:', error);
          setStocks([]); // never serve stale hardcoded quotes as current
          return;
        }
        
        if (data && data.success && Array.isArray(data.data)) {
          type ApiShare = { is_active?: boolean; name: string; short_code: string; tag?: string; tag_color?: string; price: string; buy_price?: string | null; sell_price?: string | null; min_qty?: string; gradient_color?: string; image_url?: string | null; company_description?: string | null; sector?: string | null; founded_year?: string | null; headquarters?: string | null };
          const activeShares = (data.data as ApiShare[]).filter((s) => s.is_active !== false);
          if (activeShares.length > 0) {
            setStocks(activeShares.map((s) => ({
              name: s.name,
              short: s.short_code,
              tag: s.tag || 'Popular',
              tagColor: s.tag_color || 'bg-secondary/10 text-secondary',
              price: s.price,
              buyPrice: s.buy_price,
              sellPrice: s.sell_price,
              minQty: s.min_qty || '1 Share',
              color: s.gradient_color || 'from-blue-600 to-blue-800',
              imageUrl: s.image_url,
              description: s.company_description,
              sector: s.sector || 'General',
              foundedYear: s.founded_year,
              headquarters: s.headquarters,
            })));
          } else {
            setStocks([]);
          }
        } else {
          setStocks([]);
        }
      } catch (err) {
        console.error('Failed to fetch unlisted shares:', err);
        setStocks([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchShares();

    // Re-fetch when tab becomes visible again (e.g. after being in background)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchShares();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Also re-fetch on window focus as a fallback
    const handleFocus = () => fetchShares();
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const sectors = useMemo(
    () => [...new Set(stocks.map((s) => s.sector || "General"))].sort(),
    [stocks],
  );

  /**
   * The catalogue runs to 50+ companies in one flat grid. Without a way to
   * narrow it, finding a specific name means scrolling the whole list, which is
   * the difference between a browsable catalogue and a wall.
   */
  const visibleStocks = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = stocks.filter((s) => {
      const matchesSector = sector === "all" || (s.sector || "General") === sector;
      const matchesQuery =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.short.toLowerCase().includes(q) ||
        (s.sector ?? "").toLowerCase().includes(q);
      return matchesSector && matchesQuery;
    });

    // Copied before sorting: sort mutates, and mutating the state array in a
    // memo would reorder `stocks` itself behind React's back.
    return [...filtered].sort((a, b) => {
      if (sort === "price-asc") return priceValue(a.price) - priceValue(b.price);
      if (sort === "price-desc") return priceValue(b.price) - priceValue(a.price);
      return a.name.localeCompare(b.name);
    });
  }, [stocks, query, sector, sort]);

  // Escape key to close stock detail modal
  useEffect(() => {
    if (!selectedStock) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedStock(null);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [selectedStock]);

  return (
    <div>
      {/* Hero */}
      <section className="relative py-10 md:py-28 overflow-hidden" style={{ background: "linear-gradient(135deg, hsl(213 80% 12%) 0%, hsl(213 80% 18%) 50%, hsl(145 40% 20%) 100%)" }}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 opacity-5" style={{ backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.3) 1px, transparent 0)`, backgroundSize: '30px 30px' }} />
          <div className="absolute top-20 right-20 w-96 h-96 bg-secondary/10 rounded-full blur-3xl" />
        </div>
        <div className="container mx-auto px-4 relative z-10 text-center">
          <motion.div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-2 mb-8" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
            <Sparkles className="w-4 h-4 text-brand-gold" />
            <span className="text-primary-foreground/90 text-sm font-medium">Pre-IPO & Unlisted Shares</span>
          </motion.div>
          <motion.h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold text-primary-foreground mb-6 leading-tight" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            Buy and Sell<br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-secondary via-brand-gold to-secondary">Pre-IPO | Unlisted Shares</span>
          </motion.h1>
          <motion.p className="text-primary-foreground/70 text-lg md:text-xl max-w-2xl mx-auto mb-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
            Grab your chance to invest in India's top companies.
          </motion.p>
          <motion.p className="text-secondary font-semibold text-lg mb-10" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>Get started with just 1 share.</motion.p>
          <motion.div className="flex flex-wrap justify-center gap-6 text-primary-foreground/60 text-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
            <div className="flex items-center gap-2"><BadgeCheck className="w-4 h-4 text-secondary" /> SEBI Registered</div>
            <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-brand-gold" /> Instant Transfer</div>
            <div className="flex items-center gap-2"><Star className="w-4 h-4 text-brand-gold" /> 5-Star Rated</div>
          </motion.div>
        </div>
      </section>

      {/* Stock Cards */}
      <section className="py-8 md:py-16 bg-background relative">
        <div className="container mx-auto px-4">
          <motion.div className="text-center mb-10" {...revealSection}>
            <h2 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-2">Available <span className="text-secondary">Unlisted Shares</span></h2>
            <p className="text-muted-foreground">Contact us for live pricing & availability</p>
          </motion.div>

          {/* Catalogue controls. Rendered only once there is something to
              narrow: showing a disabled search box over a skeleton or over the
              "quotes unavailable" state suggests the list is empty because of
              a filter, which would be misleading. */}
          {!isLoading && stocks.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-3 mb-6 max-w-3xl mx-auto">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search company or sector..."
                  aria-label="Search unlisted shares"
                  className="w-full h-10 pl-10 pr-3 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-secondary/40"
                />
              </div>
              <select
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                aria-label="Filter by sector"
                className="h-10 px-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-secondary/40"
              >
                <option value="all">All sectors</option>
                {sectors.map((sec) => (
                  <option key={sec} value={sec}>{sec}</option>
                ))}
              </select>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                aria-label="Sort shares"
                className="h-10 px-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-secondary/40"
              >
                <option value="name">Name (A-Z)</option>
                <option value="price-asc">Price (low to high)</option>
                <option value="price-desc">Price (high to low)</option>
              </select>
            </div>
          )}

          {!isLoading && stocks.length > 0 && (
            <p className="text-center text-xs text-muted-foreground mb-6" aria-live="polite">
              Showing {visibleStocks.length} of {stocks.length} companies
            </p>
          )}

          {isLoading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="border-border/50 animate-pulse">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 bg-muted rounded-xl shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-muted rounded w-3/4" />
                        <div className="h-3 bg-muted rounded w-1/2" />
                        <div className="h-3 bg-muted rounded w-1/3" />
                      </div>
                    </div>
                    <div className="mt-3 h-16 bg-muted rounded" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : stocks.length === 0 ? (
            /* The hardcoded quote table that used to back this case held prices
               from whenever it was last edited. Unlisted quotes move, and a
               stale number presented as current is the same problem as an
               invented one. */
            <div className="py-10 text-center">
              <p className="text-sm font-medium text-foreground">Live quotes are temporarily unavailable</p>
              <p className="text-xs text-muted-foreground mt-1">
                Unlisted share prices change frequently. Please call us for current buy and sell levels.
              </p>
            </div>
          ) : (
            visibleStocks.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm font-medium text-foreground">No companies match your filters</p>
                <button
                  type="button"
                  onClick={() => { setQuery(""); setSector("all"); }}
                  className="text-xs text-secondary font-semibold hover:underline mt-1"
                >
                  Clear filters
                </button>
              </div>
            ) : (
            <motion.div key={`${sector}-${sort}-${visibleStocks.length}`} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4" variants={containerVariants} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }}>
              {visibleStocks.map((stock, index) => (
                <motion.div key={stock.name} variants={itemVariants}>
                  <Card className="group cursor-pointer transition-[color,background-color,border-color,box-shadow] duration-base border-border/50 hover:border-secondary/50 hover:shadow-xl hover:shadow-secondary/5"
                    onClick={() => setSelectedStock(stock)}>
                    <CardContent className="p-5">
                      <div className="flex items-start gap-4">
                        {stock.imageUrl ? (
                          <img src={stock.imageUrl} alt={stock.short} width={56} height={56} className="w-14 h-14 rounded-xl object-contain border border-border bg-white shrink-0 shadow-lg" />
                        ) : (
                          <div className={`w-14 h-14 bg-gradient-to-br ${stock.color} rounded-xl flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-lg`}>{stock.short}</div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-heading font-semibold text-foreground text-sm leading-tight group-hover:text-secondary transition-colors line-clamp-2">{stock.name}</h4>
                          {(stock.buyPrice || stock.sellPrice) ? (
                            <div className="flex items-center gap-3 mt-2">
                              {stock.buyPrice && <div className="text-xs"><span className="text-muted-foreground">Buy:</span> <span className="font-bold text-secondary">{stock.buyPrice}</span></div>}
                              {stock.sellPrice && <div className="text-xs"><span className="text-muted-foreground">Sell:</span> <span className="font-bold text-destructive">{stock.sellPrice}</span></div>}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-lg font-bold text-foreground">{stock.price}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${stock.tagColor}`}>{stock.tag}</span>
                            {stock.sector && stock.sector !== "General" && <span className="text-[10px] text-muted-foreground">{stock.sector}</span>}
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-1">Min: {stock.minQty}</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-secondary transition-colors shrink-0 mt-4" />
                      </div>
                      {/* A price chart used to sit here. It was a Math.random()
                          walk whose direction came from `index % 3`, so every
                          third card trended down regardless of the scrip. The
                          quoted price is real and admin-maintained; there is no
                          price history behind it to plot. */}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
            )
          )}

          <motion.p className="text-center text-muted-foreground mt-8 text-base" {...revealFade}>
            ...and many more! <span className="text-secondary font-semibold">Contact us for pricing & availability.</span>
          </motion.p>
        </div>
      </section>

      {/* Stock Detail Modal */}
      <AnimatePresence>
        {selectedStock && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedStock(null)}>
            <motion.div className="bg-card border border-border rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-2xl" initial={{ scale: 0.9, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 30 }} onClick={(e) => e.stopPropagation()}>
              <div className="p-6">
                <div className="flex items-start gap-4 mb-5">
                  {selectedStock.imageUrl ? (
                    <img src={selectedStock.imageUrl} alt={selectedStock.short} width={64} height={64} className="w-16 h-16 rounded-xl object-contain border border-border bg-white" />
                  ) : (
                    <div className={`w-16 h-16 bg-gradient-to-br ${selectedStock.color} rounded-xl flex items-center justify-center text-sm font-bold text-white`}>{selectedStock.short}</div>
                  )}
                  <div className="flex-1">
                    <h3 className="font-heading text-lg font-bold text-foreground">{selectedStock.name}</h3>
                    <div className="flex gap-2 mt-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${selectedStock.tagColor}`}>{selectedStock.tag}</span>
                      {selectedStock.sector && <span className="text-xs text-muted-foreground">{selectedStock.sector}</span>}
                    </div>
                  </div>
                  <button onClick={() => setSelectedStock(null)} className="text-muted-foreground hover:text-foreground text-xl">×</button>
                </div>

                {/* Pricing */}
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div className="bg-secondary/5 border border-secondary/20 rounded-xl p-4 text-center">
                    <div className="text-xs text-muted-foreground mb-1">Buy Rate</div>
                    <div className="text-xl font-bold text-secondary">{selectedStock.buyPrice || selectedStock.price}</div>
                  </div>
                  <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 text-center">
                    <div className="text-xs text-muted-foreground mb-1">Sell Rate</div>
                    <div className="text-xl font-bold text-destructive">{selectedStock.sellPrice || selectedStock.price}</div>
                  </div>
                </div>

                {/* Price Chart */}
                <div className="bg-muted/30 rounded-xl p-4 mb-5">
                  <div className="flex items-center gap-2 mb-2">
                    <BarChart3 className="w-4 h-4 text-secondary" />
                    <span className="text-sm font-semibold text-foreground">Price History</span>
                  </div>
                  {/* The "indicative" chart here was a random walk hardcoded to
                      trend upward. A disclaimer under an invented rising line
                      still leaves the impression of a rising price. */}
                  <p className="text-xs text-muted-foreground">
                    Unlisted shares trade off-exchange, so there is no public price history to chart.
                    Contact us for indicative pricing and past transaction levels.
                  </p>
                </div>

                {/* Company Info */}
                {(selectedStock.description || selectedStock.foundedYear || selectedStock.headquarters) && (
                  <div className="mb-5">
                    <h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2"><Building2 className="w-4 h-4 text-secondary" /> Company Information</h4>
                    {selectedStock.description && <p className="text-sm text-muted-foreground mb-3">{selectedStock.description}</p>}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {selectedStock.foundedYear && <div className="flex items-center gap-1.5 text-muted-foreground"><Calendar className="w-3.5 h-3.5" /> Founded: {selectedStock.foundedYear}</div>}
                      {selectedStock.headquarters && <div className="flex items-center gap-1.5 text-muted-foreground"><MapPin className="w-3.5 h-3.5" /> {selectedStock.headquarters}</div>}
                      <div className="flex items-center gap-1.5 text-muted-foreground">Min Qty: {selectedStock.minQty}</div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button asChild className="flex-1 bg-green-600 hover:bg-green-700 text-white">
                    <a
                      href={`https://wa.me/919416400314?text=${encodeURIComponent(
                        `Hi, I'm interested in buying *${selectedStock.name}* (${selectedStock.short}) unlisted shares.\n\nCurrent Price: ${selectedStock.buyPrice || selectedStock.price}\nPlease share live pricing and availability.`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.611.611l4.458-1.495A11.952 11.952 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.387 0-4.597-.826-6.337-2.207l-.446-.355-2.624.879.879-2.624-.355-.446A9.935 9.935 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z"/></svg>
                      WhatsApp Inquiry
                    </a>
                  </Button>
                  <Button asChild variant="outline" className="flex-1"><a href="tel:+919416400314"><Phone className="w-4 h-4 mr-2" /> Call Now</a></Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Benefits */}
      <section className="py-8 md:py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <motion.div className="grid md:grid-cols-3 gap-6" variants={containerVariants} initial="hidden" whileInView="visible" viewport={{ once: true }}>
            {benefits.map((b) => (
              <motion.div key={b.title} variants={itemVariants}>
                <Card className="h-full border-border/50 hover:border-secondary/50 transition-[color,background-color,border-color,box-shadow] hover:shadow-xl group">
                  <CardContent className="p-8">
                    <div className="w-14 h-14 bg-secondary/10 rounded-xl flex items-center justify-center mb-5 group-hover:bg-secondary/20 transition-colors"><b.icon className="w-7 h-7 text-secondary" /></div>
                    <h3 className="font-heading text-xl font-semibold text-foreground mb-2">{b.title}</h3>
                    <p className="text-muted-foreground mb-4">{b.desc}</p>
                    <div className="pt-4 border-t border-border/50">
                      <span className="text-2xl font-bold text-secondary">{b.stat}</span>
                      <span className="text-xs text-muted-foreground ml-2">{b.statLabel}</span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-8 md:py-16 bg-background">
        <div className="container mx-auto px-4">
          <motion.div className="text-center mb-12" {...revealSection}>
            <h2 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-2">How It <span className="text-secondary">Works</span></h2>
            <p className="text-muted-foreground">Simple 4-step process to start investing in unlisted shares</p>
          </motion.div>
          <motion.div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6" variants={containerVariants} initial="hidden" whileInView="visible" viewport={{ once: true }}>
            {howItWorks.map((step, i) => (
              <motion.div key={step.step} variants={itemVariants} className="relative">
                <Card className="h-full border-border/50 hover:border-secondary/50 transition-colors text-center">
                  <CardContent className="p-6">
                    <div className="text-4xl font-bold text-secondary/20 mb-3">{step.step}</div>
                    <h3 className="font-heading text-lg font-semibold text-foreground mb-2">{step.title}</h3>
                    <p className="text-muted-foreground text-sm">{step.desc}</p>
                  </CardContent>
                </Card>
                {i < howItWorks.length - 1 && <div className="hidden lg:block absolute top-1/2 -right-3 z-10"><ChevronRight className="w-6 h-6 text-secondary/40" /></div>}
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Disclaimer */}
      <section className="py-8 bg-muted/20">
        <div className="container mx-auto px-4">
          <motion.div className="bg-destructive/5 border border-destructive/20 rounded-2xl p-6 md:p-8" {...revealSection}>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-destructive/10 rounded-xl flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-destructive" />
              </div>
              <div>
                <h3 className="font-heading text-lg font-bold text-foreground mb-2">Important Disclaimer – Unlisted Shares</h3>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p><strong>Unlisted shares are NOT regulated by SEBI or any recognized stock exchange.</strong> Trading in unlisted securities carries significant risks including but not limited to:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>No regulatory oversight or investor protection from SEBI, NSE, BSE, or any exchange</li>
                    <li>Limited liquidity – you may not be able to sell when you want</li>
                    <li>Prices are not standardized and may vary between dealers</li>
                    <li>Limited or no publicly available financial information</li>
                    <li>No guarantee of listing or IPO – the company may never go public</li>
                    <li>Risk of total loss of investment</li>
                  </ul>
                  <p className="pt-2"><strong>Parasram India acts only as a facilitator</strong> for unlisted share transactions. We do not guarantee returns, listing timelines, or the accuracy of company information. Investors are advised to perform their own due diligence and consult a qualified financial advisor before investing.</p>
                  <p className="text-xs text-muted-foreground/70 pt-2">By proceeding, you acknowledge that you understand the risks involved in trading unlisted securities and that such investments are made at your own risk.</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-8 md:py-16">
        <div className="container mx-auto px-4">
          <motion.div className="bg-hero rounded-3xl p-10 md:p-16 text-center text-primary-foreground relative overflow-hidden" {...revealPop()}>
            <div className="relative z-10">
              <h3 className="font-heading text-2xl md:text-3xl font-bold mb-4">Interested in Unlisted Shares?</h3>
              <p className="text-primary-foreground/80 text-lg mb-8 max-w-xl mx-auto">Contact us now to explore premium unlisted share opportunities.</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
                <Button asChild size="lg" className="bg-secondary hover:bg-secondary/90 text-secondary-foreground font-bold text-lg px-10 py-6 shadow-xl">
                  <a href="#contact">Contact Now <ArrowRight className="ml-2 w-5 h-5" /></a>
                </Button>
              </div>
              <div className="flex flex-col sm:flex-row gap-6 justify-center items-center text-primary-foreground/90">
                <a href="tel:+919416400314" className="flex items-center gap-2 hover:text-secondary transition-colors text-lg"><Phone className="w-5 h-5" /> +91 9416400314</a>
                <a href="tel:+919999790011" className="flex items-center gap-2 hover:text-secondary transition-colors text-lg"><Phone className="w-5 h-5" /> +91 9999790011</a>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default UnlistedShares;

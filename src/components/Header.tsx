import { Phone, Mail, ExternalLink, Instagram, Menu, X as XIcon, Facebook, Twitter, LogIn, BarChart3, ChevronDown, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Link, useLocation } from "react-router-dom";
import logo80 from "@/assets/logo-80.webp";
import logo160 from "@/assets/logo-160.webp";
import ThemeToggle from "@/components/ThemeToggle";
import MegaDropdown from "@/components/header/MegaDropdown";
import { megaMenuItems } from "@/components/header/megaMenuData";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useT } from "@/i18n/LanguageContext";
import { NAV_LABEL_KEYS } from "@/i18n/config";
import { useWatchlist } from "@/hooks/useWatchlist";

const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [expandedMobileSection, setExpandedMobileSection] = useState<string | null>(null);
  const location = useLocation();
  const { t } = useT();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { watchlist } = useWatchlist();
  const [scrolled, setScrolled] = useState(false);

  // Compact, elevated header once the user scrolls past the hero fold.
  // The ref guard means React state is touched only when the value actually
  // flips, not on every scroll event - otherwise this queues an update on
  // every frame of every scroll for the life of the page.
  const isScrolledRef = useRef(false);
  useEffect(() => {
    const onScroll = () => {
      const next = window.scrollY > 24;
      if (next === isScrolledRef.current) return;
      isScrolledRef.current = next;
      setScrolled(next);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Auto-close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setExpandedMobileSection(null);
  }, [location.pathname]);

  const handleMouseEnter = useCallback((label: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setActiveMenu(label);
  }, []);

  const handleMouseLeave = useCallback(() => {
    timeoutRef.current = setTimeout(() => setActiveMenu(null), 150);
  }, []);

  const handleDropdownMouseEnter = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  const isActive = (item: typeof megaMenuItems[0]) => {
    if (item.href && location.pathname === item.href) return true;
    return item.subItems?.some(sub => location.pathname === sub.href) ?? false;
  };

  // Translate a top-level nav label when a key exists; fall back to the English label.
  const navLabel = (label: string) => {
    const key = NAV_LABEL_KEYS[label];
    return key ? t(key) : label;
  };

  return (
    <header className="w-full sticky top-0 z-50" role="banner">
      {/* Top bar */}
      <div className="bg-hero text-primary-foreground py-1.5 hidden sm:block">
        <div className="container mx-auto px-4 flex justify-between items-center text-xs">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-secondary" />
              <a href="tel:+919416400314" className="hover:text-secondary transition-colors font-medium">+91 9416400314</a>
              <span className="hidden lg:inline text-primary-foreground/30">·</span>
              <a href="tel:+919999790011" className="hidden lg:inline hover:text-secondary transition-colors">9999790011</a>
              <span className="hidden lg:inline text-primary-foreground/30">·</span>
              <a href="tel:+919416400277" className="hidden lg:inline hover:text-secondary transition-colors">9416400277</a>
            </span>
            <a href="mailto:parasrampnp@gmail.com" className="hidden md:flex items-center gap-1.5 hover:text-secondary transition-colors">
              <Mail className="w-3.5 h-3.5" /><span>parasrampnp@gmail.com</span>
            </a>
            <span className="hidden xl:flex items-center gap-1.5 text-primary-foreground/60">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
              SEBI Registered · Since 1970
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5 pr-3 border-r border-primary-foreground/20">
              <a href="https://www.instagram.com/parasrampanipat/" target="_blank" rel="noopener noreferrer" aria-label="Follow us on Instagram" className="inline-flex hover:text-secondary hover:scale-110 transition-[color,transform] duration-fast ease-out">
                <Instagram className="w-3.5 h-3.5" />
              </a>
              <a href="https://www.facebook.com/share/18B5W5rZaT/" target="_blank" rel="noopener noreferrer" aria-label="Follow us on Facebook" className="inline-flex hover:text-secondary hover:scale-110 transition-[color,transform] duration-fast ease-out">
                <Facebook className="w-3.5 h-3.5" />
              </a>
              <a href="https://x.com/ParasramPanipat" target="_blank" rel="noopener noreferrer" aria-label="Follow us on X (Twitter)" className="inline-flex hover:text-secondary hover:scale-110 transition-[color,transform] duration-fast ease-out">
                <Twitter className="w-3.5 h-3.5" />
              </a>
            </div>
            <a href="https://parasramindia.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-secondary transition-colors">
              <span>Visit Main Website</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>

      {/* Main header */}
      <div className={`bg-card/95 backdrop-blur-md relative transition-shadow duration-base ease-out ${scrolled ? "shadow-lg" : "shadow-md"}`}>
        <div className="container mx-auto px-4 py-1 flex justify-between items-center">
          {/* The logo box is a fixed height so the header never changes size.
              The shrink-on-scroll affordance is a transform on the image
              instead: it costs no layout, so scrolling can't reflow the page
              or shift what's underneath. */}
          <Link to="/" className="flex h-10 md:h-16 items-center group">
            <img
              src={logo80}
              srcSet={`${logo80} 80w, ${logo160} 160w`}
              sizes="(min-width: 768px) 80px, 40px"
              alt="Parasram - Science of Investment"
              width={80}
              height={80}
              decoding="async"
              className={`h-full w-auto origin-left transition-transform duration-base ease-out ${
                scrolled ? "scale-90" : "scale-100"
              }`}
            />
          </Link>

          {/* Desktop mega menu nav */}
          <nav className="hidden lg:flex items-center gap-1" aria-label="Main navigation">
            {megaMenuItems.map((item) => (
              <div
                key={item.label}
                className="relative group/nav"
                onMouseEnter={() => item.subItems ? handleMouseEnter(item.label) : setActiveMenu(null)}
                onMouseLeave={handleMouseLeave}
              >
                {item.href && !item.subItems ? (
                  <Link
                    to={item.href}
                    className={`px-3 py-3 min-h-[48px] text-sm font-medium transition-colors rounded-md flex items-center gap-1 ${
                      item.highlight
                        ? "text-brand-green font-bold hover:bg-accent/50"
                        : isActive(item)
                        ? "text-secondary"
                        : "text-foreground hover:text-secondary hover:bg-accent/50"
                    }`}
                  >
                    {navLabel(item.label)}
                  </Link>
                ) : (
                  <div
                    className={`px-3 py-3 min-h-[48px] text-sm font-medium transition-colors rounded-md flex items-center gap-1 ${
                      isActive(item)
                        ? "text-secondary"
                        : "text-foreground hover:bg-accent/50"
                    }`}
                  >
                    {item.href ? (
                      <Link to={item.href} className="hover:text-secondary inset-0 flex items-center">{navLabel(item.label)}</Link>
                    ) : navLabel(item.label)}
                    {item.subItems && (
                      <ChevronDown className={`w-3.5 h-3.5 ml-0.5 transition-transform duration-fast ease-out ${activeMenu === item.label ? "rotate-180" : ""}`} />
                    )}
                  </div>
                )}
                {/* Animated underline */}
                {!item.highlight && (
                  <span
                    className={`pointer-events-none absolute left-3 right-3 bottom-1 h-0.5 rounded-full bg-secondary origin-left transition-transform duration-fast ease-out ${
                      isActive(item) || activeMenu === item.label ? "scale-x-100" : "scale-x-0 group-hover/nav:scale-x-100"
                    }`}
                  />
                )}
              </div>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
            {watchlist.length > 0 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="relative"
                title={`My Watchlist (${watchlist.length})`}
              >
                <Link to="/screener" aria-label={`My Watchlist (${watchlist.length} items)`} className="p-2 rounded-md text-muted-foreground hover:text-yellow-500 hover:bg-yellow-500/10 transition-colors relative inline-flex">
                  <Star className="w-4 h-4" />
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-yellow-500 text-[9px] text-black font-bold flex items-center justify-center">
                    {watchlist.length}
                  </span>
                </Link>
              </motion.div>
            )}
            <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex border-primary/50 text-primary hover:bg-primary hover:text-primary-foreground font-semibold">
              <a href="https://dashboard.parasramindia.com/Account/Login" target="_blank" rel="noopener noreferrer">
                <LogIn className="w-4 h-4 mr-1" />{t("cta.clientLogin")}
              </a>
            </Button>
            <Button asChild size="sm" className="hidden sm:inline-flex bg-secondary hover:bg-secondary/90 text-secondary-foreground font-semibold">
              <a href="https://webtrade.parasramindia.com/#!/app" target="_blank" rel="noopener noreferrer">
                <BarChart3 className="w-4 h-4 mr-1" />{t("cta.webTrade")}
              </a>
            </Button>
            <Button asChild className="hidden sm:inline-flex btn-shine bg-gradient-to-r from-secondary to-brand-green hover:from-secondary/90 hover:to-brand-green/90 text-secondary-foreground font-bold shadow-md shadow-secondary/25 hover:shadow-lg hover:shadow-secondary/30">
              <Link to="/open-account">{t("cta.openAccount")}</Link>
            </Button>
            <button
              className="lg:hidden p-2 text-foreground hover:text-secondary transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <XIcon className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Desktop mega dropdown - full width below header */}
        <AnimatePresence>
          {activeMenu && megaMenuItems.find(m => m.label === activeMenu)?.subItems && (
            <div
              onMouseEnter={handleDropdownMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              <MegaDropdown
                items={megaMenuItems.find(m => m.label === activeMenu)!.subItems!}
                onClose={() => setActiveMenu(null)}
              />
            </div>
          )}
        </AnimatePresence>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="lg:hidden overflow-y-auto max-h-[80vh] border-t border-border"
            >
              <nav className="container mx-auto px-4 py-4 flex flex-col gap-1" aria-label="Mobile navigation">
                {megaMenuItems.map((item, i) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    {item.subItems ? (
                      <div>
                        <button
                          onClick={() => setExpandedMobileSection(expandedMobileSection === item.label ? null : item.label)}
                          className={`w-full flex items-center justify-between font-medium py-2.5 border-b border-border/30 transition-colors ${
                            isActive(item) ? "text-secondary" : "text-foreground"
                          }`}
                        >
                          {navLabel(item.label)}
                          <ChevronDown className={`w-4 h-4 transition-transform duration-fast ease-out ${expandedMobileSection === item.label ? "rotate-180" : ""}`} />
                        </button>
                        <AnimatePresence>
                          {expandedMobileSection === item.label && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="pl-2 py-2 space-y-1">
                                {item.subItems.map(sub => {
                                  const Icon = sub.icon;
                                  if (sub.external) {
                                    return (
                                      <a
                                        key={sub.label}
                                        href={sub.href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={() => setMobileMenuOpen(false)}
                                        className="flex items-center gap-3 p-2 min-h-[48px] rounded-md hover:bg-accent/50 transition-colors"
                                      >
                                        <Icon className="w-4 h-4 text-primary flex-shrink-0" />
                                        <div>
                                          <p className="text-sm font-medium text-foreground inline-flex items-center gap-1">
                                            {sub.label}
                                            <ExternalLink className="w-3 h-3 text-muted-foreground" />
                                          </p>
                                          <p className="text-xs text-muted-foreground">{sub.description}</p>
                                        </div>
                                      </a>
                                    );
                                  }
                                  return (
                                    <Link
                                      key={sub.label}
                                      to={sub.href}
                                      onClick={() => setMobileMenuOpen(false)}
                                      className="flex items-center gap-3 p-2 min-h-[48px] rounded-md hover:bg-accent/50 transition-colors"
                                    >
                                      <Icon className="w-4 h-4 text-primary flex-shrink-0" />
                                      <div>
                                        <p className="text-sm font-medium text-foreground">{sub.label}</p>
                                        <p className="text-xs text-muted-foreground">{sub.description}</p>
                                      </div>
                                    </Link>
                                  );
                                })}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ) : (
                      <Link
                        to={item.href!}
                        className={`block font-medium py-3 px-2 min-h-[48px] border-b border-border/30 transition-colors ${
                          item.highlight ? "text-brand-green font-bold" :
                          isActive(item) ? "text-secondary" : "text-foreground hover:text-secondary"
                        }`}
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        {navLabel(item.label)}
                      </Link>
                    )}
                  </motion.div>
                ))}

                <div className="flex flex-col gap-2 mt-3">
                  <Button asChild variant="outline" className="border-primary/50 text-primary hover:bg-primary hover:text-primary-foreground font-semibold w-full">
                    <a href="https://dashboard.parasramindia.com/Account/Login" target="_blank" rel="noopener noreferrer" onClick={() => setMobileMenuOpen(false)}>
                      <LogIn className="w-4 h-4 mr-1" />{t("cta.clientLogin")}
                    </a>
                  </Button>
                  <Button asChild className="bg-secondary hover:bg-secondary/90 text-secondary-foreground font-semibold w-full">
                    <a href="https://webtrade.parasramindia.com/#!/app" target="_blank" rel="noopener noreferrer" onClick={() => setMobileMenuOpen(false)}>
                      <BarChart3 className="w-4 h-4 mr-1" />{t("cta.webTrade")}
                    </a>
                  </Button>
                  <Button asChild className="bg-brand-navy hover:bg-brand-navy/90 text-white font-semibold w-full">
                    <Link to="/open-account" onClick={() => setMobileMenuOpen(false)}>{t("cta.openAccount")}</Link>
                  </Button>
                </div>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
};

export default Header;

import { Phone, Mail, ExternalLink, Instagram, Menu, X as XIcon, Facebook, Twitter, LogIn, BarChart3, ChevronDown, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useRef, useCallback, useEffect, type KeyboardEvent, type MouseEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Link, useLocation } from "react-router-dom";
import logo80 from "@/assets/logo-80.webp";
import logo160 from "@/assets/logo-160.webp";
import ThemeToggle from "@/components/ThemeToggle";
import MotionToggle from "@/components/MotionToggle";
import MegaDropdown from "@/components/header/MegaDropdown";
import MobileMenu from "@/components/header/MobileMenu";
import { activeSection, megaMenuItems } from "@/components/header/megaMenuData";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useT } from "@/i18n/LanguageContext";
import WebTradeMenu from "@/components/WebTradeMenu";
import { NAV_LABEL_KEYS } from "@/i18n/config";
import { useWatchlist } from "@/hooks/useWatchlist";
import { BRANCH_EMAILS, PRIMARY_EMAIL } from "@/lib/contact";

const CLIENT_LOGIN = "https://dashboard.parasramindia.com/Account/Login";
const SOCIALS = [
  { href: "https://www.instagram.com/parasrampanipat/", label: "Follow us on Instagram", Icon: Instagram },
  { href: "https://www.facebook.com/share/18B5W5rZaT/", label: "Follow us on Facebook", Icon: Facebook },
  { href: "https://x.com/ParasramPanipat", label: "Follow us on X (Twitter)", Icon: Twitter },
];
// Utility-bar links: 24px targets (WCAG 2.2) without growing the bar.
const UTIL_LINK = "inline-flex min-h-6 items-center gap-1.5 hover:text-secondary transition-colors";

/** Dark strip above the header: how to reach the branch, and the quieter links. Hidden on phones. */
const UtilityBar = () => (
  <div className="hidden bg-hero py-1.5 text-primary-foreground sm:block">
    <div className="container mx-auto flex items-center justify-between gap-4 px-4 text-xs">
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5">
          <Phone className="h-3.5 w-3.5 text-secondary" aria-hidden />
          <a href="tel:+919416400314" className={`${UTIL_LINK} font-medium`}>+91 9416400314</a>
          <span className="hidden text-primary-foreground/30 lg:inline" aria-hidden>·</span>
          <a href="tel:+919999790011" className={`${UTIL_LINK} hidden lg:inline-flex`}>9999790011</a>
          <span className="hidden text-primary-foreground/30 lg:inline" aria-hidden>·</span>
          <a href="tel:+919416400277" className={`${UTIL_LINK} hidden lg:inline-flex`}>9416400277</a>
        </span>
        <a href={`mailto:${PRIMARY_EMAIL}`} className={`${UTIL_LINK} hidden md:inline-flex`}>
          <Mail className="h-3.5 w-3.5" aria-hidden />{PRIMARY_EMAIL}
        </a>
        <span className="hidden items-center gap-1.5 text-primary-foreground/60 2xl:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-secondary" aria-hidden />
          SEBI Registered · Serving Investors Since 1970
        </span>
      </div>
      <div className="flex items-center gap-4">
        <Link to="/investor-corner" className={`${UTIL_LINK} hidden lg:inline-flex`}>Investor Corner</Link>
        <Link to="/help" className={`${UTIL_LINK} hidden lg:inline-flex`}>Help</Link>
        <div className="flex items-center gap-2.5 border-x border-primary-foreground/20 px-3">
          {SOCIALS.map(({ href, label, Icon }) => (
            <a key={href} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="-m-[5px] inline-flex p-[5px] transition-[color,transform] duration-fast ease-out hover:text-secondary">
              <Icon className="h-3.5 w-3.5" aria-hidden />
            </a>
          ))}
        </div>
        <a href="https://parasramindia.com" target="_blank" rel="noopener noreferrer" className={UTIL_LINK}>
          Visit Main Website <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </a>
      </div>
    </div>
  </div>
);

// First tab stop on every page (WCAG 2.4.1): past ~30 header controls to the
// content. Pages don't all have a <main>, so it falls back to what follows the header.
const skipToContent = (e: MouseEvent<HTMLAnchorElement>) => {
  e.preventDefault();
  const header = e.currentTarget.closest("header");
  // Some pages wrap the header in their <main>; skipping to that lands on the header again.
  const main = [...document.querySelectorAll<HTMLElement>("main")].find((m) => !header || !m.contains(header));
  const target = main ?? (header?.nextElementSibling as HTMLElement | null);
  if (!target) return;
  if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
  target.focus({ preventScroll: true });
  target.scrollIntoView({ block: "start" });
};

const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const location = useLocation();
  const { t } = useT();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { watchlist } = useWatchlist();
  const [scrolled, setScrolled] = useState(false);
  const current = activeSection(location.pathname);

  // Compact, elevated header once the user scrolls past the hero fold. The ref
  // guard touches React state only when the value flips, not on every scroll.
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

  useEffect(() => {
    setMobileMenuOpen(false);
    setActiveMenu(null);
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

  // Keyboard access. The panel renders after the whole nav, so Tab alone would
  // never reach it: opening from the keyboard moves focus into the panel, Escape
  // returns it to the trigger, and tabbing off either end lands back in the nav.
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const focusPanelOnOpen = useRef(false);
  const openWithFocus = (label: string) => {
    focusPanelOnOpen.current = true;
    setActiveMenu(label);
  };
  const closeToTrigger = () => {
    const label = activeMenu;
    setActiveMenu(null);
    if (label) triggerRefs.current[label]?.focus();
  };
  useEffect(() => {
    if (!activeMenu || !focusPanelOnOpen.current) return;
    focusPanelOnOpen.current = false;
    // The open menu's own panel: during a cross-fade the closing one is still in the DOM.
    const id = requestAnimationFrame(() =>
      document.querySelector<HTMLElement>(`[data-nav-panel="${CSS.escape(activeMenu)}"]`)?.querySelector<HTMLElement>("a[href], button")?.focus(),
    );
    return () => cancelAnimationFrame(id);
  }, [activeMenu]);

  const onPanelKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeToTrigger();
      return;
    }
    if (e.key !== "Tab" || !activeMenu) return;
    const panel = e.currentTarget;
    const items = [...panel.querySelectorAll<HTMLElement>("a[href], button")];
    if (e.shiftKey && document.activeElement === items[0]) {
      e.preventDefault();
      closeToTrigger();
    } else if (!e.shiftKey && document.activeElement === items[items.length - 1]) {
      e.preventDefault();
      const trigger = triggerRefs.current[activeMenu];
      const focusables = [...document.querySelectorAll<HTMLElement>("header a[href], header button")].filter((el) => el.offsetParent !== null && !panel.contains(el));
      const next = trigger ? focusables[focusables.indexOf(trigger) + 1] : undefined;
      setActiveMenu(null);
      next?.focus();
    }
  };

  const navLabel = (label: string) => {
    const key = NAV_LABEL_KEYS[label];
    return key ? t(key) : label;
  };
  const openItem = megaMenuItems.find((m) => m.label === activeMenu && m.groups);

  return (
    <header className="sticky top-0 z-50 w-full" role="banner">
      <a
        href="#main-content"
        onClick={skipToContent}
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-[60] focus:rounded-lg focus:bg-secondary focus:px-4 focus:py-2 focus:font-semibold focus:text-secondary-foreground focus:shadow-lg"
      >
        Skip to main content
      </a>
      <UtilityBar />

      <div className={`relative bg-card/95 backdrop-blur-md transition-shadow duration-base ease-out ${scrolled ? "shadow-lg" : "shadow-sm"} border-b border-border/60`}>
        <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-1">
          {/* Fixed-height logo box so the header never changes size; the shrink on
              scroll is a transform, which costs no layout. */}
          <Link to="/" className="flex h-12 shrink-0 items-center md:h-16" aria-label="Parasram India - home">
            <img
              src={logo80}
              srcSet={`${logo80} 80w, ${logo160} 160w`}
              sizes="(min-width: 768px) 80px, 48px"
              alt="Parasram - Science of Investment"
              width={80}
              height={80}
              decoding="async"
              className={`h-full w-auto origin-left transition-transform duration-base ease-out ${scrolled ? "scale-90" : "scale-100"}`}
            />
          </Link>

          <nav className="hidden items-center xl:flex" aria-label="Main navigation">
            <ul className="flex items-center">
              {megaMenuItems.map((item) => {
                const isCurrent = current === item.label;
                const isOpen = activeMenu === item.label;
                const tone = item.highlight ? "text-brand-green font-semibold" : isCurrent ? "text-secondary" : "text-foreground";
                return (
                  <li
                    key={item.label}
                    className="group/nav relative"
                    onMouseEnter={() => (item.groups ? handleMouseEnter(item.label) : setActiveMenu(null))}
                    onMouseLeave={handleMouseLeave}
                  >
                    <div className={`flex min-h-[48px] items-center whitespace-nowrap rounded-md px-2.5 text-sm font-medium transition-colors hover:bg-muted/50 2xl:px-3.5 ${tone}`}>
                      <Link to={item.href!} aria-current={isCurrent ? "page" : undefined} className="py-3 hover:text-secondary">
                        {navLabel(item.label)}
                      </Link>
                      {item.groups && (
                        <button
                          type="button"
                          ref={(el) => { triggerRefs.current[item.label] = el; }}
                          aria-expanded={isOpen}
                          aria-controls="nav-panel"
                          aria-label={`${navLabel(item.label)} menu`}
                          // A mouse click (detail > 0) just opens - hover got there first.
                          // From the keyboard (detail 0) Enter/Space toggles and moves focus in.
                          onClick={(e) => {
                            if (e.detail > 0) setActiveMenu(item.label);
                            else if (isOpen) setActiveMenu(null);
                            else openWithFocus(item.label);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "ArrowDown") {
                              e.preventDefault();
                              openWithFocus(item.label);
                            } else if (e.key === "Escape" && activeMenu) {
                              e.preventDefault();
                              setActiveMenu(null);
                            }
                          }}
                          className="-my-1 ml-0.5 rounded p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
                        >
                          <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-fast ease-out ${isOpen ? "rotate-180" : ""}`} aria-hidden />
                        </button>
                      )}
                    </div>
                    <span
                      aria-hidden
                      className={`pointer-events-none absolute bottom-1 left-2.5 right-2.5 h-0.5 origin-left rounded-full bg-secondary transition-transform duration-fast ease-out 2xl:left-3.5 2xl:right-3.5 ${
                        isCurrent || isOpen ? "scale-x-100" : "scale-x-0 group-hover/nav:scale-x-100"
                      }`}
                    />
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="flex items-center gap-2 xl:gap-1.5 2xl:gap-2">
            {/* Display preferences as one quiet group, apart from the actions. */}
            <div className="flex items-center rounded-full border border-border/70 bg-muted/30 p-0.5">
              <LanguageSwitcher labelClassName="hidden 2xl:inline" />
              <MotionToggle />
              <ThemeToggle />
            </div>
            {watchlist.length > 0 && (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="relative" title={`My Watchlist (${watchlist.length})`}>
                <Link to="/watchlist" aria-label={`My Watchlist (${watchlist.length} items)`} className="pressable relative inline-flex rounded-md p-2 text-amber-600 transition-colors hover:bg-amber-500/10">
                  <Star className="h-4 w-4 fill-amber-400" aria-hidden="true" />
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[9px] font-bold tabular-nums text-black">{watchlist.length}</span>
                </Link>
              </motion.div>
            )}
            {/* The nav and three actions need 1280px: below xl the nav sits behind
                the menu button. Between xl and 2xl client login shows its icon only,
                keeping its name for assistive tech and as a tooltip. */}
            <Button asChild variant="outline" size="sm" className="hidden border-primary/50 font-semibold text-primary hover:bg-primary hover:text-primary-foreground sm:inline-flex xl:px-2.5 2xl:px-3">
              <a href={CLIENT_LOGIN} target="_blank" rel="noopener noreferrer" aria-label={t("cta.clientLogin")} title={t("cta.clientLogin")}>
                <LogIn className="h-4 w-4 sm:mr-1 xl:mr-0 2xl:mr-1" aria-hidden="true" /><span className="xl:hidden 2xl:inline">{t("cta.clientLogin")}</span>
              </a>
            </Button>
            <WebTradeMenu>
              <Button size="sm" variant="outline" className="hidden border-secondary/50 font-semibold text-secondary hover:bg-secondary hover:text-secondary-foreground sm:inline-flex">
                <BarChart3 className="mr-1 h-4 w-4" aria-hidden />{t("cta.webTrade")}<ChevronDown className="ml-1 h-3.5 w-3.5" aria-hidden />
              </Button>
            </WebTradeMenu>
            <Button asChild className="hidden bg-secondary font-semibold text-secondary-foreground hover:bg-secondary/90 sm:inline-flex">
              <Link to="/open-account">{t("cta.openAccount")}</Link>
            </Button>
            <button
              type="button"
              className="p-2 text-foreground transition-colors hover:text-secondary xl:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            >
              {mobileMenuOpen ? <XIcon className="h-6 w-6" aria-hidden /> : <Menu className="h-6 w-6" aria-hidden />}
            </button>
          </div>
        </div>

        {/* Desktop dropdown, full width under the header. The stable key revives the
            panel if another menu opens during the ~200ms close animation - without
            it, a menu opened mid-close never rendered. */}
        <AnimatePresence>
          {openItem && (
            <div key="nav-panel" onMouseEnter={handleDropdownMouseEnter} onMouseLeave={handleMouseLeave}>
              <div id="nav-panel" data-nav-panel={openItem.label} onKeyDown={onPanelKeyDown}>
                <MegaDropdown item={openItem} onClose={() => setActiveMenu(null)} />
              </div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              // Overlays the page rather than pushing it: an in-flow menu inside the
              // sticky header added its height to the document, and closing it on a
              // same-page link pulled the target ~540px up mid-scroll.
              className="absolute inset-x-0 top-full max-h-[80vh] overflow-y-auto border-t border-border bg-card shadow-xl xl:hidden"
            >
              <MobileMenu activeLabel={current} navLabel={navLabel} onNavigate={() => setMobileMenuOpen(false)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
};

export default Header;

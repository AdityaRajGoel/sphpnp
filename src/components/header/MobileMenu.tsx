import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { BarChart3, ChevronDown, ExternalLink, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { megaMenuItems, type SubItem } from "./megaMenuData";
import { TRADING_PLATFORMS } from "@/lib/trading-platforms";
import { useT } from "@/i18n/LanguageContext";

type Props = {
  activeLabel: string | null;
  navLabel: (label: string) => string;
  onClose: () => void;
};

const CLIENT_LOGIN = "https://dashboard.parasramindia.com/Account/Login";
// The header's menu button carries aria-controls with this id; Escape returns focus to it.
const MENU_ID = "mobile-menu";
const XL = "(min-width: 1280px)";

const MobileLink = ({ item, isCurrent, onClose }: { item: SubItem; isCurrent: boolean; onClose: () => void }) => {
  const Icon = item.icon;
  const cls = "flex min-h-[48px] items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/60 aria-[current=page]:bg-muted";
  const body = (
    <>
      <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
      <span className="min-w-0">
        <span className="flex items-center gap-1 text-sm font-medium text-foreground">
          {item.label}
          {item.external && <ExternalLink className="h-3 w-3 text-muted-foreground" aria-label="(opens in a new tab)" />}
        </span>
        <span className="block text-xs text-muted-foreground">{item.description}</span>
      </span>
    </>
  );
  return item.external ? (
    <a href={item.href} target="_blank" rel="noopener noreferrer" onClick={onClose} className={cls}>{body}</a>
  ) : (
    <Link to={item.href} onClick={onClose} aria-current={isCurrent ? "page" : undefined} className={cls}>{body}</Link>
  );
};

/**
 * The menu below xl, mounted only while open. Each section is an accordion keeping
 * its desktop groups as small headings, so the two layouts share one structure.
 * All sections start closed and one opens at a time: opening the current page's
 * section (13 links under Services) pushed every other section and Open Account
 * off a phone screen. The current page is marked with aria-current instead.
 * The list scrolls; Open Account stays pinned beneath it.
 */
const MobileMenu = ({ activeLabel, navLabel, onClose }: Props) => {
  const { t } = useT();
  const { pathname, hash } = useLocation();
  const [expanded, setExpanded] = useState<string | null>(null);

  // While open the page behind is locked, and <html data-menu-open> tells the
  // floating help buttons to step aside. Both undo on close and on unmount.
  useEffect(() => {
    const { body, documentElement: html } = document;
    const prevOverflow = body.style.overflow;
    body.style.overflow = "hidden";
    html.dataset.menuOpen = "";
    return () => {
      body.style.overflow = prevOverflow;
      delete html.dataset.menuOpen;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Stop here so the same key doesn't also answer the cookie prompt (it listens on window).
      e.stopPropagation();
      onClose();
      document.querySelector<HTMLElement>(`[aria-controls="${MENU_ID}"]`)?.focus();
    };
    // At xl the panel is hidden by CSS; close it so the scroll lock goes with it.
    const desktop = matchMedia(XL);
    const onBreakpoint = () => desktop.matches && onClose();
    document.addEventListener("keydown", onKeyDown);
    desktop.addEventListener("change", onBreakpoint);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      desktop.removeEventListener("change", onBreakpoint);
    };
  }, [onClose]);

  return (
    <nav
      id={MENU_ID}
      aria-label="Mobile navigation"
      className="flex min-h-0 flex-col"
      // Tabbing past the last item would land on the dimmed page underneath: close instead.
      onBlur={(e) => {
        const next = e.relatedTarget;
        if (next instanceof Node && !e.currentTarget.closest("header")?.contains(next)) onClose();
      }}
    >
      <div className="min-h-0 overflow-y-auto overscroll-contain">
        <div className="container mx-auto px-4 pb-4 pt-1">
          {megaMenuItems.map((item) =>
            item.groups ? (
              <div key={item.label} className="border-b border-border/40">
                <button
                  type="button"
                  onClick={() => setExpanded(expanded === item.label ? null : item.label)}
                  aria-expanded={expanded === item.label}
                  className={`flex min-h-[52px] w-full items-center justify-between font-semibold transition-colors ${activeLabel === item.label ? "text-secondary" : "text-foreground"}`}
                >
                  {navLabel(item.label)}
                  <ChevronDown className={`h-4 w-4 transition-transform duration-fast ease-out ${expanded === item.label ? "rotate-180" : ""}`} aria-hidden />
                </button>
                <AnimatePresence initial={false}>
                  {expanded === item.label && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-3 pb-3">
                        {item.groups.map((g) => (
                          <div key={g.title}>
                            <p className="px-2 pb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{g.title}</p>
                            {g.items.map((it) => (
                              <MobileLink key={it.label} item={it} isCurrent={it.href === pathname + hash} onClose={onClose} />
                            ))}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <Link
                key={item.label}
                to={item.href!}
                onClick={onClose}
                aria-current={item.href === pathname ? "page" : undefined}
                className={`flex min-h-[52px] items-center border-b border-border/40 font-semibold transition-colors ${
                  item.highlight ? "text-brand-green" : activeLabel === item.label ? "text-secondary" : "text-foreground hover:text-secondary"
                }`}
              >
                {navLabel(item.label)}
              </Link>
            ),
          )}

          {/* Log in and both web platforms as plain buttons: a dropdown inside an open menu is a menu in a menu. */}
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Button asChild variant="outline" className="min-h-11 w-full border-primary/50 font-semibold text-primary hover:bg-primary hover:text-primary-foreground sm:col-span-2">
              <a href={CLIENT_LOGIN} target="_blank" rel="noopener noreferrer" onClick={onClose}>
                <LogIn className="mr-1 h-4 w-4" aria-hidden />{t("cta.clientLogin")}
              </a>
            </Button>
            {TRADING_PLATFORMS.map((platform) => (
              <Button key={platform.href} asChild className="min-h-11 w-full bg-secondary font-semibold text-secondary-foreground hover:bg-secondary/90">
                <a href={platform.href} target="_blank" rel="noopener noreferrer" onClick={onClose}>
                  <BarChart3 className="mr-1 h-4 w-4" aria-hidden />{t(platform.labelKey)}
                </a>
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-border bg-card">
        <div className="container mx-auto px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Button asChild className="min-h-11 w-full bg-brand-navy font-semibold text-white hover:bg-brand-navy/90">
            <Link to="/open-account" onClick={onClose} aria-current={pathname === "/open-account" ? "page" : undefined}>{t("cta.openAccount")}</Link>
          </Button>
        </div>
      </div>
    </nav>
  );
};

export default MobileMenu;

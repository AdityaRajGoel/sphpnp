import { useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { BarChart3, ChevronDown, ExternalLink, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { megaMenuItems, type SubItem } from "./megaMenuData";
import { TRADING_PLATFORMS } from "@/lib/trading-platforms";
import { useT } from "@/i18n/LanguageContext";

type Props = {
  activeLabel: string | null;
  navLabel: (label: string) => string;
  onNavigate: () => void;
};

const CLIENT_LOGIN = "https://dashboard.parasramindia.com/Account/Login";

const MobileLink = ({ item, onNavigate }: { item: SubItem; onNavigate: () => void }) => {
  const Icon = item.icon;
  const cls = "flex min-h-[48px] items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/60";
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
    <a href={item.href} target="_blank" rel="noopener noreferrer" onClick={onNavigate} className={cls}>{body}</a>
  ) : (
    <Link to={item.href} onClick={onNavigate} className={cls}>{body}</Link>
  );
};

/**
 * The menu below xl. Each section is an accordion keeping its desktop groups as
 * small headings, so the two layouts share one structure. The actions follow:
 * log in, both web platforms as plain buttons (a dropdown inside an open menu
 * is a menu in a menu), then Open Account.
 */
const MobileMenu = ({ activeLabel, navLabel, onNavigate }: Props) => {
  const { t } = useT();
  const [expanded, setExpanded] = useState<string | null>(activeLabel);

  return (
    <nav className="container mx-auto flex flex-col px-4 py-3" aria-label="Mobile navigation">
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
                        {g.items.map((it) => <MobileLink key={it.label} item={it} onNavigate={onNavigate} />)}
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
            onClick={onNavigate}
            className={`flex min-h-[52px] items-center border-b border-border/40 font-semibold transition-colors ${
              item.highlight ? "text-brand-green" : activeLabel === item.label ? "text-secondary" : "text-foreground hover:text-secondary"
            }`}
          >
            {navLabel(item.label)}
          </Link>
        ),
      )}

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Button asChild variant="outline" className="w-full border-primary/50 font-semibold text-primary hover:bg-primary hover:text-primary-foreground sm:col-span-2">
          <a href={CLIENT_LOGIN} target="_blank" rel="noopener noreferrer" onClick={onNavigate}>
            <LogIn className="mr-1 h-4 w-4" aria-hidden />{t("cta.clientLogin")}
          </a>
        </Button>
        {TRADING_PLATFORMS.map((platform) => (
          <Button key={platform.href} asChild className="w-full bg-secondary font-semibold text-secondary-foreground hover:bg-secondary/90">
            <a href={platform.href} target="_blank" rel="noopener noreferrer" onClick={onNavigate}>
              <BarChart3 className="mr-1 h-4 w-4" aria-hidden />{t(platform.labelKey)}
            </a>
          </Button>
        ))}
        <Button asChild className="w-full bg-brand-navy font-semibold text-white hover:bg-brand-navy/90 sm:col-span-2">
          <Link to="/open-account" onClick={onNavigate}>{t("cta.openAccount")}</Link>
        </Button>
      </div>
    </nav>
  );
};

export default MobileMenu;

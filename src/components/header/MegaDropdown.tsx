import { Link } from "react-router-dom";
import { ArrowRight, ExternalLink } from "lucide-react";
import { motion } from "motion/react";
import type { MegaMenuItem, SubItem } from "./megaMenuData";
import { EASE_OUT } from "@/lib/motion";
import { MONEY_HERO, SCREEN_SIZE } from "@/components/apps/appMedia";

interface MegaDropdownProps {
  item: MegaMenuItem;
  onClose: () => void;
}

const ItemLink = ({ item, onClose }: { item: SubItem; onClose: () => void }) => {
  const Icon = item.icon;
  const body = (
    <>
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/[0.07] text-primary transition-colors group-hover:bg-secondary/15 group-hover:text-secondary">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1 text-sm font-semibold text-foreground group-hover:text-secondary">
          {item.label}
          {item.external && <ExternalLink className="h-3 w-3 text-muted-foreground" aria-label="(opens in a new tab)" />}
        </span>
        <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{item.description}</span>
      </span>
    </>
  );
  const cls = "group -mx-2 flex items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary";
  return item.external ? (
    <a href={item.href} target="_blank" rel="noopener noreferrer" onClick={onClose} className={cls}>{body}</a>
  ) : (
    <Link to={item.href} onClick={onClose} className={cls}>{body}</Link>
  );
};

/**
 * One dropdown: titled columns of links, then a feature card that gives one
 * destination a reason to be clicked. Full width under the header, so a menu
 * with three groups reads as three short lists rather than one long grid.
 */
const MegaDropdown = ({ item, onClose }: MegaDropdownProps) => {
  const groups = item.groups ?? [];
  const feature = item.feature;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.18, ease: EASE_OUT }}
      className="absolute left-0 top-full z-50 w-full border-b border-border bg-card shadow-xl"
    >
      <div className="container mx-auto grid gap-8 px-4 py-7" style={{ gridTemplateColumns: `repeat(${groups.length}, minmax(0, 1fr))${feature ? " 19rem" : ""}` }}>
        {groups.map((g) => (
          <div key={g.title}>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{g.title}</p>
            <ul className="space-y-0.5">
              {g.items.map((it) => (
                <li key={it.label}><ItemLink item={it} onClose={onClose} /></li>
              ))}
            </ul>
          </div>
        ))}

        {feature && (
          <Link
            to={feature.href}
            onClick={onClose}
            className="group relative flex min-h-[13rem] self-start overflow-hidden rounded-2xl bg-hero p-5 text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2"
          >
            <span className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-secondary/30 blur-3xl" />
            <span className="relative flex min-w-0 flex-1 flex-col">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-secondary">{feature.eyebrow}</span>
              <span className="mt-1.5 font-heading text-lg font-bold leading-tight">{feature.title}</span>
              <span className="mt-1.5 text-xs leading-relaxed text-primary-foreground/75">{feature.body}</span>
              <span className="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-semibold text-secondary">
                {feature.cta}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </span>
            </span>
            {feature.showAppShot && (
              <img
                src={MONEY_HERO.src}
                alt=""
                width={SCREEN_SIZE.width}
                height={SCREEN_SIZE.height}
                decoding="async"
                className="relative -mb-10 ml-3 w-20 shrink-0 self-end rounded-xl border-[3px] border-foreground/90 shadow-xl transition-transform duration-base group-hover:-translate-y-1"
              />
            )}
          </Link>
        )}
      </div>
    </motion.div>
  );
};

export default MegaDropdown;

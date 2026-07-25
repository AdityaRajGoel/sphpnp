import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { motion } from "motion/react";
import type { SubItem } from "./megaMenuData";
import { EASE_OUT } from "@/lib/motion";

interface MegaDropdownProps {
  items: SubItem[];
  onClose: () => void;
}

const MegaDropdown = ({ items, onClose }: MegaDropdownProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.2, ease: EASE_OUT }}
      className="absolute top-full left-0 w-full bg-card border-b border-border shadow-xl z-50"
    >
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1">
          {items.map((item) => {
            const Icon = item.icon;
            const content = (
              <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors group cursor-pointer">
                <div className="mt-0.5 flex-shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Icon className="w-4.5 h-4.5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors inline-flex items-center gap-1">
                    {item.label}
                    {item.external && <ExternalLink className="w-3 h-3 text-muted-foreground" />}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
            );

            if (item.external) {
              return (
                <a
                  key={item.label}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={onClose}
                >
                  {content}
                </a>
              );
            }

            return (
              <Link key={item.label} to={item.href} onClick={onClose}>
                {content}
              </Link>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
};

export default MegaDropdown;

import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight, Phone } from "lucide-react";

// Persistent mobile conversion anchor (competitor pattern). Appears after the
// user scrolls past the hero and stays pinned to the bottom. Mobile-only.
const StickyMobileCTA = () => {
  const [show, setShow] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Not useful on the account-opening flow itself, or on admin/auth screens.
  const hidden = /^\/(open-account|auth|admin|reset-password|banner-manager)/.test(pathname);
  if (hidden) return null;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 90 }}
          animate={{ y: 0 }}
          exit={{ y: 90 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed bottom-0 inset-x-0 z-40 md:hidden px-3 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] bg-gradient-to-t from-background via-background to-transparent"
        >
          <div className="flex items-center gap-2">
            <a
              href="tel:+919416400314"
              aria-label="Call Parasram India Panipat"
              className="shrink-0 h-12 w-12 flex items-center justify-center rounded-xl border border-border bg-card text-secondary shadow-lg active:scale-[0.97] transition-transform"
            >
              <Phone className="w-5 h-5" />
            </a>
            <Link
              to="/open-account"
              className="flex-1 h-12 flex items-center justify-center gap-2 rounded-xl btn-shine bg-gradient-to-r from-secondary to-brand-green text-secondary-foreground font-bold shadow-lg active:scale-[0.97] transition-transform"
            >
              Open Free Demat Account <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default StickyMobileCTA;

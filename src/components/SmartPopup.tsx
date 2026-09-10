import { useState, useEffect, useId, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Mail, ArrowRight } from 'lucide-react';
import { useEngagement } from '@/hooks/useEngagement';
import { Button } from '@/components/ui/button';
import { useLocation, Link } from 'react-router-dom';

const SmartPopup = () => {
  const { timeOnPage, scrollDepth } = useEngagement();
  const [isVisible, setIsVisible] = useState(false);
  const location = useLocation();
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<Element | null>(null);

  useEffect(() => {
    // Check if we've already shown it today
    const lastShown = localStorage.getItem('parasram_popup_shown_date');
    const today = new Date().toDateString();
    
    if (lastShown === today) return; // Already shown today

    // Trigger conditions: > 40 seconds on page OR > 60% scroll down
    if (timeOnPage > 40 || scrollDepth > 60) {
      // Small delay on scroll to not seem overly aggressive
      const timer = setTimeout(() => {
        setIsVisible(true);
        localStorage.setItem('parasram_popup_shown_date', today);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [timeOnPage, scrollDepth]);

  const handleClose = () => {
    setIsVisible(false);
  };

  /*
   * Focus moves into the dialog when it opens and returns where it came from
   * when it closes.
   *
   * Without this the popup is unreachable by keyboard: it covers the viewport
   * at z-100 and takes the click and Escape handlers, but focus stays behind it
   * on whatever the reader was last on, so a keyboard or screen-reader user is
   * left tabbing through a page they can no longer see or interact with. The
   * dismissal paths were already correct - backdrop click and Escape both work
   * - it was only ever the focus and the announcement that were missing.
   */
  useEffect(() => {
    if (!isVisible) return;
    openerRef.current = document.activeElement;
    // Deferred a frame: the element does not exist until after this commit
    // paints, and focusing the close button is the least presumptuous landing
    // spot - it does not steer anyone toward the call to action.
    const frame = requestAnimationFrame(() => closeRef.current?.focus());
    return () => {
      cancelAnimationFrame(frame);
      const opener = openerRef.current;
      if (opener instanceof HTMLElement && document.contains(opener)) opener.focus();
    };
  }, [isVisible]);

  // Escape key to close
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsVisible(false);
    };
    if (isVisible) {
      document.addEventListener("keydown", handleKey);
      return () => document.removeEventListener("keydown", handleKey);
    }
  }, [isVisible]);

  // The home page has admin-managed banners with their own dismissal and
  // frequency controls. Never stack this generic engagement popup over them.
  if (['/', '/admin', '/auth', '/reset-password', '/banner-manager', '/open-account'].includes(location.pathname)) {
    return null;
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center pointer-events-none p-4 pb-8 sm:p-0"
        >
          <motion.div 
            className="fixed inset-0 bg-background/80 backdrop-blur-sm pointer-events-auto"
            onClick={handleClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div 
            className="bg-card w-full max-w-md p-6 sm:p-8 rounded-3xl border border-border shadow-2xl relative z-10 pointer-events-auto overflow-hidden"
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", duration: 0.5 }}
          >
            {/* Background elements */}
            <div aria-hidden="true" className="absolute top-0 right-0 w-32 h-32 bg-brand-gold/10 rounded-full blur-2xl transform translate-x-10 -translate-y-10"></div>
            
            <button 
              ref={closeRef}
              onClick={handleClose}
              type="button"
              aria-label="Close"
              className="absolute top-4 right-4 p-2 bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground rounded-full transition-colors z-20"
            >
              <X className="w-4 h-4" />
            </button>
            
            <div className="relative z-10 text-center">
              <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center mb-5">
                <Mail className="w-8 h-8 text-primary" />
              </div>
              <h2 id={titleId} className="text-2xl font-bold font-heading text-foreground mb-3">Maximize Your Wealth</h2>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                You've been exploring our tools! Let our experts guide your portfolio strategy. Need help starting your investment journey?
              </p>
              
              <div className="flex flex-col gap-3">
                <Button asChild className="w-full text-base py-6 bg-brand-gold hover:bg-brand-gold/90 text-primary-foreground font-bold rounded-xl shadow-md">
                  <Link to="/open-account" onClick={handleClose}>Open Account <ArrowRight className="w-4 h-4 ml-2" /></Link>
                </Button>
                <Button asChild variant="outline" className="w-full text-base py-6 border-primary/20 text-primary hover:bg-primary/5 rounded-xl">
                  <a href="mailto:parasrampnp@gmail.com" onClick={handleClose}>Contact an Advisor</a>
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default SmartPopup;

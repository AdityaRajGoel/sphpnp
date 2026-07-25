import { useLocation, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { TrendingUp, Home, ArrowLeft, Search, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import SEOHead from "@/components/SEOHead";
import PageTransition from "@/components/PageTransition";
import { EASE_OUT } from "@/lib/motion";

const glitchVariants = {
  animate: {
    x: [0, -2, 3, -1, 0],
    transition: { duration: 0.3, repeat: Infinity, repeatDelay: 3 },
  },
};

const NotFound = () => {
  const location = useLocation();
  const [tickerPrice, setTickerPrice] = useState(404.0);

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  // Fake ticker animation
  useEffect(() => {
    const interval = setInterval(() => {
      setTickerPrice((p) => {
        const delta = (Math.random() - 0.5) * 2;
        return Math.max(400, Math.min(410, +(p + delta).toFixed(2)));
      });
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const suggestedPages = [
    { label: "Home", href: "/", icon: Home },
    { label: "Open Account", href: "/open-account", icon: TrendingUp },
    { label: "Services", href: "/services", icon: Search },
    { label: "Contact Us", href: "/contact", icon: HelpCircle },
  ];

  return (
    <PageTransition>
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      <SEOHead title="Page Not Found" description="The page you are looking for does not exist on Parasram India Panipat." noindex />
      {/* Background grid pattern */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }} />

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: EASE_OUT }}
        className="text-center relative z-10 max-w-lg mx-auto"
      >
        {/* Stock ticker style 404 */}
        <motion.div
          variants={glitchVariants}
          animate="animate"
          className="inline-block mb-6"
        >
          <div className="bg-card border border-border rounded-2xl p-6 shadow-lg">
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
              <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Page Not Found</span>
            </div>
            <motion.div
              className="text-7xl sm:text-8xl font-heading font-black text-foreground leading-none"
              key={tickerPrice}
              initial={{ y: -5, opacity: 0.7 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              {tickerPrice.toFixed(2)}
            </motion.div>
            <div className="flex items-center justify-center gap-2 mt-2">
              <span className="text-destructive font-mono text-sm font-bold">▼ -100.00%</span>
              <span className="text-xs text-muted-foreground font-mono">PAGE.NS</span>
            </div>
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-xl sm:text-2xl font-heading font-bold text-foreground mb-2"
        >
          This page hit the circuit breaker
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-muted-foreground mb-1"
        >
          The route <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">{location.pathname}</code> doesn't exist.
        </motion.p>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="text-sm text-muted-foreground mb-8"
        >
          Don't worry - your portfolio is safe. Let's get you back on track.
        </motion.p>

        {/* Action buttons */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8"
        >
          <Button asChild size="lg" className="bg-secondary hover:bg-secondary/90 text-secondary-foreground font-semibold">
            <Link to="/"><Home className="w-4 h-4 mr-2" /> Go Home</Link>
          </Button>
          <Button asChild variant="outline" size="lg" onClick={() => window.history.back()}>
            <a href="#" onClick={(e) => { e.preventDefault(); window.history.back(); }}><ArrowLeft className="w-4 h-4 mr-2" /> Go Back</a>
          </Button>
        </motion.div>

        {/* Suggested pages */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wider">Popular pages</p>
          <div className="flex flex-wrap justify-center gap-2">
            {suggestedPages.map((page) => (
              <Link
                key={page.href}
                to={page.href}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 text-sm text-foreground transition-colors"
              >
                <page.icon className="w-3.5 h-3.5 text-muted-foreground" />
                {page.label}
              </Link>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </div>
    </PageTransition>
  );
};

export default NotFound;

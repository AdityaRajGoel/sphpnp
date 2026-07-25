import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MessageCircle, PhoneCall, Download, X, HelpCircle, ArrowUp } from "lucide-react";

const FloatingActions = () => {
  const [expanded, setExpanded] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const phoneNumber = "919416400314";
  const whatsappMessage = "Hello! I'm interested in learning more about your investment services at Parasram Panipat.";
  const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(whatsappMessage)}`;
  const callbackMessage = "Hi, I would like to request a callback from Parasram Panipat branch.";
  const callbackUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(callbackMessage)}`;

  // Show back-to-top after scrolling 400px
  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const actions = [
    {
      icon: MessageCircle,
      label: "WhatsApp Chat",
      href: whatsappUrl,
      color: "bg-green-500 hover:bg-green-600 shadow-green-500/30",
    },
    {
      icon: PhoneCall,
      label: "Request Callback",
      href: callbackUrl,
      color: "bg-blue-500 hover:bg-blue-600 shadow-blue-500/30",
    },
    {
      icon: Download,
      label: "Download App",
      href: "https://play.google.com/store/apps/details?id=com.parasramindia.xts",
      color: "bg-purple-500 hover:bg-purple-600 shadow-purple-500/30",
    },
  ];

  return (
    <div className="fixed bottom-24 md:bottom-6 right-6 z-50 flex flex-col items-end gap-3 pb-[env(safe-area-inset-bottom)]">
      {/* Back to top button */}
      <AnimatePresence>
        {showBackToTop && !expanded && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            aria-label="Scroll to top"
            className="w-10 h-10 rounded-full bg-card/90 backdrop-blur-md border border-border/50 text-muted-foreground hover:text-foreground hover:bg-accent shadow-lg flex items-center justify-center transition-colors"
          >
            <ArrowUp className="w-4 h-4" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Expanded action buttons */}
      <AnimatePresence>
        {expanded && (
          <>
            {actions.map((action, i) => (
              <motion.a
                key={action.label}
                href={action.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-3 group`}
                initial={{ opacity: 0, y: 20, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.8 }}
                transition={{ delay: (actions.length - 1 - i) * 0.06, duration: 0.2 }}
              >
                {/* Label tooltip */}
                <span className="bg-card/95 backdrop-blur-md text-foreground text-sm font-medium px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-[opacity,transform] ease-out duration-200">
                  {action.label}
                </span>

                {/* Icon button */}
                <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg ${action.color} text-white transition-transform ease-out duration-200 hover:scale-110`}>
                  <action.icon className="w-5 h-5" />
                </div>
              </motion.a>
            ))}
          </>
        )}
      </AnimatePresence>

      {/* Main toggle button */}
      <motion.button
        onClick={() => setExpanded(!expanded)}
        className="relative"
        whileTap={{ scale: 0.9 }}
        aria-label={expanded ? "Close help menu" : "Open help menu"}
      >
        {/* Pulse ring when collapsed */}
        {!expanded && (
          <div className="absolute inset-0 bg-green-500 rounded-full animate-ping opacity-25" />
        )}

        <motion.div
          className={`relative w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-colors duration-300 ${
            expanded
              ? "bg-card text-foreground border border-border/50 hover:bg-accent"
              : "bg-green-500 hover:bg-green-600 text-white shadow-green-500/30"
          }`}
          animate={{ rotate: expanded ? 90 : 0 }}
          transition={{ duration: 0.2 }}
        >
          {expanded ? (
            <X className="w-6 h-6" />
          ) : (
            <HelpCircle className="w-7 h-7" />
          )}
        </motion.div>
      </motion.button>
    </div>
  );
};

export default FloatingActions;

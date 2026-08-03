import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, HelpCircle, ArrowUp } from "lucide-react";
import WhatsappIcon from "@/components/icons/WhatsappIcon";
import PhoneVolumeIcon from "@/components/icons/PhoneVolumeIcon";
import DownloadIcon from "@/components/icons/DownloadIcon";
import { canHover } from "@/components/icons/useAnimatedIcon";
import type { AnimatedIconHandle, AnimatedIconProps } from "@/components/icons/types";

type AnimatedIcon = React.ForwardRefExoticComponent<
  AnimatedIconProps & React.RefAttributes<AnimatedIconHandle>
>;

interface Action {
  icon: AnimatedIcon;
  label: string;
  href: string;
  color: string;
}

/**
 * One expanded action. Split out of the map so each row can hold its own icon
 * ref: on a touch device `onHoverStart` never fires, so without this the icons
 * would be inert for most of our visitors. Playing them once on arrival is the
 * only moment a phone user ever sees the motion.
 */
const ActionButton = ({ action, delay }: { action: Action; delay: number }) => {
  const iconRef = useRef<AnimatedIconHandle>(null);
  const Icon = action.icon;

  useEffect(() => {
    if (canHover()) return;
    const id = setTimeout(() => iconRef.current?.startAnimation(), delay * 1000 + 120);
    return () => clearTimeout(id);
  }, [delay]);

  return (
    <motion.a
      href={action.href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 group"
      initial={{ opacity: 0, y: 20, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.8 }}
      transition={{ delay, duration: 0.2 }}
    >
      {/* Label tooltip */}
      <span className="bg-card/95 backdrop-blur-md text-foreground text-sm font-medium px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-[opacity,transform] ease-out duration-fast">
        {action.label}
      </span>

      {/* Icon button */}
      <div
        className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg ${action.color} text-white transition-transform ease-out duration-fast hover:scale-110`}
      >
        <Icon ref={iconRef} size={20} />
      </div>
    </motion.a>
  );
};

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

  const actions: Action[] = [
    {
      icon: WhatsappIcon,
      label: "WhatsApp Chat",
      href: whatsappUrl,
      color: "bg-green-500 hover:bg-green-600 shadow-green-500/30",
    },
    {
      icon: PhoneVolumeIcon,
      label: "Request Callback",
      href: callbackUrl,
      color: "bg-blue-500 hover:bg-blue-600 shadow-blue-500/30",
    },
    {
      icon: DownloadIcon,
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
              <ActionButton
                key={action.label}
                action={action}
                delay={(actions.length - 1 - i) * 0.06}
              />
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
          className={`relative w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-colors duration-base ${
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

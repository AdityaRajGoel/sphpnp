import { useCallback, useEffect, useRef, useState } from "react";
import { Info, AlertTriangle, CheckCircle, Sparkles, ExternalLink, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { HIGH_FETCH_PRIORITY } from "@/lib/fetch-priority";

type BannerType = "none" | "info" | "warning" | "success" | "promo";

type Banner = {
  id: string;
  title: string | null;
  message: string;
  type: BannerType;
  link_url: string | null;
  link_text: string | null;
  button_text: string | null;
  image_url: string | null;
  bg_theme: string;
};

const bannerStyles: Record<BannerType, { bg: string; icon: typeof Info; iconColor: string }> = {
  none: { bg: "", icon: Info, iconColor: "" },
  info: { bg: "bg-blue-500/10", icon: Info, iconColor: "text-blue-500" },
  warning: { bg: "bg-amber-500/10", icon: AlertTriangle, iconColor: "text-amber-500" },
  success: { bg: "bg-emerald-500/10", icon: CheckCircle, iconColor: "text-emerald-500" },
  promo: { bg: "bg-purple-500/10", icon: Sparkles, iconColor: "text-purple-500" },
};

// A popup that has been dismissed should stay gone for the rest of the browsing
// session, including when visitors navigate away from and back to the home
// route. Keep IDs—not a global boolean—so publishing a genuinely new popup can
// still be shown in the same session.
const DISMISSED_BANNERS_KEY = "pnp_dismissed_banner_ids";
const AUTO_DISMISS_MS = 60_000;

const readDismissedIds = (): Set<string> => {
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(DISMISSED_BANNERS_KEY) ?? "[]");
    return new Set(Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : []);
  } catch {
    return new Set();
  }
};

const persistDismissedIds = (ids: Set<string>) => {
  try {
    sessionStorage.setItem(DISMISSED_BANNERS_KEY, JSON.stringify([...ids]));
  } catch {
    // Private browsing and storage-restricted contexts still get the in-memory dismissal.
  }
};

const getThemeStyles = (theme: string, type: BannerType) => {
  const baseTypeStyle = bannerStyles[type] || bannerStyles.info;
  
  switch(theme) {
    case 'dark':
      return { 
        container: "bg-slate-900 border-slate-800 text-white", 
        text: "text-slate-300", 
        title: "text-white", 
        iconBg: "bg-slate-800", 
        iconCol: baseTypeStyle.iconColor 
      };
    case 'brand-gradient':
      return { 
        container: "bg-gradient-to-br from-primary via-primary/90 to-secondary/90 text-white border-primary/20", 
        text: "text-white/90", 
        title: "text-white", 
        iconBg: "bg-white/10", 
        iconCol: "text-white" 
      };
    case 'default':
    default:
      return { 
        container: "bg-card text-card-foreground", 
        text: "text-muted-foreground", 
        title: "text-foreground", 
        iconBg: baseTypeStyle.bg, 
        iconCol: baseTypeStyle.iconColor 
      };
  }
};

const BannerMessage = () => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(readDismissedIds);
  const [isOpen, setIsOpen] = useState(false);
  const dismissedIdsRef = useRef(dismissedIds);

  useEffect(() => {
    dismissedIdsRef.current = dismissedIds;
  }, [dismissedIds]);

  useEffect(() => {
    let openTimer: number | undefined;

    const fetchBanners = async () => {
      try {
        const { data, error } = await supabase
          .from("banner_messages" as never)
          .select("id, title, message, type, link_url, link_text, button_text, image_url, bg_theme")
          .eq("is_active", true)
          .order("display_order", { ascending: true });
        
        if (!error && data) {
          const fetchedBanners = data as unknown as Banner[];
          setBanners(fetchedBanners);
          
          // Check if the FIRST UN-DISMISSED banner exists
          const activeBanner = fetchedBanners.find((banner) => !dismissedIdsRef.current.has(banner.id));
          if (activeBanner) {
            // Slight delay so the UI does not jerk instantly on mount
            openTimer = window.setTimeout(() => setIsOpen(true), 500);
          }
        }
      } catch {
        // Silently fail - banners aren't strictly required
      }
    };

    fetchBanners();
    return () => {
      if (openTimer !== undefined) window.clearTimeout(openTimer);
    };
  }, []);

  const visibleBanners = banners.filter((b) => !dismissedIds.has(b.id));
  const activeBannerId = visibleBanners[0]?.id;

  const dismiss = useCallback(() => {
    setIsOpen(false);
    
    // Once dialog is dismissed, we mark all current visible banners as dismissed in memory
    // so it doesn't immediately pop up again during this single page view session
    if (visibleBanners.length === 0) return;
    setDismissedIds((previous) => {
      const updated = new Set(previous);
      visibleBanners.forEach((banner) => updated.add(banner.id));
      persistDismissedIds(updated);
      return updated;
    });
  }, [visibleBanners]);

  // The popup remains useful without holding a visitor hostage. An unopened
  // popup never starts this timer; a manually closed one clears it naturally.
  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [isOpen, activeBannerId, dismiss]);

  if (visibleBanners.length === 0) return null;

  const activeBanner = visibleBanners[0];
  const typeStyle = bannerStyles[activeBanner.type] || bannerStyles.info;
  const themeStyle = getThemeStyles(activeBanner.bg_theme, activeBanner.type);
  const Icon = typeStyle.icon;

  const hasTextContent = !!activeBanner.title || !!activeBanner.message;
  const hasAction = !!activeBanner.link_url;
  const hasContentArea = hasTextContent || hasAction;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) dismiss();
    }}>
      <DialogContent hideClose className={`w-[calc(100%-2rem)] max-w-4xl max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl p-0 border border-border/50 shadow-2xl ${activeBanner.image_url && hasContentArea ? "md:grid md:grid-cols-[1.1fr_0.9fr]" : ""} ${themeStyle.container}`}>
        
        {/* Custom Labeled Close Button */}
        <div className="absolute top-4 right-4 md:top-6 md:right-6 z-50">
          <DialogClose asChild>
            <button
            type="button"
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-md border border-white/20 transition-colors duration-fast"
            >
              <span className="text-xs font-bold uppercase tracking-wider">Close</span>
              <X className="w-4 h-4" />
            </button>
          </DialogClose>
        </div>
        
        {/* Image-led showcase on desktop, with the message/action held alongside it. */}
        {activeBanner.image_url && (
            <div className={`relative bg-black/5 ${hasContentArea ? "border-b border-border/10 md:border-b-0 md:border-r" : "p-4 md:p-8"}`}>
               <img 
                 src={activeBanner.image_url} 
                 alt={activeBanner.title || `Promotional ${activeBanner.type} Banner`} 
                 className={`block mx-auto w-full h-auto max-h-[52vh] md:max-h-[70vh] object-contain ${hasContentArea ? "md:h-full" : "rounded-xl"}`}
                 loading="eager"
                 {...HIGH_FETCH_PRIORITY}
               />
            </div>
        )}
        
        {/* Tight Content Section underneath without enormous spaces */}
        {hasContentArea && (
          <div className="p-6 sm:p-8 w-full flex flex-col items-center justify-center text-center md:items-start md:text-left">
            {activeBanner.type !== 'none' && (
              <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0 mb-3 ${themeStyle.iconBg} shadow-sm border border-border/10`}>
                 <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${themeStyle.iconCol}`} />
              </div>
            )}
            
            {activeBanner.title && (
              <DialogTitle className={`text-base sm:text-2xl font-heading font-bold leading-tight ${themeStyle.title}`}>
                {activeBanner.title}
              </DialogTitle>
            )}

            {activeBanner.message && (
              <DialogDescription className={`mt-1.5 sm:mt-2 text-xs sm:text-base leading-snug sm:leading-relaxed ${themeStyle.text} whitespace-pre-wrap`}>
                {activeBanner.message}
              </DialogDescription>
            )}

            {hasAction && (
              <div className="mt-5 flex w-full justify-center md:justify-start">
                <Button asChild className="w-full sm:w-auto" variant={activeBanner.bg_theme === 'brand-gradient' ? 'secondary' : 'default'}>
                  <a href={activeBanner.link_url!} target="_blank" rel="noopener noreferrer" onClick={dismiss}>
                    {activeBanner.button_text || activeBanner.link_text || "Learn More"}
                    <ExternalLink className="w-4 h-4 ml-2" />
                  </a>
                </Button>
              </div>
            )}
          </div>
        )}
        
        {/* Radix requirement for accessibility when title isn't explicitly rendered */}
        {!activeBanner.title && <DialogTitle className="sr-only">Notice</DialogTitle>}
      </DialogContent>
    </Dialog>
  );
};

export default BannerMessage;

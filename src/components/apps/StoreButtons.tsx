import type { TradingApp } from "@/lib/trading-apps";
import { useT } from "@/i18n/LanguageContext";
import { fill } from "@/i18n/config";

type Props = {
  app: TradingApp;
  /** "onDark" for the navy sections, "onLight" for cards and the header menu. */
  tone?: "onDark" | "onLight";
  size?: "md" | "sm";
  className?: string;
};

const PlayGlyph = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[1.35em] w-[1.35em] shrink-0 fill-current">
    <path d="M3.6 1.8 13.5 12l-9.9 10.2c-.4-.2-.6-.6-.6-1.1V2.9c0-.5.2-.9.6-1.1Zm11.3 11.6 2.6 2.6-11.7 6.7 9.1-9.3Zm3.6-3.6 3 1.7c.8.5.8 1.6 0 2.1l-3 1.7-2.8-2.8 2.8-2.7ZM5.8 1.3l11.7 6.7-2.6 2.6-9.1-9.3Z" />
  </svg>
);

const AppleGlyph = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[1.35em] w-[1.35em] shrink-0 fill-current">
    <path d="M16.37 1.43c0 1.14-.5 2.27-1.18 3.08-.74.9-1.99 1.57-2.99 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.57-2.27 1.21-2.98.8-.94 2.14-1.64 3.25-1.68.03.13.05.28.05.43Zm4.56 15.71c-.03.07-.46 1.58-1.52 3.12-.94 1.34-1.94 2.71-3.43 2.71-1.52 0-1.9-.88-3.63-.88-1.7 0-2.3.91-3.67.91-1.38 0-2.33-1.26-3.43-2.8C4 18.38 2.96 15.57 2.96 12.92c0-4.28 2.8-6.55 5.55-6.55 1.45 0 2.68.95 3.6.95.87 0 2.22-1.01 3.9-1.01.62 0 2.89.06 4.38 2.19-.13.09-2.38 1.37-2.38 4.19 0 3.26 2.85 4.42 2.95 4.45Z" />
  </svg>
);

/**
 * Store badges for one app. Real links with the app's name in the accessible
 * label, so a screen reader hears "Get Parasram Money on Google Play" rather
 * than two identical "Google Play" links per page.
 */
const StoreButtons = ({ app, tone = "onDark", size = "md", className = "" }: Props) => {
  const { t } = useT();
  const skin =
    tone === "onDark"
      ? "bg-white text-brand-navy hover:bg-white/90 ring-1 ring-white/20"
      : "bg-brand-navy text-white hover:bg-brand-navy/90 dark:bg-white dark:text-brand-navy";
  const scale = size === "sm" ? "text-[13px] px-3 py-1.5 gap-2" : "text-base px-4 py-2.5 gap-2.5";
  const stores = [
    { href: app.playHref, eyebrow: t("store.playEyebrow"), label: "Google Play", Glyph: PlayGlyph },
    { href: app.iosHref, eyebrow: t("store.iosEyebrow"), label: "App Store", Glyph: AppleGlyph },
  ];

  return (
    <div className={`flex flex-wrap gap-2.5 ${className}`}>
      {stores.map(({ href, eyebrow, label, Glyph }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={fill(t("store.aria"), { app: t(app.nameKey), store: label })}
          className={`inline-flex items-center rounded-xl font-semibold shadow-sm transition-[background-color,transform] duration-fast ease-out hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 ${skin} ${scale}`}
        >
          <Glyph />
          <span className="flex flex-col items-start leading-none">
            <span className="text-[0.62em] font-medium uppercase tracking-wide opacity-75">{eyebrow}</span>
            <span className="mt-0.5">{label}</span>
          </span>
        </a>
      ))}
    </div>
  );
};

export default StoreButtons;

import { useState, useRef, useEffect } from "react";
import { Globe, Check, ChevronDown } from "lucide-react";
import { useT } from "@/i18n/LanguageContext";
import { LANGUAGES, type Lang } from "@/i18n/config";

// Compact globe dropdown for switching UI language. Closes on outside click / Esc.
// labelClassName decides when the language name shows beside the globe.
const LanguageSwitcher = ({ className = "", labelClassName = "hidden sm:inline" }: { className?: string; labelClassName?: string }) => {
  const { lang, setLang, t } = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const choose = (code: Lang) => {
    setLang(code);
    setOpen(false);
  };

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("lang.label")}
        className="inline-flex items-center gap-1.5 min-h-[40px] px-2.5 rounded-lg text-sm font-medium text-foreground/80 hover:text-foreground hover:bg-muted/60 transition-colors"
      >
        <Globe className="w-4 h-4" />
        <span className={labelClassName}>{current.native}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute right-0 mt-1 w-40 rounded-xl border border-border bg-card shadow-lg py-1 z-50"
        >
          {LANGUAGES.map((l) => (
            <li key={l.code}>
              <button
                type="button"
                role="option"
                aria-selected={l.code === lang}
                onClick={() => choose(l.code)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm text-left text-foreground hover:bg-muted/60 transition-colors"
              >
                <span>
                  {l.native}
                  {l.native !== l.label && <span className="text-muted-foreground text-xs ml-1.5">{l.label}</span>}
                </span>
                {l.code === lang && <Check className="w-4 h-4 text-secondary" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default LanguageSwitcher;

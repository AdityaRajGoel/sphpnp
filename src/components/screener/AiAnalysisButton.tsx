import { Bot } from "lucide-react";

/** The row action that opens the AI analysis for one stock, in every screener view. */
export default function AiAnalysisButton({ symbol, name, onAnalyse }: { symbol: string; name: string; onAnalyse: (symbol: string) => void }) {
  return (
    <button
      type="button"
      aria-label={`AI analysis of ${name}`}
      onClick={(e) => { e.stopPropagation(); onAnalyse(symbol); }}
      className="inline-flex min-h-[44px] items-center gap-1 rounded-md border border-border px-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange md:h-8 md:min-h-0"
    >
      <Bot className="h-3.5 w-3.5" aria-hidden /> AI
    </button>
  );
}

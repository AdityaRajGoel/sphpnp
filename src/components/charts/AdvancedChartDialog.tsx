import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ApiChartPoint } from "@/lib/chart-data";

// KLineChart is browser-only and ~59kB gzipped. Kept behind the same lazy
// boundary the inline advanced view uses, so opening this dialog is the first
// moment a visitor pays for it.
const AdvancedChart = lazy(() => import("@/components/charts/AdvancedChart"));

/**
 * Full-window advanced chart.
 *
 * The charts embedded around the site are deliberately small - they answer
 * "which way is it going" at a glance. This is the other mode: a large canvas
 * with the indicator set, drawing tools, and the instrument's identity and
 * price stated around it, for someone who has stopped skimming and started
 * looking.
 *
 * Range selection is optional and controlled by the caller, because each
 * surface fetches its own history on its own key. Passing `ranges` without
 * `onRangeChange` renders nothing rather than dead buttons.
 */
export interface AdvancedChartDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: readonly ApiChartPoint[];
  /** Ticker shown in the crosshair readout, e.g. "RELIANCE.NS" or "NIFTY". */
  ticker: string;
  /** Headline label - the instrument's common name. */
  title: string;
  /** Company name, index description, or exchange. */
  subtitle?: string;
  /** Last traded price, already formatted for display. */
  price?: string;
  /** Change over the shown range, already formatted for display (e.g. "+1.24%"). */
  change?: string;
  /** Direction, since `change` arrives pre-formatted and is not parsed here. */
  up?: boolean;
  ranges?: readonly { label: string; range: string }[];
  activeRange?: string;
  onRangeChange?: (range: string) => void;
  loading?: boolean;
}

const AdvancedChartDialog = ({
  open,
  onOpenChange,
  data,
  ticker,
  title,
  subtitle,
  price,
  change,
  up = true,
  ranges,
  activeRange,
  onRangeChange,
  loading = false,
}: AdvancedChartDialogProps) => {
  const showRanges = ranges && ranges.length > 0 && onRangeChange;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(1200px,96vw)] w-[96vw] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/60 text-left space-y-0">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 pr-8">
            <div className="min-w-0">
              <DialogTitle className="font-heading text-xl md:text-2xl font-bold text-foreground truncate">
                {title}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground truncate">
                {subtitle ? `${subtitle} · ${ticker}` : ticker}
              </DialogDescription>
            </div>

            {price && (
              <div className="flex items-baseline gap-2 shrink-0">
                <span className="text-xl md:text-2xl font-bold text-foreground tabular-nums">
                  {price}
                </span>
                {change && (
                  <span
                    className={`text-sm font-semibold tabular-nums ${
                      up ? "text-secondary" : "text-destructive"
                    }`}
                  >
                    {change}
                  </span>
                )}
              </div>
            )}
          </div>

          {showRanges && (
            <div className="flex flex-wrap items-center gap-1 pt-3">
              {ranges.map(({ label, range }) => (
                <button
                  key={range}
                  type="button"
                  onClick={() => onRangeChange(range)}
                  aria-pressed={activeRange === range}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md border transition-colors duration-fast ${
                    activeRange === range
                      ? "border-secondary/50 bg-secondary/10 text-secondary"
                      : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-secondary/40"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </DialogHeader>

        <div className="p-4">
          {loading ? (
            <div className="h-[460px] flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : data.length < 2 ? (
            /* Same rule the embedded charts follow: no history means no chart,
               never a generated series. */
            <div className="h-[460px] flex flex-col items-center justify-center gap-2 text-center px-6">
              <p className="text-sm font-medium text-foreground">Price history unavailable</p>
              <p className="text-xs text-muted-foreground max-w-sm">
                We could not load enough history for {title} to draw a chart. Prices are not shown
                rather than estimated.
              </p>
            </div>
          ) : (
            <Suspense
              fallback={
                <div className="h-[460px] flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              }
            >
              <AdvancedChart
                data={data}
                ticker={ticker}
                height={460}
                defaultIndicators={["VOL", "MA"]}
              />
            </Suspense>
          )}

          <p className="mt-3 text-[11px] text-muted-foreground">
            Indicators and drawings are yours alone — they are not saved and are not investment
            advice. Charts are for analysis, not execution.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdvancedChartDialog;

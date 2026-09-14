import { BarChart3, Rows3, LayoutList } from "lucide-react";

/**
 * How the issue-page sections are rendered: the chart, the table, or both.
 *
 * Both is the default because the chart is a second reading of the table, not
 * a replacement for it - but the preference is real. A reader comparing three
 * years of revenue wants the figures; one asking "is this issue mostly QIB"
 * wants the bar. Neither should have to scroll past the other.
 */
export type SectionView = "both" | "chart" | "table";

export const SECTION_VIEW_KEY = "ipo-section-view";

const OPTIONS: { value: SectionView; label: string; icon: typeof BarChart3; title: string }[] = [
  { value: "both", label: "Both", icon: LayoutList, title: "Show the chart above each table" },
  { value: "chart", label: "Charts", icon: BarChart3, title: "Show charts where a section has one" },
  { value: "table", label: "Tables", icon: Rows3, title: "Show the published tables only" },
];

export default function IPOSectionViewToggle({
  value,
  onChange,
}: {
  value: SectionView;
  onChange: (next: SectionView) => void;
}) {
  return (
    <div
      role="group"
      aria-label="How to show the issue details"
      className="flex bg-muted rounded-lg p-1 self-start shrink-0"
    >
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            title={option.title}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors inline-flex items-center gap-1.5 ${
              active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="w-3.5 h-3.5" aria-hidden="true" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

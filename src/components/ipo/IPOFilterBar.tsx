import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DEFAULT_FILTERS,
  GMP_BAND_OPTIONS,
  LISTING_WINDOW_OPTIONS,
  type BoardFilter,
  type IpoFilters,
  type StatusFilter,
} from "@/lib/ipo-filters";
import type { Ipo } from "@/lib/ipo";

const STATUS_OPTIONS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "open", label: "Open now" },
  { id: "upcoming", label: "Upcoming" },
  { id: "closed", label: "Closed" },
  { id: "listed", label: "Listed" },
];

const BOARD_OPTIONS: { id: BoardFilter; label: string }[] = [
  { id: "all", label: "All boards" },
  { id: "mainboard", label: "Mainboard" },
  { id: "sme", label: "SME" },
];

type Props = {
  filters: IpoFilters;
  onChange: (filters: IpoFilters) => void;
  counts: Partial<Record<Ipo["status"], number>>;
};

/**
 * Sector is deliberately absent: it is not a column the reconciled `ipos`
 * table carries from any of the three sources, and inventing one from the
 * name would be exactly the kind of fabricated field this codebase has had
 * to rip out before.
 */
export default function IPOFilterBar({ filters, onChange, counts }: Props) {
  const isDefault = JSON.stringify(filters) === JSON.stringify(DEFAULT_FILTERS);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mr-1">
        <Filter className="w-3.5 h-3.5" />
        Filters
      </div>

      <div className="flex gap-1.5 overflow-x-auto">
        {STATUS_OPTIONS.map((option) => (
          <button
            key={option.id}
            onClick={() => onChange({ ...filters, status: option.id })}
            className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              filters.status === option.id ? "bg-secondary text-secondary-foreground" : "border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {option.label}
            {option.id !== "all" && counts[option.id] !== undefined && (
              <span className="ml-1.5 text-[10px] opacity-70">{counts[option.id]}</span>
            )}
          </button>
        ))}
      </div>

      <Select value={filters.board} onValueChange={(value: BoardFilter) => onChange({ ...filters, board: value })}>
        <SelectTrigger className="h-9 w-[136px] text-sm"><SelectValue /></SelectTrigger>
        <SelectContent>{BOARD_OPTIONS.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
      </Select>

      <Select value={filters.gmpBand} onValueChange={(value) => onChange({ ...filters, gmpBand: value as IpoFilters["gmpBand"] })}>
        <SelectTrigger className="h-9 w-[152px] text-sm"><SelectValue /></SelectTrigger>
        <SelectContent>{GMP_BAND_OPTIONS.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
      </Select>

      <Select value={filters.listingWindow} onValueChange={(value) => onChange({ ...filters, listingWindow: value as IpoFilters["listingWindow"] })}>
        <SelectTrigger className="h-9 w-[168px] text-sm"><SelectValue /></SelectTrigger>
        <SelectContent>{LISTING_WINDOW_OPTIONS.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
      </Select>

      {!isDefault && (
        <Button variant="ghost" size="sm" onClick={() => onChange(DEFAULT_FILTERS)} className="text-muted-foreground">
          <X className="w-3.5 h-3.5" /> Clear
        </Button>
      )}
    </div>
  );
}

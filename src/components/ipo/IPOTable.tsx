import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Link } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatGmp, formatLotSize, formatMinInvestment, type Ipo } from "@/lib/ipo";
import { MAX_COMPARE, type SortDir, type SortKey } from "@/lib/ipo-filters";

const STATUS_LABEL: Record<Ipo["status"], string> = { upcoming: "Upcoming", open: "Open", closed: "Closed", listed: "Listed" };

const COLUMNS: { key: SortKey; label: string; align?: "right" }[] = [
  { key: "name", label: "IPO" },
  { key: "status", label: "Status" },
  { key: "board", label: "Board" },
  { key: "price_band_max", label: "Price band", align: "right" },
  { key: "issue_size_crore", label: "Issue size", align: "right" },
  { key: "lot_size", label: "Lot size", align: "right" },
  { key: "min_investment", label: "Min. investment", align: "right" },
  { key: "close_date", label: "Closes", align: "right" },
  { key: "listing_date", label: "Listing", align: "right" },
  { key: "gmp", label: "GMP", align: "right" },
];

type Props = {
  ipos: Ipo[];
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  compareSlugs: string[];
  onToggleCompare: (slug: string) => void;
};

/** Dense, scannable, sortable — the comparison surface a card grid can't be. */
export default function IPOTable({ ipos, sortKey, sortDir, onSort, compareSlugs, onToggleCompare }: Props) {
  return (
    <div className="rounded-xl border border-border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-10" />
            {COLUMNS.map((col) => (
              <TableHead key={col.key} className={col.align === "right" ? "text-right" : ""}>
                <button
                  onClick={() => onSort(col.key)}
                  className={`inline-flex items-center gap-1 font-semibold hover:text-foreground transition-colors ${sortKey === col.key ? "text-foreground" : "text-muted-foreground"}`}
                >
                  {col.label}
                  {sortKey === col.key ? sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" /> : <ArrowUpDown className="w-3 h-3 opacity-40" />}
                </button>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {ipos.map((ipo) => {
            const checked = compareSlugs.includes(ipo.slug);
            const disabled = !checked && compareSlugs.length >= MAX_COMPARE;
            return (
              <TableRow key={ipo.id}>
                <TableCell>
                  <Checkbox
                    checked={checked}
                    disabled={disabled}
                    onCheckedChange={() => onToggleCompare(ipo.slug)}
                    aria-label={`Add ${ipo.name} to comparison`}
                  />
                </TableCell>
                <TableCell className="font-semibold max-w-[220px]">
                  <Link to={`/ipo/${ipo.slug}`} className="hover:text-secondary transition-colors line-clamp-1">{ipo.name}</Link>
                </TableCell>
                <TableCell><Badge variant="outline" className="capitalize">{STATUS_LABEL[ipo.status]}</Badge></TableCell>
                <TableCell className="capitalize text-muted-foreground">{ipo.board === "sme" ? "SME" : "Mainboard"}</TableCell>
                <TableCell className="text-right tabular-nums">{ipo.price}</TableCell>
                <TableCell className="text-right tabular-nums">{ipo.size}</TableCell>
                <TableCell className="text-right tabular-nums">{formatLotSize(ipo.lot_size)}</TableCell>
                <TableCell className="text-right tabular-nums whitespace-nowrap">{formatMinInvestment(ipo)?.amount ?? <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell className="text-right tabular-nums whitespace-nowrap">{formatDate(ipo.close_date)}</TableCell>
                <TableCell className="text-right tabular-nums whitespace-nowrap">{formatDate(ipo.listing_date)}</TableCell>
                <TableCell className={`text-right tabular-nums font-semibold ${ipo.gmp === null ? "text-muted-foreground" : ipo.gmp >= 0 ? "text-secondary" : "text-destructive"}`}>
                  {formatGmp(ipo.gmp)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

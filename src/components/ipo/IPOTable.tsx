import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import GmpSparkline from "./GmpSparkline";
import { Link } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatGmp, formatGmpPercent, formatLotSize, formatMinInvestment, formatSubscription, gmpPercent, signTone, type Ipo } from "@/lib/ipo";
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
  { key: "gmp_pct", label: "GMP %", align: "right" },
  { key: "subscription_total", label: "Subscribed", align: "right" },
  { key: "listing_gain_pct", label: "Listing gain", align: "right" },
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
    <div className="rounded-xl border border-border overflow-hidden">
      {/* 14 columns: compact cells, and the checkbox + name stay pinned while the figures scroll on phones. */}
      <Table className="[&_th]:h-10 [&_th]:px-3 [&_th]:whitespace-nowrap [&_td]:px-3 [&_td]:py-2.5">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {COLUMNS.map((col) => (
              <TableHead key={col.key} className={col.align === "right" ? "text-right" : col.key === "name" ? "sticky left-0 z-[1] bg-card !pl-10" : ""}>
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
                {/* Checkbox and name share one pinned cell, so nothing shows through a gap between two pinned columns. */}
                <TableCell className="sticky left-0 z-[1] bg-card font-semibold min-w-[170px] max-w-[250px]">
                  <span className="flex items-center gap-3">
                    <Checkbox
                      checked={checked}
                      disabled={disabled}
                      onCheckedChange={() => onToggleCompare(ipo.slug)}
                      aria-label={`Add ${ipo.name} to comparison`}
                    />
                    <Link to={`/ipo/${ipo.slug}`} className="hover:text-secondary transition-colors line-clamp-1">{ipo.name}</Link>
                  </span>
                </TableCell>
                <TableCell><Badge variant="outline" className="capitalize">{STATUS_LABEL[ipo.status]}</Badge></TableCell>
                <TableCell className="capitalize text-muted-foreground">{ipo.board === "sme" ? "SME" : "Mainboard"}</TableCell>
                <TableCell className="text-right tabular-nums">{ipo.price}</TableCell>
                <TableCell className="text-right tabular-nums">{ipo.size}</TableCell>
                <TableCell className="text-right tabular-nums">{formatLotSize(ipo.lot_size)}</TableCell>
                <TableCell className="text-right tabular-nums whitespace-nowrap">{formatMinInvestment(ipo)?.amount ?? <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell className="text-right tabular-nums whitespace-nowrap">{formatDate(ipo.close_date)}</TableCell>
                <TableCell className="text-right tabular-nums whitespace-nowrap">{formatDate(ipo.listing_date)}</TableCell>
                <TableCell className={`text-right tabular-nums font-semibold ${signTone(ipo.gmp)}`}>
                  <span className="inline-flex items-center justify-end gap-2">
                    <GmpSparkline history={ipo.gmp_history ?? []} />
                    {formatGmp(ipo.gmp)}
                  </span>
                </TableCell>
                <TableCell className={`text-right tabular-nums whitespace-nowrap ${signTone(gmpPercent(ipo))}`}>
                  {formatGmpPercent(gmpPercent(ipo)) ?? "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums whitespace-nowrap">
                  {formatSubscription(ipo.subscription_total) ?? <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell
                  className={`text-right tabular-nums whitespace-nowrap font-semibold ${signTone(ipo.listing_gain_pct)}`}
                  title={ipo.gain_since_issue_pct != null ? `${ipo.gain_since_issue_pct >= 0 ? "+" : ""}${ipo.gain_since_issue_pct.toFixed(1)}% since issue` : undefined}
                >
                  {ipo.listing_gain_pct === null ? "—" : `${ipo.listing_gain_pct >= 0 ? "+" : ""}${ipo.listing_gain_pct.toFixed(1)}%`}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

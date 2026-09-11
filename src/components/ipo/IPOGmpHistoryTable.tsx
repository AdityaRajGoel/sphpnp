import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatRupees, type GmpSnapshot } from "@/lib/ipo";

/**
 * The chart plots `gmp` over time, but each observation also carries an
 * estimated listing price and the source(s) behind it — data the chart line
 * alone doesn't show. This is the raw record: one row per recorded
 * observation, newest first, so every figure `gmp_history` holds for this
 * IPO is visible somewhere, not just the latest snapshot's summary card.
 */
export default function IPOGmpHistoryTable({ history }: { history: GmpSnapshot[] }) {
  if (history.length === 0) return null;
  const rows = [...history].reverse();

  return (
    <div className="mt-4 max-h-64 overflow-y-auto overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Observed</TableHead>
            <TableHead className="text-right">GMP</TableHead>
            <TableHead className="text-right">Est. listing price</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((point) => (
            <TableRow key={point.captured_at}>
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(point.captured_at))}
              </TableCell>
              <TableCell className={`text-right font-semibold tabular-nums ${point.gmp >= 0 ? "text-secondary" : "text-destructive"}`}>{formatRupees(point.gmp)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatRupees(point.est_listing_price)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

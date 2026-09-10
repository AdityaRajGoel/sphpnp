import { Link } from "react-router-dom";
import { X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatGmp, formatGmpPercent, formatLotSize, formatMinInvestment, formatSubscription, gmpPercent, type Ipo } from "@/lib/ipo";

type Row = { label: string; render: (ipo: Ipo) => React.ReactNode };

const ROWS: Row[] = [
  { label: "Status", render: (ipo) => <Badge variant="outline" className="capitalize">{ipo.status}</Badge> },
  { label: "Board", render: (ipo) => (ipo.board === "sme" ? "SME" : "Mainboard") },
  { label: "Price band", render: (ipo) => ipo.price },
  { label: "Issue size", render: (ipo) => ipo.size },
  { label: "Lot size", render: (ipo) => formatLotSize(ipo.lot_size) },
  { label: "Min. investment", render: (ipo) => formatMinInvestment(ipo)?.amount ?? "Not yet published" },
  { label: "GMP %", render: (ipo) => formatGmpPercent(gmpPercent(ipo)) ?? "—" },
  { label: "Subscribed", render: (ipo) => formatSubscription(ipo.subscription_total) ?? "—" },
  { label: "Opens", render: (ipo) => formatDate(ipo.open_date) },
  { label: "Closes", render: (ipo) => formatDate(ipo.close_date) },
  { label: "Listing date", render: (ipo) => formatDate(ipo.listing_date) },
  {
    label: "Latest GMP",
    render: (ipo) => <span className={ipo.gmp === null ? "text-muted-foreground" : ipo.gmp >= 0 ? "text-secondary font-semibold" : "text-destructive font-semibold"}>{formatGmp(ipo.gmp)}</span>,
  },
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ipos: Ipo[];
  onRemove: (slug: string) => void;
};

export default function IPOCompareDialog({ open, onOpenChange, ipos, onRemove }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Comparing {ipos.length} IPOs</DialogTitle>
        </DialogHeader>
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-foreground">
          GMP is unofficial and unregulated. It is shown for information only and is not a prediction of listing performance.
        </div>
        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full text-sm min-w-[520px]">
            <thead>
              <tr>
                <th className="text-left font-medium text-muted-foreground pb-3 pr-4 align-bottom">Field</th>
                {ipos.map((ipo) => (
                  <th key={ipo.id} className="text-left font-semibold pb-3 px-3 align-bottom min-w-[150px]">
                    <div className="flex items-start justify-between gap-2">
                      <Link to={`/ipo/${ipo.slug}`} className="hover:text-secondary transition-colors">{ipo.name}</Link>
                      <button onClick={() => onRemove(ipo.slug)} aria-label={`Remove ${ipo.name} from comparison`} className="text-muted-foreground hover:text-foreground shrink-0">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.label} className="border-t border-border">
                  <td className="py-2.5 pr-4 text-muted-foreground whitespace-nowrap">{row.label}</td>
                  {ipos.map((ipo) => <td key={ipo.id} className="py-2.5 px-3">{row.render(ipo)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {ipos.length < 2 && (
          <p className="text-sm text-muted-foreground">Select at least two IPOs from the list to compare them side by side.</p>
        )}
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

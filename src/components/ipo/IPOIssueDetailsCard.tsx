import { ExternalLink, FileText, Landmark } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate, formatListingGain, formatLotSize, formatRegistrar, formatRupees, type Ipo } from "@/lib/ipo";
import IPOFieldSource from "@/components/ipo/IPOFieldSource";

const Detail = ({ label, value, field, ipo }: { label: string; value: string; field?: string; ipo?: Ipo }) => (
  <div className="flex items-start justify-between gap-4">
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="font-medium text-right">
      {value}
      {field && ipo && <IPOFieldSource ipo={ipo} field={field} />}
    </dd>
  </div>
);

/**
 * Everything the reconciled `ipos` row holds for one issue, with provenance
 * tags on every figure `field_sources` tracks. Every value is a real column
 * read straight off `ipo` — nothing here is inferred or invented, and every
 * absence renders as an explicit word rather than a blank or a zero.
 */
export default function IPOIssueDetailsCard({ ipo }: { ipo: Ipo }) {
  const hasDocuments = Boolean(ipo.rhp_url || ipo.drhp_url);

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2">
          <Landmark className="w-5 h-5 text-secondary" />
          <h2 className="font-heading text-xl font-bold">Issue details</h2>
        </div>

        <dl className="mt-5 space-y-3 text-sm">
          <Detail label="Board" value={ipo.board === "sme" ? "SME" : "Mainboard"} />
          <Detail label="Price band" value={ipo.price} field="price_band_min" ipo={ipo} />
          <Detail label="Issue size" value={ipo.size} field="issue_size_crore" ipo={ipo} />
          <Detail label="Lot size" value={formatLotSize(ipo.lot_size)} field="lot_size" ipo={ipo} />
          <Detail label="Opens" value={formatDate(ipo.open_date)} field="open_date" ipo={ipo} />
          <Detail label="Closes" value={formatDate(ipo.close_date)} field="close_date" ipo={ipo} />
          <Detail label="Allotment" value={formatDate(ipo.allotment_date)} />
          <Detail label="Listing" value={formatDate(ipo.listing_date)} field="listing_date" ipo={ipo} />
          <Detail label="Est. listing price" value={formatRupees(ipo.est_listing_price)} field="est_listing_price" ipo={ipo} />
          <Detail label="Listing price" value={ipo.listing_price === null ? "Awaited" : formatRupees(ipo.listing_price)} field="listing_price" ipo={ipo} />
          <Detail label="Listing gain" value={formatListingGain(ipo.listing_gain_pct) ?? "Awaited"} />
          <Detail label="Registrar" value={formatRegistrar(ipo.registrar)} />
        </dl>

        <div className="mt-5 pt-4 border-t border-border">
          <p className="text-xs font-semibold text-muted-foreground mb-2.5">Offer documents</p>
          {hasDocuments ? (
            <div className="flex flex-wrap gap-3">
              {ipo.rhp_url && <DocumentLink href={ipo.rhp_url} label="RHP" />}
              {ipo.drhp_url && <DocumentLink href={ipo.drhp_url} label="DRHP" />}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Not disclosed by our sources yet.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

const DocumentLink = ({ href, label }: { href: string; label: string }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-secondary hover:underline">
    <FileText className="w-4 h-4" />{label}<ExternalLink className="w-3 h-3" />
  </a>
);

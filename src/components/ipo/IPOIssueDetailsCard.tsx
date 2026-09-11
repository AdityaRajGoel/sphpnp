import { ExternalLink, FileText, Landmark } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate, formatListingGain, formatLotSize, formatMinInvestment, formatRegistrar, formatRupees, isWebUrl, type Ipo } from "@/lib/ipo";
import IPOFieldSource from "@/components/ipo/IPOFieldSource";

const Detail = ({ label, value, field, ipo }: { label: string; value: string; field?: string; ipo?: Ipo }) => (
  <div className="flex items-start justify-between gap-4">
    <dt className="text-muted-foreground shrink-0">{label}</dt>
    <dd className="font-medium text-right min-w-0 break-words">
      {value}
      {field && ipo && <span className="block leading-tight"><IPOFieldSource ipo={ipo} field={field} /></span>}
    </dd>
  </div>
);

const crore = (value: number | null) => (value === null ? null : `₹${value.toLocaleString("en-IN")} Cr`);
const percent = (value: number | null) => (value === null ? null : `${value}%`);

/**
 * Everything the reconciled `ipos` row holds for one issue, with provenance
 * tags on every figure `field_sources` tracks. Every value is a real column
 * read straight off `ipo` — nothing here is inferred or invented, and every
 * absence renders as an explicit word rather than a blank or a zero.
 */
export default function IPOIssueDetailsCard({ ipo }: { ipo: Ipo }) {
  // The issue page's documents; the two URL columns stand in for rows read
  // before documents were collected.
  const documents = (ipo.documents && ipo.documents.length > 0
    ? ipo.documents
    : [
      ...(ipo.rhp_url ? [{ kind: "rhp" as const, label: "Red Herring Prospectus (RHP)", url: ipo.rhp_url }] : []),
      ...(ipo.drhp_url ? [{ kind: "drhp" as const, label: "Draft Red Herring Prospectus (DRHP)", url: ipo.drhp_url }] : []),
    ]).filter((doc) => isWebUrl(doc.url));
  const min = formatMinInvestment(ipo);
  // Facts from the issue's own page. Each renders only when the page gave it,
  // so a row appears the moment sync-ipo-details has read the page.
  const pageFacts: [string, string | null][] = [
    ["Minimum investment", min ? `${min.amount}${min.basis ? ` (${min.basis})` : ""}` : null],
    ["Face value", ipo.face_value === null ? null : `₹${ipo.face_value} per share`],
    ["Issue type", ipo.issue_type],
    ["Sale type", ipo.sale_type],
    ["Fresh issue", crore(ipo.fresh_issue_crore)],
    ["Offer for sale", crore(ipo.ofs_crore)],
    ["Listing at", ipo.listing_exchanges],
    ["Refunds", ipo.refund_date ? formatDate(ipo.refund_date) : null],
    ["Shares credited", ipo.credit_date ? formatDate(ipo.credit_date) : null],
    ["Promoter holding", ipo.promoter_holding_pre !== null || ipo.promoter_holding_post !== null
      ? `${percent(ipo.promoter_holding_pre) ?? "—"} before · ${percent(ipo.promoter_holding_post) ?? "—"} after`
      : null],
    ["Lead managers", ipo.lead_managers && ipo.lead_managers.length > 0 ? ipo.lead_managers.join(", ") : null],
  ];

  return (
    <Card className="min-w-0">
      <CardContent className="p-4 md:p-5">
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
          {pageFacts.filter((fact): fact is [string, string] => fact[1] !== null).map(([label, value]) => (
            <Detail key={label} label={label} value={value} />
          ))}
        </dl>

        <div className="mt-5 pt-4 border-t border-border">
          <p className="text-xs font-semibold text-muted-foreground mb-2.5">Offer documents &amp; links</p>
          {documents.length > 0 ? (
            <div className="flex flex-col gap-2.5">
              {documents.map((doc) => <DocumentLink key={doc.kind} href={doc.url} label={doc.label} />)}
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

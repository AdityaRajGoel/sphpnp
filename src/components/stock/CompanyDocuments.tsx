import { motion } from "motion/react";
import { FileText, Mic, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { revealSection } from "@/lib/motion";
import { webHref, type ScreenerProfile } from "@/lib/stock-disclosures";

const LIMIT = 6;

function LinkList({ items }: { items: { key: string; label: string; note?: string | null; url: string | null }[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((i) => {
        const href = webHref(i.url);
        return (
          <li key={i.key} className="text-sm">
            {href ? (
              <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="hover:text-primary underline-offset-2 hover:underline">{i.label}</a>
            ) : <span>{i.label}</span>}
            {i.note && <span className="text-xs text-muted-foreground"> · {i.note}</span>}
          </li>
        );
      })}
    </ul>
  );
}

/** Annual reports, earnings-call transcripts and credit-rating updates, linked at the exchange or the agency. */
export default function CompanyDocuments({ documents }: { documents: ScreenerProfile["documents"] }) {
  const { annual_reports, concalls, credit_ratings } = documents;
  if (annual_reports.length + concalls.length + credit_ratings.length === 0) return null;

  return (
    <motion.section {...revealSection} aria-labelledby="documents-heading">
      <h2 id="documents-heading" className="text-2xl font-bold mb-4">Documents</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {annual_reports.length > 0 && (
          <Card className="p-4">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><FileText className="w-4 h-4 text-primary" aria-hidden="true" />Annual reports</h3>
            <LinkList items={annual_reports.slice(0, LIMIT).map((d) => ({ key: d.url, label: d.title, url: d.url }))} />
          </Card>
        )}
        {concalls.length > 0 && (
          <Card className="p-4">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Mic className="w-4 h-4 text-brand-orange" aria-hidden="true" />Earnings calls</h3>
            <ul className="space-y-1.5">
              {concalls.slice(0, LIMIT).map((c) => (
                <li key={c.period} className="text-sm flex flex-wrap items-center gap-x-3">
                  <span className="font-medium w-20">{c.period}</span>
                  {[["Transcript", c.transcript], ["Slides", c.ppt], ["Recording", c.recording]].map(([label, url]) =>
                    webHref(url) ? (
                      <a key={label} href={webHref(url)} target="_blank" rel="noopener noreferrer nofollow" className="text-xs text-primary hover:underline">{label}</a>
                    ) : null)}
                </li>
              ))}
            </ul>
          </Card>
        )}
        {credit_ratings.length > 0 && (
          <Card className="p-4">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-secondary" aria-hidden="true" />Credit ratings</h3>
            <LinkList items={credit_ratings.slice(0, LIMIT).map((d) => ({ key: d.url, label: d.title, note: d.note, url: d.url }))} />
          </Card>
        )}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Documents open at BSE or the rating agency that issued them.</p>
    </motion.section>
  );
}

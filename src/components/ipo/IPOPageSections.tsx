import { FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { decodeEntities, sectionTableHasHeader, type IpoPageSection } from "@/lib/ipo";
import { deriveSectionInfographic } from "@/lib/ipo-infographics";
import IPOSectionInfographic from "@/components/ipo/IPOSectionInfographic";

/** "IPO Open Fri, Sep 18, 2026" -> ["IPO Open", "Fri, Sep 18, 2026"]: the timetable's one-line steps. */
const DATED_STEP = /^(.+?)\s+((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s+[A-Z][a-z]{2}\s+\d{1,2},\s+\d{4})$/;

/** Sections that read better across the full width: wide tables and long prose. */
const isWide = (section: IpoPageSection) =>
  section.tables.some((rows) => (rows[0]?.length ?? 0) >= 4) || section.lines.join(" ").length > 400;

function SectionTable({ rows }: { rows: string[][] }) {
  const hasHeader = sectionTableHasHeader(rows);
  const header = hasHeader ? rows[0] : null;
  const body = hasHeader ? rows.slice(1) : rows;
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        {header && (
          <thead className="bg-muted/40">
            <tr>
              {header.map((cell, i) => (
                <th key={i} scope="col" className={`p-2.5 font-semibold whitespace-nowrap ${i === 0 ? "text-left" : "text-right"}`}>{decodeEntities(cell)}</th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {body.map((row, r) => (
            <tr key={r} className="border-t border-border first:border-t-0">
              {row.map((cell, i) =>
                i === 0 ? (
                  <th key={i} scope="row" className={`p-2.5 text-left font-normal text-muted-foreground align-top ${header ? "min-w-[9rem]" : ""}`}>{decodeEntities(cell)}</th>
                ) : (
                  <td key={i} className={`p-2.5 align-top tabular-nums break-words ${header ? "text-right whitespace-nowrap" : "text-right"}`}>{decodeEntities(cell) || "—"}</td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Every section of the issue's Chittorgarh page, as the page published it:
 * lot sizes per category, timetable, reservation, anchor investors, company
 * financials, objects of the issue, KPIs, valuation, shareholding, selling
 * shareholders, registrar, lead managers and contact details. Rendered from
 * what was stored, not re-interpreted - the figures are the page's own.
 */
export default function IPOPageSections({ sections, fetchedAt }: { sections: IpoPageSection[]; fetchedAt: string | null }) {
  if (sections.length === 0) return null;
  return (
    <section className="mt-8" aria-labelledby="issue-page-heading">
      <div className="flex items-center gap-2">
        <FileText className="w-5 h-5 text-secondary" />
        <div>
          <h2 id="issue-page-heading" className="font-heading text-xl font-bold">Full issue details</h2>
          <p className="text-xs text-muted-foreground">
            Details as published for this issue{fetchedAt ? `, read ${new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(fetchedAt))}` : ""}.
            Verify against the RHP before applying.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-5">
        {sections.map((section) => {
          // A chart for the handful of sections that have an honest one; the
          // rest (registrar, lead managers, contact details) are unchanged.
          // It sits ABOVE the table rather than replacing any of it - the
          // table is still the record, and the figures being drawn are its own.
          const chart = deriveSectionInfographic(section);
          return (
          <Card key={section.title} className={`min-w-0 ${isWide(section) ? "lg:col-span-2" : ""}`}>
            <CardContent className="p-4 md:p-5 space-y-3">
              <h3 className="font-heading text-base font-bold">{decodeEntities(section.title)}</h3>
              {chart && <IPOSectionInfographic chart={chart} title={decodeEntities(section.title)} />}
              {section.tables.map((rows, i) => <SectionTable key={i} rows={rows} />)}
              {section.lines.length > 0 && section.lines.every((line) => DATED_STEP.test(line)) ? (
                <dl className="text-sm divide-y divide-border rounded-lg border border-border">
                  {section.lines.map((line) => {
                    const [, label, date] = DATED_STEP.exec(line)!;
                    return (
                      <div key={line} className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 p-2.5">
                        <dt className="text-muted-foreground">{label}</dt>
                        <dd className="font-medium tabular-nums text-right">{date}</dd>
                      </div>
                    );
                  })}
                </dl>
              ) : section.lines.length > 0 && (
                <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
                  {section.lines.map((line, i) => <p key={i} className="break-words">{decodeEntities(line)}</p>)}
                </div>
              )}
            </CardContent>
          </Card>
          );
        })}
      </div>
    </section>
  );
}

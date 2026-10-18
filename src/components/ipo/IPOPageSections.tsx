import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { decodeEntities, isSectionFigure as isFigure, sectionTableHasHeader, tidySectionCell as tidyCell, type IpoPageSection } from "@/lib/ipo";
import { deriveSectionInfographic } from "@/lib/ipo-infographics";
import IPOSectionInfographic from "@/components/ipo/IPOSectionInfographic";
import IPOSectionViewToggle, { SECTION_VIEW_KEY, type SectionView } from "@/components/ipo/IPOSectionViewToggle";

/** "IPO Open Fri, Sep 18, 2026" -> ["IPO Open", "Fri, Sep 18, 2026"]: the timetable's one-line steps. */
const DATED_STEP = /^(.+?)\s+((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s+[A-Z][a-z]{2}\s+\d{1,2},\s+\d{4})$/;

/** Sections that read better across the full width: wide tables and long prose. */
const isWide = (section: IpoPageSection) =>
  section.tables.some((rows) => (rows[0]?.length ?? 0) >= 4) || section.lines.join(" ").length > 400;

function SectionTable({ rows }: { rows: string[][] }) {
  const tidy = rows.map((row) => row.map(tidyCell)).filter((row) => row.some((cell) => cell !== ""));
  const hasHeader = sectionTableHasHeader(tidy);
  const header = hasHeader ? tidy[0] : null;
  const body = hasHeader ? tidy.slice(1) : tidy;
  // A column is numeric when every body cell in it is a figure; text columns
  // wrap and sit left. Right-aligning and no-wrapping every column stretched
  // "Objects of the issue" to 918px and pushed its descriptions off-screen.
  const numeric = (header ?? body[0] ?? []).map((_, i) => i > 0 && body.every((row) => isFigure(row[i] ?? "")));
  // Wide tables scroll on phones; the row label stays pinned so figures keep their meaning.
  // A serial "#" column ("Objects of the issue") is neither pinned nor widened.
  const labelled = body.some((row) => (row[0] ?? "").length > 3);
  const pin = header !== null && header.length >= 3 && labelled ? "sticky left-0 z-[1]" : "";
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        {header && (
          <thead className="bg-muted">
            <tr>
              {header.map((cell, i) => (
                <th key={i} scope="col" className={`p-2.5 font-semibold ${numeric[i] ? "text-right whitespace-nowrap" : "text-left"} ${i === 0 ? `${pin} bg-muted` : ""}`}>{cell}</th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {body.map((row, r) => (
            <tr key={r} className="border-t border-border first:border-t-0">
              {row.map((cell, i) =>
                i === 0 ? (
                  <th key={i} scope="row" className={`p-2.5 text-left font-normal text-muted-foreground align-top ${header && labelled ? `min-w-[8rem] ${pin} bg-card` : ""}`}>{cell}</th>
                ) : (
                  <td
                    key={i}
                    className={`p-2.5 align-top break-words ${
                      header
                        ? numeric[i] ? "text-right tabular-nums whitespace-nowrap" : "text-left min-w-[10rem]"
                        : `text-right tabular-nums ${cell.length <= 24 ? "whitespace-nowrap" : ""}`
                    }`}
                  >
                    {cell || "—"}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Link captions the source page left behind without their links ("View More »", "IPO Anchor Investors List"). */
const ORPHAN_LINK = /^(view more|ipo .{3,40} (details|list))\W*$/i;

/**
 * Every section of the issue's Chittorgarh page, as the page published it:
 * lot sizes per category, timetable, reservation, anchor investors, company
 * financials, objects of the issue, KPIs, valuation, shareholding, selling
 * shareholders, registrar, lead managers and contact details. Rendered from
 * what was stored, not re-interpreted - the figures are the page's own.
 */
/**
 * The reader's chart/table preference, remembered across issues.
 *
 * Read in an effect rather than in the initial state so the value is identical
 * on the prerendered HTML and the first client render - reading localStorage
 * during render makes them disagree and React discards the server markup.
 * Every access is wrapped: localStorage throws outright in Safari's private
 * mode, and a preference is never worth taking the page down for.
 */
function useSectionView(): [SectionView, (next: SectionView) => void] {
  const [view, setView] = useState<SectionView>("both");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(SECTION_VIEW_KEY);
      if (stored === "both" || stored === "chart" || stored === "table") setView(stored);
    } catch {
      // No stored preference available; the default stands.
    }
  }, []);

  const choose = (next: SectionView) => {
    setView(next);
    try {
      window.localStorage.setItem(SECTION_VIEW_KEY, next);
    } catch {
      // The choice still applies to this visit.
    }
  };

  return [view, choose];
}

export default function IPOPageSections({ sections, fetchedAt }: { sections: IpoPageSection[]; fetchedAt: string | null }) {
  const [view, setView] = useSectionView();
  if (sections.length === 0) return null;
  return (
    <section className="mt-8" aria-labelledby="issue-page-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <FileText className="w-5 h-5 text-secondary shrink-0" />
        <div className="min-w-0">
          <h2 id="issue-page-heading" className="font-heading text-xl font-bold">Full issue details</h2>
          <p className="text-xs text-muted-foreground">
            Details as published for this issue{fetchedAt ? `, read ${new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(fetchedAt))}` : ""}.
            Verify against the RHP before applying.
          </p>
        </div>
      </div>
        <IPOSectionViewToggle value={view} onChange={setView} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-5">
        {sections.map((section) => {
          // A chart for the handful of sections that have an honest one; the
          // rest (registrar, lead managers, contact details) are unchanged.
          // It sits ABOVE the table rather than replacing any of it - the
          // table is still the record, and the figures being drawn are its own.
          const chart = deriveSectionInfographic(section);
          // A section with no chart always shows its table, whatever the
          // preference - "Charts" must not blank out the timetable, the
          // registrar and the contact details, which have no chart to show.
          const showChart = chart !== null && view !== "table";
          const showTable = chart === null || view !== "chart";
          return (
          <Card key={section.title} className={`min-w-0 ${isWide(section) ? "lg:col-span-2" : ""}`}>
            <CardContent className="p-4 md:p-5 space-y-3">
              <h3 className="font-heading text-base font-bold">{decodeEntities(section.title)}</h3>
              {showChart && chart && <IPOSectionInfographic chart={chart} title={decodeEntities(section.title)} />}
              {showTable && section.tables.map((rows, i) => <SectionTable key={i} rows={rows} />)}
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
                  {section.lines.map((line) => decodeEntities(line).trim()).filter((line) => !ORPHAN_LINK.test(line)).map((line, i) => <p key={i} className="break-words">{line}</p>)}
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

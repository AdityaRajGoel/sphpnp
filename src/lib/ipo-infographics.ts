/**
 * Turns the issue page's scraped tables into small charts that sit beside them.
 *
 * The tables are the record and stay exactly as published (see IPOPageSections);
 * these charts are a second reading of the SAME cells - never a recomputation,
 * never a figure the page did not print. Every bar carries the source cell's own
 * text as its label, so a reader comparing chart to table sees the same string
 * twice rather than two roundings of one number.
 *
 * Derivation is per section and deliberately narrow. A generic "chart any
 * numeric table" pass would happily put RoE (%), Debt/Equity (a ratio) and NAV
 * (rupees) on one axis - three unit systems behind one set of bars, which is
 * the single most common way a chart lies. So each shape is recognised by name,
 * guarded, and skipped when the guard does not hold: a section this module does
 * not understand simply renders as the table alone, exactly as before.
 *
 * Pure string/number work, no React and no I/O, so the guards are testable
 * directly (src/test/ipo-infographics.test.ts).
 */
import { decodeEntities, formatGmpPercent, formatRupees, formatSubscription, gmpPercent, type Ipo } from "@/lib/ipo";

export type InfographicBar = {
  /** The row/column the value came from, e.g. "Retail" or "31 Mar 2026". */
  label: string;
  value: number;
  /** The source cell verbatim ("50.00%", "₹14,964") - what the table shows. */
  display: string;
  /** A stub period (see markPartialPeriods) - drawn muted and labelled. */
  partial?: boolean;
};

export type InfographicGroup = { label: string | null; bars: InfographicBar[] };

export type SectionInfographic = {
  /**
   * "share" - segments of one whole, drawn as a single 100% bar with a legend.
   * "magnitude" - independent quantities, drawn as horizontal bars per group.
   */
  kind: "share" | "magnitude";
  /** One sentence saying what is drawn and how to read it. */
  caption: string;
  groups: InfographicGroup[];
};

/**
 * Indian companies report to 31 March, and the issue page's newest column is
 * routinely a stub - "30 Jun 2026", three months of trading - sitting beside
 * full years. Three months of income next to twelve makes a bar a quarter the
 * length of the year before it, which reads as a collapse rather than as a
 * shorter period. The table has the same trap but states each period ended;
 * the bars need it said out loud, so the stub is muted and labelled.
 *
 * Only applied when the columns actually mix: a company whose year ends
 * somewhere other than March has no stub here, and marking every column
 * "part period" would be worse than marking none.
 */
const isFullYearPeriod = (label: string) => /(31[\s-]*mar|mar\w*[\s.]*31)/i.test(label);

function markPartialPeriods(bars: InfographicBar[]): InfographicBar[] {
  const full = bars.filter((bar) => isFullYearPeriod(bar.label));
  if (full.length === 0 || full.length === bars.length) return bars;
  return bars.map((bar) => (isFullYearPeriod(bar.label) ? bar : { ...bar, partial: true }));
}

/** Appended to a caption whose bars carry a stub period. */
const PARTIAL_NOTE = " The muted bar is a part period, not a full year - it is shorter, not smaller.";

/** Rupees, percent signs, Indian digit grouping and stray spaces all stripped. */
export function parseAmount(cell: string | undefined): number | null {
  if (!cell) return null;
  const cleaned = decodeEntities(cell)
    .replace(/[₹,\s]/g, "")
    .replace(/%$/, "")
    .replace(/(cr\.?|crore)$/i, "");
  if (!/^-?\d*\.?\d+$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

const isPercentCell = (cell: string | undefined) => !!cell && /%\s*$/.test(cell.trim());

/** Summary rows ("Total", "Grand Total") are the whole, never a part of it. */
const isTotalRow = (label: string) => /^(grand\s+)?total\b/i.test(label.trim());

/**
 * Chittorgarh indents a breakdown of the row above it with a leading dash
 * ("- Anchor Investor" under "QIB"). Charting both levels would double-count
 * the issue, so only the top level is drawn.
 */
const isSubRow = (label: string) => /^\s*[-–—]/.test(label);

const clean = (cell: string | undefined) => decodeEntities(cell ?? "").trim();

/** A share chart is only honest if its segments actually make up the whole. */
const SHARE_SUM_TOLERANCE = 10;

function shareGroup(label: string | null, bars: InfographicBar[]): InfographicGroup | null {
  if (bars.length === 0) return null;
  const sum = bars.reduce((total, bar) => total + bar.value, 0);
  if (Math.abs(sum - 100) > SHARE_SUM_TOLERANCE) return null;
  return { label, bars };
}

/** Investor category -> % of the issue reserved for it. */
function reservationChart(rows: string[][]): SectionInfographic | null {
  const header = rows[0] ?? [];
  const column = header.findIndex((cell) => /%\s*of\s*total/i.test(clean(cell)));
  if (column < 1) return null;

  const bars: InfographicBar[] = [];
  for (const row of rows.slice(1)) {
    const label = clean(row[0]);
    if (!label || isTotalRow(label) || isSubRow(label)) continue;
    const value = parseAmount(row[column]);
    if (value === null) continue;
    bars.push({ label, value, display: clean(row[column]) });
  }

  const group = shareGroup(null, bars);
  if (!group || group.bars.length < 2) return null;
  return {
    kind: "share",
    caption: "Share of the issue reserved for each investor category.",
    groups: [group],
  };
}

/** Promoter vs public holding, one bar before the issue and one after. */
function shareholdingChart(rows: string[][]): SectionInfographic | null {
  const header = rows[0] ?? [];
  if (header.length < 2) return null;

  const groups: InfographicGroup[] = [];
  for (let column = 1; column < header.length; column++) {
    const bars: InfographicBar[] = [];
    for (const row of rows.slice(1)) {
      const label = clean(row[0]);
      if (!label || isTotalRow(label)) continue;
      if (!isPercentCell(row[column])) continue;
      const value = parseAmount(row[column]);
      if (value === null) continue;
      bars.push({ label, value, display: clean(row[column]) });
    }
    const group = shareGroup(clean(header[column]) || null, bars);
    if (group) groups.push(group);
  }

  if (groups.length === 0 || groups.every((group) => group.bars.length < 2)) return null;
  return {
    kind: "share",
    caption: "Who holds the company before and after the issue.",
    groups,
  };
}

/**
 * The financial lines worth drawing, in the order they are drawn. Restricted on
 * purpose: the table also carries Reserves and Surplus and Total Borrowing,
 * and eight stacked charts is not a summary of anything.
 */
const FINANCIAL_METRICS = [/^total income$/i, /^revenue/i, /^profit after tax$/i, /^ebitda$/i, /^net ?worth$/i];
const MAX_FINANCIAL_METRICS = 4;

/** One row of bars per financial line, oldest period on the left. */
function financialsChart(rows: string[][]): SectionInfographic | null {
  const header = rows[0] ?? [];
  if (header.length < 3) return null;
  // Periods run newest-first on the page; reversed here so the bars read
  // left-to-right in time, which is the only direction a trend is read in.
  const periods = header.slice(1).map((cell, index) => ({ label: clean(cell), column: index + 1 })).reverse();

  const groups: InfographicGroup[] = [];
  for (const metric of FINANCIAL_METRICS) {
    if (groups.length >= MAX_FINANCIAL_METRICS) break;
    const row = rows.slice(1).find((candidate) => metric.test(clean(candidate[0])));
    if (!row) continue;
    const bars = periods
      .map(({ label, column }) => ({ label, value: parseAmount(row[column]), display: clean(row[column]) }))
      .filter((bar): bar is InfographicBar => bar.value !== null);
    if (bars.length >= 2) groups.push({ label: clean(row[0]), bars: markPartialPeriods(bars) });
  }

  if (groups.length === 0) return null;
  // The unit line the page prints under the table ("Amount in ₹ Crore") is a
  // one-cell row, so it is read from there rather than assumed.
  const unitRow = rows.find((row) => row.length === 1 && /amount in/i.test(clean(row[0])));
  const unit = unitRow ? clean(unitRow[0]).replace(/^amount in\s*/i, "") : null;
  return {
    kind: "magnitude",
    caption:
      `Each line is scaled to its own largest period${unit ? `, ${unit.toLowerCase()}` : ""} - compare periods within a line, not one line against another.` +
      (groups.some((group) => group.bars.some((bar) => bar.partial)) ? PARTIAL_NOTE : ""),
    groups,
  };
}

/** What the money raised is earmarked for. */
function objectsChart(rows: string[][]): SectionInfographic | null {
  const header = rows[0] ?? [];
  const amountColumn = header.findIndex((cell) => /amt|amount/i.test(clean(cell)));
  const labelColumn = header.findIndex((cell) => /object/i.test(clean(cell)));
  if (amountColumn < 1 || labelColumn < 0) return null;

  const bars: InfographicBar[] = [];
  for (const row of rows.slice(1)) {
    const label = clean(row[labelColumn]);
    if (!label || isTotalRow(label)) continue;
    const value = parseAmount(row[amountColumn]);
    if (value === null || value <= 0) continue;
    bars.push({ label, value, display: clean(row[amountColumn]) });
  }

  if (bars.length < 2) return null;
  const unit = clean(header[amountColumn]).replace(/^est\.?\s*amt\.?\s*/i, "").replace(/[()]/g, "").trim();
  return {
    kind: "magnitude",
    caption: `What the proceeds are earmarked for${unit ? ` (${unit})` : ""}.`,
    groups: [{ label: null, bars }],
  };
}

/** The application ladder: what each category has to put up. */
function lotSizeChart(rows: string[][]): SectionInfographic | null {
  const header = rows[0] ?? [];
  const amountColumn = header.findIndex((cell) => /^amount$/i.test(clean(cell)));
  if (amountColumn < 1) return null;

  const bars: InfographicBar[] = [];
  for (const row of rows.slice(1)) {
    const label = clean(row[0]);
    const value = parseAmount(row[amountColumn]);
    if (!label || value === null || value <= 0) continue;
    bars.push({ label, value, display: clean(row[amountColumn]) });
  }

  if (bars.length < 2) return null;
  return {
    kind: "magnitude",
    caption: "What an application costs at the upper price band, by category.",
    groups: [{ label: null, bars }],
  };
}

/**
 * Only the KPI rows that are percentages. The same table carries Debt/Equity
 * (a ratio), NAV and Price to Book (rupees and a multiple) - drawing those on
 * the same bars would put three unit systems behind one length.
 */
function kpiChart(rows: string[][]): SectionInfographic | null {
  const header = rows[0] ?? [];
  if (header.length < 2) return null;
  const periods = header.slice(1).map((cell, index) => ({ label: clean(cell), column: index + 1 })).reverse();

  const groups: InfographicGroup[] = [];
  for (const row of rows.slice(1)) {
    const label = clean(row[0]);
    if (!label) continue;
    const cells = periods.map(({ column }) => row[column]);
    if (!cells.every((cell) => isPercentCell(cell))) continue;
    const bars = periods
      .map(({ label: period, column }) => ({ label: period, value: parseAmount(row[column]), display: clean(row[column]) }))
      .filter((bar): bar is InfographicBar => bar.value !== null);
    if (bars.length >= 2) groups.push({ label, bars: markPartialPeriods(bars) });
  }

  if (groups.length === 0) return null;
  return {
    kind: "magnitude",
    caption:
      "The percentage ratios only; the table's absolute figures stay in the table." +
      (groups.some((group) => group.bars.some((bar) => bar.partial)) ? PARTIAL_NOTE : ""),
    groups,
  };
}

const DERIVATIONS: { title: RegExp; derive: (rows: string[][]) => SectionInfographic | null }[] = [
  { title: /reservation/i, derive: reservationChart },
  { title: /shareholding/i, derive: shareholdingChart },
  { title: /financial/i, derive: financialsChart },
  { title: /objects of the issue/i, derive: objectsChart },
  { title: /lot size/i, derive: lotSizeChart },
  { title: /key performance|\bkpi\b/i, derive: kpiChart },
];

/**
 * The chart for a section, or null when this section has no honest one - which
 * is the common case and not a failure.
 */
export function deriveSectionInfographic(section: { title: string; tables: string[][][] }): SectionInfographic | null {
  const derivation = DERIVATIONS.find((candidate) => candidate.title.test(section.title));
  if (!derivation) return null;
  for (const table of section.tables) {
    // Rows shorter than two cells are the page's own footnotes ("Amount in
    // ₹ Crore"), not data; a table of only those has nothing to draw.
    if (table.filter((row) => row.length >= 2).length < 2) continue;
    const chart = derivation.derive(table);
    if (chart) return chart;
  }
  return null;
}

/**
 * The comparison the compare dialog's table cannot make: three measures where
 * "bigger" actually means something, drawn as bars across the issues the
 * visitor picked.
 *
 * Only these three. Price band and issue size are also numbers, but a larger
 * issue is not a better one and a higher band is not a worse one - drawing
 * them as bars would imply a ranking that does not exist. GMP %, subscription
 * and what an application costs are the three a visitor is actually weighing
 * against each other.
 */
const COMPARE_MEASURES: { label: string; value: (ipo: Ipo) => number | null; display: (ipo: Ipo) => string | null }[] = [
  { label: "GMP %", value: gmpPercent, display: (ipo) => formatGmpPercent(gmpPercent(ipo)) },
  { label: "Subscribed", value: (ipo) => ipo.subscription_total, display: (ipo) => formatSubscription(ipo.subscription_total) },
  { label: "Min. investment", value: (ipo) => ipo.min_investment, display: (ipo) => (ipo.min_investment === null ? null : formatRupees(ipo.min_investment)) },
];

export function compareInfographic(ipos: Ipo[]): SectionInfographic | null {
  if (ipos.length < 2) return null;

  const groups: InfographicGroup[] = [];
  for (const measure of COMPARE_MEASURES) {
    const bars: InfographicBar[] = [];
    for (const ipo of ipos) {
      const value = measure.value(ipo);
      const display = measure.display(ipo);
      // A missing figure is left out rather than drawn as zero: an issue that
      // has not opened has no subscription, which is not the same as one that
      // nobody has applied for.
      if (value === null || display === null) continue;
      bars.push({ label: ipo.name, value, display });
    }
    if (bars.length >= 2) groups.push({ label: measure.label, bars });
  }

  if (groups.length === 0) return null;
  return {
    kind: "magnitude",
    caption: "Each row is scaled to the largest of the issues you selected; an issue with no figure yet is left out of that row.",
    groups,
  };
}

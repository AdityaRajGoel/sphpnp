/**
 * Pure XBRL parsing for Indian Ind-AS filings. No I/O, no Deno APIs, so this
 * file is importable by both the edge function and Vitest.
 *
 * Two hard-won rules govern everything here, both established against real
 * filings and both counter-intuitive:
 *
 * 1. The declared <xbrli:period> is NOT reliable. In the Reliance Q3 FY25
 *    filing, the year-to-date context FourD declares the same three-month
 *    range as the quarterly context OneD while holding the nine-month figure.
 *    Believing the period overstates a quarter roughly threefold.
 *
 * 2. Consolidation is a property of the FILING, not the context. The document
 *    reports "Standalone" against every context even in a consolidated filing;
 *    the two bases are filed as separate documents. Callers pass the basis in
 *    from the registry metadata.
 *
 * What actually disambiguates facts is the context id prefix, which encodes the
 * column of the standard Indian results table: One = current quarter,
 * Four = year to date.
 */

/** The column carrying the current reporting quarter. */
export const HEADLINE_CONTEXT = "OneD";

export type XbrlContext = {
  id: string;
  /** Results-table column: "One" = current quarter, "Four" = year to date. */
  column: string;
  isInstant: boolean;
  /** Recorded for provenance only. Never use this to choose a context. */
  startDate: string | null;
  endDate: string | null;
};

// The opening tag's attribute list is captured as a blob rather than assuming
// `id` is the only (or first) attribute — real filers and XBRL exporters vary
// attribute order and sometimes add extras (e.g. xml:lang). Matching only
// `id="..."` immediately before `>` would silently drop any context whose tag
// doesn't happen to look exactly like that, with no error to signal the loss.
// The attribute must still be matched carefully: some filings also carry a
// namespaced `xml:id="..."` alongside the real `id="..."`, and a bare `\b`
// boundary before `id` treats the ':' in `xml:id` as a word boundary too, so
// it happily matches the namespaced attribute instead. Requiring `id` to sit
// at the start of the blob or right after whitespace rules that out while
// still tolerating any attribute order.
const CONTEXT_RE = /<xbrli:context\b([^>]*)>([\s\S]*?)<\/xbrli:context>/g;
const ID_ATTR_RE = /(?:^|\s)id="([^"]+)"/;
const START_RE = /<xbrli:startDate>([^<]+)<\/xbrli:startDate>/;
const END_RE = /<xbrli:endDate>([^<]+)<\/xbrli:endDate>/;
const INSTANT_RE = /<xbrli:instant>([^<]+)<\/xbrli:instant>/;

/**
 * Split a context id into its column prefix. "OneD" and "OneI" are both column
 * One; "OneReportableSegmentRevenue01D" is ALSO column One by this function —
 * `columnOf` only identifies the results-table column, it does not identify
 * headline vs. dimensional-breakdown facts. Headline selection is exact-id
 * equality against `HEADLINE_CONTEXT`, done by the caller; never derive it
 * from `column`.
 */
function columnOf(id: string): string {
  const m = /^(One|Two|Three|Four|Five|Six)/.exec(id);
  return m ? m[1] : "";
}

export function parseContexts(xml: string): Map<string, XbrlContext> {
  const out = new Map<string, XbrlContext>();
  CONTEXT_RE.lastIndex = 0;
  let m: RegExpExecArray | null;

  while ((m = CONTEXT_RE.exec(xml)) !== null) {
    const [, attrs, body] = m;
    const idMatch = ID_ATTR_RE.exec(attrs);
    if (!idMatch) continue;
    const id = idMatch[1];
    const instant = INSTANT_RE.exec(body);
    out.set(id, {
      id,
      column: columnOf(id),
      isInstant: instant !== null,
      startDate: START_RE.exec(body)?.[1] ?? null,
      endDate: END_RE.exec(body)?.[1] ?? instant?.[1] ?? null,
    });
  }
  return out;
}

export type IncomeStatement = {
  revenue: number | null;
  otherIncome: number | null;
  totalIncome: number | null;
  totalExpenses: number | null;
  profitBeforeTax: number | null;
  profitAfterTax: number | null;
  basicEps: number | null;
  dilutedEps: number | null;
  debtEquityRatio: number | null;
  debtServiceCoverageRatio: number | null;
  periodEnd: string | null;
};

/**
 * Read one fact by EXACT tag name under one exact context.
 *
 * Exactness matters in both directions. Matching the tag loosely picks up
 * SegmentRevenueFromOperations when RevenueFromOperations was wanted; matching
 * the context loosely picks up the year-to-date column.
 */
function fact(xml: string, tag: string, contextRef: string): number | null {
  const re = new RegExp(
    `<in-bse-fin:${tag}\\s+contextRef="${contextRef}"[^>]*>([-\\d.]+)<`,
  );
  const m = re.exec(xml);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

export function parseIncomeStatement(xml: string): IncomeStatement | null {
  const contexts = parseContexts(xml);
  const headline = contexts.get(HEADLINE_CONTEXT);
  // No current-quarter column means this filing cannot be read. Falling back to
  // another column would store the wrong period under the right label.
  if (!headline) return null;

  return {
    revenue: fact(xml, "RevenueFromOperations", HEADLINE_CONTEXT),
    otherIncome: fact(xml, "OtherIncome", HEADLINE_CONTEXT),
    totalIncome: fact(xml, "Income", HEADLINE_CONTEXT),
    totalExpenses: fact(xml, "Expenses", HEADLINE_CONTEXT),
    profitBeforeTax: fact(xml, "ProfitBeforeTax", HEADLINE_CONTEXT),
    profitAfterTax: fact(xml, "ProfitLossForPeriod", HEADLINE_CONTEXT),
    // Verified tag names. EPS is NOT filed as a bare
    // "BasicEarningsLossPerShare" — Ind-AS splits it into continuing,
    // discontinued, and the combined total. The combined figure is the
    // headline EPS a reader expects, so that is the one stored.
    basicEps: fact(
      xml,
      "BasicEarningsLossPerShareFromContinuingAndDiscontinuedOperations",
      HEADLINE_CONTEXT,
    ),
    dilutedEps: fact(
      xml,
      "DilutedEarningsLossPerShareFromContinuingAndDiscontinuedOperations",
      HEADLINE_CONTEXT,
    ),
    debtEquityRatio: fact(xml, "DebtEquityRatio", HEADLINE_CONTEXT),
    debtServiceCoverageRatio: fact(xml, "DebtServiceCoverageRatio", HEADLINE_CONTEXT),
    periodEnd: headline.endDate,
  };
}

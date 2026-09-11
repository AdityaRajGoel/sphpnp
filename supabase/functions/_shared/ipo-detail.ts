// Parser for Chittorgarh's per-issue IPO page (chittorgarh.com/ipo/<slug>/<id>/).
//
// The list pages sync-ipos reads give a lot size and a price band but no
// minimum investment, and lot x upper band is NOT the minimum: an SME
// application must be at least two lots, so the one-lot figure understates it
// by half. The issue page publishes the minimum per investor category, along
// with the timetable, registrar, lead managers, issue structure, company
// financials, KPIs, valuation, shareholding and objects of the issue.
//
// Two outputs:
//   facts    - the handful of fields worth a column (min investment, dates,
//              registrar, issue structure) for filtering and cards
//   sections - every section of the page as the page prints it (tables as
//              rows of cells, text as lines), so the detail page can show all
//              of it without this parser having to understand each one
//
// Pure: no fetch, no Deno APIs. The sync fetches; vitest runs these directly.

/** A character from an entity's code point; nothing for a code point no character has (String.fromCodePoint would throw). */
const codePoint = (n: number): string => (Number.isInteger(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "");

export type DetailSection = { title: string; tables: string[][][]; lines: string[] };

export type MinInvestment = { category: string; lots: number; shares: number; amount: number };

export type IpoDetailFacts = {
  min_investment: MinInvestment | null;
  face_value: number | null;
  lot_size: number | null;
  price_band_min: number | null;
  price_band_max: number | null;
  issue_type: string | null;
  sale_type: string | null;
  listing_exchanges: string | null;
  issue_size_crore: number | null;
  fresh_issue_crore: number | null;
  ofs_crore: number | null;
  open_date: string | null;
  close_date: string | null;
  allotment_date: string | null;
  refund_date: string | null;
  credit_date: string | null;
  listing_date: string | null;
  registrar: string | null;
  lead_managers: string[];
  promoter_holding_pre: number | null;
  promoter_holding_post: number | null;
};

export type IpoDetail = { facts: IpoDetailFacts; sections: DetailSection[] };

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

const ENTITIES: Record<string, string> = { amp: "&", nbsp: " ", quot: '"', "#39": "'", apos: "'", lt: "<", gt: ">", rsquo: "'", lsquo: "'", ldquo: '"', rdquo: '"', ndash: "-", mdash: "-", minus: "-", times: "x", hellip: "...", bull: "-", middot: "-" };

const decodeOnce = (text: string): string =>
  text.replace(/&(#x?[0-9a-f]+|[a-z]+\d*);/gi, (whole, name: string) => {
    if (name.startsWith("#x") || name.startsWith("#X")) return codePoint(parseInt(name.slice(2), 16));
    if (name.startsWith("#") && /^#\d+$/.test(name) && !ENTITIES[name]) return codePoint(Number(name.slice(1)));
    return ENTITIES[name.toLowerCase()] ?? whole;
  });

/** Entities decoded, twice over: Chittorgarh encodes some twice ("&amp;minus;"). */
const decode = (text: string): string => decodeOnce(decodeOnce(text));

/** Visible text of an HTML fragment, whitespace collapsed. */
const text = (html: string): string => decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

/** "Wed, Sep 16, 2026" (optionally trailed by the site's "T" marker) -> "2026-09-16". */
export function parseIndianDate(value: string): string | null {
  const match = /([A-Za-z]{3})[a-z]*\s+(\d{1,2}),\s*(\d{4})/.exec(value);
  if (!match) return null;
  const month = MONTHS[match[1].toLowerCase()];
  return month ? `${match[3]}-${month}-${match[2].padStart(2, "0")}` : null;
}

/** The "agg. up to ₹ 125 Cr" figure in a share-count cell, in crore. */
export function parseCroreAmount(value: string): number | null {
  const match = /₹\s*([\d,]+(?:\.\d+)?)\s*Cr/i.exec(value);
  return match ? Number(match[1].replace(/,/g, "")) : null;
}

const firstNumber = (value: string): number | null => {
  const match = /-?[\d,]+(?:\.\d+)?/.exec(value);
  return match ? Number(match[0].replace(/,/g, "")) : null;
};

/** Sections that are the site talking about itself, not about the issue. */
const STOP_SECTION = /^(IPO FAQs|Compare:?|IPO Message Board)$/i;

/**
 * Lines a text section carries that are the site's own navigation - links to
 * its reports, "Visit Website", "Read More" - rather than facts.
 */
const BOILERPLATE = /^(IPOs Timetable|Lead Manager Reports|Lead Manager Performance (Summary|Tracker)|Visit Website|\+ Read More|Read More|Updated on .*)$/i;

function tablesIn(html: string): string[][][] {
  return [...html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi)].map((table) =>
    [...table[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
      .map((row) => [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => text(cell[1])))
      .filter((cells) => cells.some(Boolean)),
  ).filter((rows) => rows.length > 0);
}

/** The text of a section outside its tables, one line per block element. */
function linesIn(html: string): string[] {
  const withoutTables = html.replace(/<table[\s\S]*?<\/table>/gi, " ");
  return withoutTables
    .split(/<\/?(?:p|li|div|br|dt|dd|h3|h4|h5|ul|ol|tr)[^>]*>/i)
    .map(text)
    .filter((line) => line && !BOILERPLATE.test(line));
}

/**
 * The issue's own <h2> chunks, from "IPO Details" up to the site's FAQ, as raw
 * HTML. The page's navigation menu is built from <h2>s too ("IPO Insights",
 * "Stock Broker Reviews", "About Chittorgarh City"), so nothing before the
 * issue's first section is kept.
 */
function sectionChunks(html: string): { title: string; body: string }[] {
  const chunks: { title: string; body: string }[] = [];
  let started = false;
  for (const chunk of html.split(/(?=<h2[\s>])/i)) {
    const heading = /^<h2[^>]*>([\s\S]*?)<\/h2>/i.exec(chunk);
    if (!heading) continue;
    const title = text(heading[1]);
    if (!started && !/^IPO Details$/i.test(title)) continue;
    started = true;
    if (STOP_SECTION.test(title)) break;
    chunks.push({ title, body: chunk.slice(heading[0].length) });
  }
  return chunks;
}

/** Every section of the issue page, in page order, as tables and lines of text. */
export function detailSections(html: string): DetailSection[] {
  const sections: DetailSection[] = [];
  for (const { title, body } of sectionChunks(html)) {
    const section = { title, tables: tablesIn(body), lines: linesIn(body) };
    // The page splits "IPO Details" across two headings, the second untitled.
    const previous = sections[sections.length - 1];
    if (!title && previous) {
      previous.tables.push(...section.tables);
      previous.lines.push(...section.lines);
      continue;
    }
    if (title) sections.push(section);
  }
  return sections;
}

export type DocumentKind = "rhp" | "drhp" | "anchor" | "allotment" | "company";
export type IpoDocument = { kind: DocumentKind; label: string; url: string };

const DOCUMENT_LABEL: Record<DocumentKind, string> = {
  rhp: "Red Herring Prospectus (RHP)",
  drhp: "Draft Red Herring Prospectus (DRHP)",
  anchor: "Anchor investors letter",
  allotment: "Check allotment status",
  company: "Company website",
};

/** Links that are the site's own business, never a document about the issue. */
const NOT_A_DOCUMENT = /tinyurl\.com|investorgain\.com|chittorgarh\.com\/(?!.*\.pdf)/i;

/**
 * The offer documents and useful links the issue page carries: the RHP or DRHP
 * (hosted by SEBI, the lead manager or the company itself), the anchor
 * investors letter, the registrar's allotment-status page and the company's
 * website. One of each, the first the page gives.
 */
export function detailDocuments(html: string): IpoDocument[] {
  const found = new Map<DocumentKind, IpoDocument>();
  // The RHP link sits in the page's introduction, above the first section
  // heading, so the whole page is scanned; links whose meaning depends on the
  // section (a registrar's or a company's "Visit Website") are then read from
  // their own sections only.
  const scopes = [{ title: "", body: html }, ...sectionChunks(html)];
  for (const { title, body } of scopes) {
    for (const link of body.matchAll(/<a\b[^>]*href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
      const url = decode(link[1]);
      const label = text(link[2]);
      if (NOT_A_DOCUMENT.test(url)) continue;
      let kind: DocumentKind | null = null;
      if (/\bDRHP\b|Draft Red Herring/i.test(label)) kind = "drhp";
      else if (/\bRHP\b|Red Herring/i.test(label)) kind = "rhp";
      else if (/Anchor Investors?/i.test(label) && /\.pdf($|\?)/i.test(url)) kind = "anchor";
      else if (/Visit Website/i.test(label) && /Registrar/i.test(title)) kind = "allotment";
      else if (/Visit Website/i.test(label) && /Contact/i.test(title)) kind = "company";
      if (kind && !found.has(kind)) found.set(kind, { kind, label: DOCUMENT_LABEL[kind], url });
    }
  }
  return [...found.values()];
}

const findSection = (sections: DetailSection[], pattern: RegExp) => sections.find((s) => pattern.test(s.title));

/** Label -> value for every two-cell row across a section's tables. */
function keyValues(section: DetailSection | undefined): Map<string, string> {
  const map = new Map<string, string>();
  for (const table of section?.tables ?? []) for (const row of table) if (row.length >= 2) map.set(row[0], row[1]);
  return map;
}

/**
 * Label -> date for the timetable, which prints each step as one line:
 * "IPO Open Wed, Sep 16, 2026". The label is whatever precedes the date.
 */
function timetableDates(lines: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of lines) {
    const match = /^(.*?)\s*((?:[A-Za-z]{3},\s*)?[A-Za-z]{3}\s+\d{1,2},\s*\d{4})/.exec(line);
    const date = match ? parseIndianDate(match[2]) : null;
    if (match && date && match[1]) map.set(match[1].trim(), date);
  }
  return map;
}

/**
 * The lowest application size the page lists: the first "(Min)" row of the
 * lot-size table - "Retail (Min)" on a mainboard issue, "Individual investors
 * (IND) (Min)" on an SME issue. Taken as published, lots, shares and amount.
 */
function minInvestment(section: DetailSection | undefined): MinInvestment | null {
  for (const table of section?.tables ?? []) {
    const row = table.find((cells) => /\(Min\)/i.test(cells[0] ?? "") && cells.length >= 4);
    if (!row) continue;
    const lots = firstNumber(row[1]);
    const shares = firstNumber(row[2]);
    const amount = firstNumber(row[3]);
    if (lots === null || shares === null || amount === null) continue;
    return { category: row[0].replace(/\s*\(Min\)\s*$/i, "").trim(), lots, shares, amount };
  }
  return null;
}

/** "₹88 to ₹93" -> both ends; a fixed-price "₹93" -> the same figure twice. */
function priceBand(value: string | null): { price_band_min: number | null; price_band_max: number | null } {
  const numbers = [...(value ?? "").matchAll(/₹\s*([\d,]+(?:\.\d+)?)/g)].map((m) => Number(m[1].replace(/,/g, "")));
  if (numbers.length === 0) return { price_band_min: null, price_band_max: null };
  return { price_band_min: Math.min(...numbers), price_band_max: Math.max(...numbers) };
}

function promoterHolding(section: DetailSection | undefined): [number | null, number | null] {
  for (const table of section?.tables ?? []) {
    const row = table.find((cells) => /^Promoter/i.test(cells[0] ?? ""));
    if (row) return [firstNumber(row[1] ?? ""), firstNumber(row[2] ?? "")];
  }
  return [null, null];
}

export function parseChittorgarhDetail(html: string): IpoDetail {
  const sections = detailSections(html);
  const details = keyValues(findSection(sections, /^IPO Details$/i));
  const timetable = timetableDates(findSection(sections, /^IPO Timetable/i)?.lines ?? []);
  const registrar = findSection(sections, /^IPO Registrar$/i)?.lines[0] ?? null;
  const leadManagers = findSection(sections, /^IPO Lead Manager/i)?.lines ?? [];
  const [promoterPre, promoterPost] = promoterHolding(findSection(sections, /^Shareholding Structure$/i));

  const dateOf = (label: string) => timetable.get(label) ?? null;
  const detail = (label: string) => details.get(label) ?? null;
  const crore = (label: string) => {
    const value = detail(label);
    return value ? parseCroreAmount(value) : null;
  };

  return {
    sections,
    facts: {
      min_investment: minInvestment(findSection(sections, /^IPO Lot Size$/i)),
      face_value: detail("Face Value") ? firstNumber(detail("Face Value")!) : null,
      lot_size: detail("Lot Size") ? firstNumber(detail("Lot Size")!) : null,
      ...priceBand(detail("Price Band")),
      issue_type: detail("Issue Type"),
      sale_type: detail("Sale Type"),
      listing_exchanges: detail("Listing At"),
      issue_size_crore: crore("Total Issue Size"),
      fresh_issue_crore: crore("Fresh Issue"),
      ofs_crore: crore("Offer for Sale"),
      open_date: dateOf("IPO Open"),
      close_date: dateOf("IPO Close"),
      allotment_date: dateOf("Allotment"),
      refund_date: dateOf("Refund"),
      credit_date: dateOf("Credit of Shares"),
      listing_date: dateOf("Listing"),
      registrar,
      lead_managers: leadManagers,
      promoter_holding_pre: promoterPre,
      promoter_holding_post: promoterPost,
    },
  };
}

// ---------------------------------------------------------------------------
// Subscription (chittorgarh.com/ipo_subscription/<slug>/<id>/)
// ---------------------------------------------------------------------------

export type IpoSubscription = {
  total: number | null;
  qib: number | null;
  nii: number | null;
  retail: number | null;
  employee: number | null;
  categories: { category: string; times: number }[];
  /** When Chittorgarh took the figures, as an ISO instant. */
  as_of: string | null;
};

/** The issue page's subscription counterpart, only for Chittorgarh's own issue pages. */
export function subscriptionUrl(detailUrl: string): string | null {
  return /^https:\/\/www\.chittorgarh\.com\/ipo\/[a-z0-9-]+\/\d+\/$/.test(detailUrl)
    ? detailUrl.replace("/ipo/", "/ipo_subscription/")
    : null;
}

/** "as of Sep 10, 2026 17:09" (Indian time) -> the instant in UTC. */
function asOfInstant(text: string): string | null {
  const match = /as of\s+([A-Za-z]{3})[a-z]*\s+(\d{1,2}),\s*(\d{4})\s+(\d{1,2}):(\d{2})/i.exec(text);
  if (!match) return null;
  const month = MONTHS[match[1].toLowerCase()];
  if (!month) return null;
  const iso = `${match[3]}-${month}-${match[2].padStart(2, "0")}T${match[4].padStart(2, "0")}:${match[5]}:00+05:30`;
  const instant = new Date(iso);
  return Number.isNaN(instant.getTime()) ? null : instant.toISOString();
}

/**
 * The "Investor Category | Subscription (times)" table the subscription page
 * carries once bidding has opened. Null before then - an issue nobody has bid
 * on yet has no subscription, which is not the same as a subscription of zero.
 */
export function parseChittorgarhSubscription(html: string): IpoSubscription | null {
  const table = [...html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi)]
    .map((m) => m[1])
    .find((body) => /Subscription \(times\)/i.test(text(body.match(/<thead[\s\S]*?<\/thead>/i)?.[0] ?? body.slice(0, 800))));
  if (!table) return null;

  const categories = [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((row) => [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => text(cell[1])))
    .filter((cells) => cells.length >= 2)
    .map((cells) => ({ category: cells[0], times: firstNumber(cells[1]) }))
    .filter((row): row is { category: string; times: number } => Boolean(row.category) && row.times !== null);
  if (categories.length === 0) return null;

  const find = (pattern: RegExp) => categories.find((c) => pattern.test(c.category))?.times ?? null;
  return {
    total: find(/^Total/i),
    qib: find(/^Qualified Institutional|^QIB/i),
    nii: find(/^Non[- ]Institutional|^NII/i),
    retail: find(/^Retail|^Individual/i),
    employee: find(/^Employee/i),
    categories,
    as_of: asOfInstant(text(html.slice(Math.max(0, html.indexOf(table) - 3000), html.indexOf(table)))),
  };
}

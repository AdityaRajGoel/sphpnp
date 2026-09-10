// Parsing for the three independent IPO data sources (IPO Watch, InvestorGain,
// Chittorgarh), split out of sync-ipos/index.ts so it can be tested directly:
// that file calls Deno.serve() at module scope and so cannot be imported by
// the Node test runner. Same arrangement as screener-row.ts, ratios.ts and
// period.ts.
//
// Each parser reads only what its own source can state with confidence and
// returns plain rows keyed by slug. Reconciling those rows into one catalogue
// entry (ipo-reconcile.ts) is a separate, independently tested step: a single
// wrong column mapping here must never silently corrupt every field the way
// the previous single-source parser did (name/GMP/price-band/dates/type/status
// were read from a fixed column order that no longer matched IPO Watch's live
// table - see the module comment in ipo-reconcile.ts for the full account).

export type Board = "mainboard" | "sme";
export type IpoStatus = "upcoming" | "open" | "closed" | "listed";

export type CollectedIpo = {
  slug: string;
  name: string;
  board: Board;
  status: IpoStatus;
  price_band_min: number | null;
  price_band_max: number | null;
  open_date: string | null;
  close_date: string | null;
};

export type SourceName = "ipowatch" | "investorgain" | "chittorgarh";

const MONTHS = [
  "jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec",
];

const monthNumber = (name: string): number | null => {
  const index = MONTHS.indexOf(name.slice(0, 3).toLowerCase());
  return index === -1 ? null : index + 1;
};

const iso = (year: string, month: number, day: string) =>
  `${year}-${String(month).padStart(2, "0")}-${day.padStart(2, "0")}`;

/**
 * Reads an IPO subscription window.
 *
 * IPO Watch writes these three ways, and all three occur in practice:
 *   "10 - 14 Sep 2026"          both dates in one month
 *   "29 Sep - 3 Oct 2026"       crossing a month boundary
 *   "30 Dec 2026 - 2 Jan 2027"  crossing a year boundary
 *
 * A window with no year is left null rather than guessed: assuming the current
 * year is wrong for exactly the December/January issues where being wrong
 * matters most.
 */
export function parseDateRange(value: string): [string | null, string | null] {
  const text = value.replace(/–|—/g, "-").trim();
  if (!text) return [null, null];

  // Longest form first: each side carries its own month and year.
  const bothFull = text.match(
    /(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})\s*-\s*(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})/,
  );
  if (bothFull) {
    const from = monthNumber(bothFull[2]);
    const to = monthNumber(bothFull[5]);
    if (from === null || to === null) return [null, null];
    return [iso(bothFull[3], from, bothFull[1]), iso(bothFull[6], to, bothFull[4])];
  }

  // Each side carries a month, one shared year at the end.
  const bothMonths = text.match(
    /(\d{1,2})\s+([A-Za-z]{3,9})\s*-\s*(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})/,
  );
  if (bothMonths) {
    const from = monthNumber(bothMonths[2]);
    const to = monthNumber(bothMonths[4]);
    if (from === null || to === null) return [null, null];
    // A range that runs backwards by month has crossed into the next year.
    const year = Number(bothMonths[5]);
    const closeYear = to < from ? String(year + 1) : bothMonths[5];
    return [iso(bothMonths[5], from, bothMonths[1]), iso(closeYear, to, bothMonths[3])];
  }

  // Both days in the same month.
  const sameMonth = text.match(/(\d{1,2})\s*-\s*(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})/);
  if (sameMonth) {
    const month = monthNumber(sameMonth[3]);
    if (month === null) return [null, null];
    return [iso(sameMonth[4], month, sameMonth[1]), iso(sameMonth[4], month, sameMonth[2])];
  }

  return [null, null];
}

/**
 * Reads a chittorgarh-style single date, e.g. "17-Sep-2026". Blank or
 * unparseable cells (issue dates not yet confirmed) return null.
 */
export function parseSingleDate(value: string): string | null {
  const match = value.trim().match(/^(\d{1,2})-([A-Za-z]{3,9})-(\d{4})$/);
  if (!match) return null;
  const month = monthNumber(match[2]);
  if (month === null) return null;
  return iso(match[3], month, match[1]);
}

/**
 * Reads a grey-market premium, which may legitimately be a discount.
 *
 * Only a minus directly attached to the number counts as negative. Testing the
 * whole cell for a dash - as this originally did - turns a quoted range like
 * "12-15" into a 12 rupee discount, inverting the signal the page exists to
 * show.
 */
export function parseGmp(value: string): number | null {
  const match = value.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

export const stripTags = (value: string): string => {
  let previous = "";
  let text = value;
  while (text !== previous) {
    previous = text;
    text = text.replace(/<[^>]*>/g, "");
  }
  return text.replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
};

/**
 * A slug is how the same IPO is matched across three sites that never spell
 * its name the same way ("Tata Technologies Ltd" vs "Tata Technologies
 * Limited" vs "Tata Technologies IPO"). Company/registrar/IPO/limited/private
 * are noise words for matching purposes only - never for display.
 */
export const slugify = (value: string): string => value
  .toLowerCase()
  .replace(/\b(ipo|limited|ltd\.?|private|inc\.?)\b/g, " ")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/(^-|-$)/g, "")
  .slice(0, 96);

export const cleanIpoName = (value: string): string =>
  value.replace(/\s*(IPO|Limited|Ltd\.?)\s*/gi, " ").replace(/\s+/g, " ").trim();

/**
 * Status markers the list sites glue to the end of a name with no separator:
 * O(pen), U(pcoming), C(losed), L(isted), P and CT (closing today).
 */
const STATUS_MARKER = /\s+(?:CT|[OUCLP])$/;

/**
 * The key two sources' names for one issue have in common.
 *
 * A slug of the printed name is not an identity: the sites decorate names
 * differently - "Glass Wall Systems (India) CT" on Chittorgarh is "Glass Wall
 * Systems" on IPO Watch, "Steamhouse India" is "Steamhouse" on InvestorGain -
 * and every difference split one issue into two half-complete rows. This drops
 * what the sources disagree about: parentheticals, status markers, legal
 * suffixes, a trailing "India", punctuation and "&" versus "and".
 *
 * A trailing "India" only, deliberately: "India Glycols" must not collapse onto
 * some "Glycols". The key only ever groups rows - a false match is still
 * refused downstream when the two rows' open dates disagree.
 */
export function ipoMatchKey(name: string): string {
  return name
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(STATUS_MARKER, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(?:ipo|limited|ltd|private|pvt)\b\.?/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+india$/, "")
    .replace(/\s+/g, "");
}

export const amount = (value: string): number | null => {
  const match = value.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
};

/** A non-zero reading, or null when the cell is a "not yet disclosed" placeholder. */
const positiveAmount = (value: string): number | null => {
  const value_ = amount(value);
  return value_ !== null && value_ > 0 ? value_ : null;
};

export const priceBand = (value: string): [number | null, number | null] => {
  const values = [...value.replace(/,/g, "").matchAll(/\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
  if (values.length === 0) return [null, null];
  return [values[0], values[values.length - 1]];
};

const statusFromLabel = (text: string): IpoStatus => {
  if (text.includes("open") || text.includes("live")) return "open";
  if (text.includes("listed")) return "listed";
  if (text.includes("closed") || text.includes("allotment")) return "closed";
  return "upcoming";
};

/** Finds every `<table>` in the document along with the nearest heading above it. */
function tablesWithHeadings(html: string): { tableHtml: string; heading: string }[] {
  const results: { tableHtml: string; heading: string }[] = [];
  const tableRe = /<table[^>]*>[\s\S]*?<\/table>/gi;
  let match: RegExpExecArray | null;
  while ((match = tableRe.exec(html))) {
    const start = match.index;
    const before = html.slice(Math.max(0, start - 2000), start);
    const headingMatches = before.match(/<h[1-4][^>]*>[\s\S]*?<\/h[1-4]>/gi) ?? [];
    const heading = headingMatches.length ? stripTags(headingMatches[headingMatches.length - 1]) : "";
    results.push({ tableHtml: match[0], heading });
  }
  return results;
}

const tableRows = (tableHtml: string): string[] => tableHtml.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? [];
const rowCells = (row: string): string[] | null => {
  const cells = row.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi);
  return cells ? cells.map(stripTags) : null;
};

// ---------------------------------------------------------------------------
// IPO Watch
// ---------------------------------------------------------------------------

/**
 * IPO Watch's live GMP tables (as of 2026-09) have exactly eight columns, in
 * this order:
 *
 *   IPO Name | IPO GMP* | Trend | Price Band | Est. Listing | Date | Status | Last Updated
 *
 * There is no "Type" column - mainboard vs SME is which of the two tables a
 * row sits in ("Mainboard IPO GMP" / "SME IPO GMP" headings), not a cell. The
 * previous parser assumed a nine-field layout ending "...dates, type, status,
 * last updated" and read values[6] as type and values[7] as status. Against
 * the real table that reads the actual Status cell ("Upcoming"/"Open"/
 * "Closed") as the board type - which never contains "sme", so every SME row
 * was silently filed as mainboard - and reads the Last Updated cell (e.g. "9
 * Sept, 18:01") as the status text, which never matches "open"/"closed"/
 * "listed", so every row fell through to the "upcoming" default regardless of
 * its real status. That one off-by-one in the assumed column count is why the
 * tracker showed IPOs that had already opened, closed or listed as
 * perpetually "upcoming", and filed SME issues as mainboard.
 */
export type IpoWatchGmpRow = {
  slug: string;
  name: string;
  board: Board;
  status: IpoStatus;
  price_band_min: number | null;
  price_band_max: number | null;
  open_date: string | null;
  close_date: string | null;
  gmp: number | null;
  est_listing_price: number | null;
};

export type IpoWatchListingRow = {
  slug: string;
  name: string;
  listing_price: number | null;
};

export type IpoWatchParseResult = {
  rows: IpoWatchGmpRow[];
  listings: IpoWatchListingRow[];
  tablesMatched: number;
};

export function parseIpoWatch(html: string): IpoWatchParseResult {
  const rows: IpoWatchGmpRow[] = [];
  const listings: IpoWatchListingRow[] = [];
  let tablesMatched = 0;

  for (const { tableHtml, heading } of tablesWithHeadings(html)) {
    const allRows = tableRows(tableHtml);
    if (allRows.length < 2) continue;
    const header = stripTags(allRows[0]).toLowerCase();

    const isGmpTable = header.includes("gmp") && header.includes("price band") && header.includes("status");
    const isPerformanceTable = header.includes("gmp") && header.includes("listing price") && !header.includes("status");
    if (!isGmpTable && !isPerformanceTable) continue;
    tablesMatched++;

    const board: Board = heading.toLowerCase().includes("sme") ? "sme" : "mainboard";

    for (const row of allRows.slice(1)) {
      const values = rowCells(row);
      if (!values) continue;
      const name = cleanIpoName(values[0] ?? "");
      if (name.length < 2 || name === "-" || name === "--") continue;

      if (isPerformanceTable) {
        if (values.length < 4) continue;
        listings.push({ slug: slugify(name), name, listing_price: amount(values[3] ?? "") });
        continue;
      }

      if (values.length < 7) continue;
      const gmp = parseGmp(values[1] ?? "");
      const [min, max] = priceBand(values[3] ?? "");
      const estimated = amount(values[4] ?? "");
      const [openDate, closeDate] = parseDateRange(values[5] ?? "");
      const status = statusFromLabel((values[6] ?? "").toLowerCase());

      rows.push({
        slug: slugify(name), name, board, status,
        price_band_min: min, price_band_max: max, open_date: openDate, close_date: closeDate,
        gmp, est_listing_price: estimated,
      });
    }
  }

  const seen = new Set<string>();
  return {
    rows: rows.filter((row) => row.slug && !seen.has(row.slug) && (seen.add(row.slug), true)),
    listings,
    tablesMatched,
  };
}

// ---------------------------------------------------------------------------
// InvestorGain
// ---------------------------------------------------------------------------

/**
 * InvestorGain's live-GMP table columns (2026-09):
 *
 *   Name | GMP | Rating | Sub | Price (Rs.) | IPO Size | Lot | Open | Close | BoA Dt | Listing | Updated-On | Anchor
 *
 * Only Name, GMP, IPO Size and Lot are read here. Price is a single number
 * (the upper price-band edge for book-built issues, or the fixed price) with
 * no reliable way to recover the lower edge, so it is left to Chittorgarh /
 * IPO Watch. Open/Close/BoA/Listing are day-and-month only with no year
 * anywhere in the row - guessing a year for a Dec/Jan-adjacent issue is
 * exactly the mistake parseDateRange already refuses to make for IPO Watch,
 * so those columns are not used for dates either.
 *
 * The Name column itself carries the board and status as a suffix with no
 * separator, e.g. "Axiom Gas Engineering NSE SMEU", "Steamhouse IPOO",
 * "Qualiance International NSE SMECAllotted". The last letter is the status
 * code (U=upcoming, O=open, C=closed/allotment pending), optionally followed
 * by "Allotted".
 */
export type InvestorGainRow = {
  slug: string;
  name: string;
  board: Board;
  status: IpoStatus;
  gmp: number | null;
  lot_size: number | null;
  issue_size_crore: number | null;
};

const INVESTORGAIN_SUFFIX = /\s*(NSE SME|BSE SME|NSE|BSE|IPO)([UOC])(Allotted)?\s*$/i;

function splitInvestorGainName(raw: string): { name: string; board: Board; status: IpoStatus } | null {
  const match = raw.match(INVESTORGAIN_SUFFIX);
  if (!match) return null;
  const marker = match[1].toUpperCase();
  const board: Board = marker.includes("SME") ? "sme" : "mainboard";
  const letter = match[2].toUpperCase();
  const status: IpoStatus = letter === "U" ? "upcoming" : letter === "O" ? "open" : "closed";
  const name = cleanIpoName(raw.slice(0, match.index));
  return { name, board, status };
}

const parseInvestorGainGmp = (raw: string): number | null => {
  const match = raw.match(/₹\s*(--|-?\d+(?:\.\d+)?)/);
  if (!match || match[1] === "--") return null;
  return Number(match[1]);
};

export function parseInvestorGain(html: string): { rows: InvestorGainRow[]; tablesMatched: number } {
  const rows: InvestorGainRow[] = [];
  let tablesMatched = 0;

  for (const { tableHtml } of tablesWithHeadings(html)) {
    const allRows = tableRows(tableHtml);
    if (allRows.length < 2) continue;
    const header = stripTags(allRows[0]).toLowerCase();
    if (!header.includes("gmp") || !header.includes("lot") || !header.includes("open")) continue;
    tablesMatched++;

    for (const row of allRows.slice(1)) {
      const values = rowCells(row);
      if (!values || values.length < 7) continue;
      if ((values[0] ?? "").toLowerCase() === "name") continue; // repeated header row

      const split = splitInvestorGainName(values[0] ?? "");
      if (!split || split.name.length < 2) continue;

      rows.push({
        slug: slugify(split.name), name: split.name, board: split.board, status: split.status,
        gmp: parseInvestorGainGmp(values[1] ?? ""),
        issue_size_crore: positiveAmount(values[5] ?? ""),
        lot_size: positiveAmount(values[6] ?? "") !== null ? Math.round(Number((values[6] ?? "").replace(/,/g, "").match(/\d+/)?.[0] ?? "0")) || null : null,
      });
    }
  }

  const seen = new Set<string>();
  return { rows: rows.filter((row) => row.slug && !seen.has(row.slug) && (seen.add(row.slug), true)), tablesMatched };
}

// ---------------------------------------------------------------------------
// Chittorgarh
// ---------------------------------------------------------------------------

/**
 * Chittorgarh's mainboard/SME issue lists are fetched from two separate URLs
 * (one per board), so board is known from which page was requested rather
 * than parsed out of the row. Columns (2026-09):
 *
 *   Company | Pricing Method | Opening Date | Closing Date | Listing Date |
 *   Issue Price (Rs.) | Total Issue Amount (Rs.cr.) | Fresh Capital (Rs.cr.) |
 *   Offer for sale (Rs.cr.) | Issue Amount (Rs.cr.) | Listing at | Left Lead Manager | Compare
 *
 * The list has a blank spacer row and, like InvestorGain, occasionally
 * appends a bare status letter to the company name (e.g. "Rentomojo Ltd. O")
 * with no separator - stripped the same way before slugifying so it still
 * matches the same IPO on the other two sites. A "0.00" issue amount is this
 * source's placeholder for "not yet disclosed", not a real zero, so it is
 * treated as absent.
 */
export type ChittorgarhRow = {
  slug: string;
  name: string;
  board: Board;
  price_band_min: number | null;
  price_band_max: number | null;
  open_date: string | null;
  close_date: string | null;
  listing_date: string | null;
  issue_size_crore: number | null;
};

const cleanChittorgarhName = (raw: string): string =>
  cleanIpoName(raw).replace(STATUS_MARKER, "").trim();

export function parseChittorgarh(html: string, board: Board): { rows: ChittorgarhRow[]; tablesMatched: number } {
  const rows: ChittorgarhRow[] = [];
  let tablesMatched = 0;

  for (const { tableHtml } of tablesWithHeadings(html)) {
    const allRows = tableRows(tableHtml);
    if (allRows.length < 2) continue;
    const header = stripTags(allRows[0]).toLowerCase();
    if (!header.includes("opening date") || !header.includes("closing date") || !header.includes("issue")) continue;
    tablesMatched++;

    for (const row of allRows.slice(1)) {
      const values = rowCells(row);
      if (!values || values.length < 10) continue;
      const name = cleanChittorgarhName(values[0] ?? "");
      if (name.length < 2) continue;

      const [min, max] = priceBand(values[5] ?? "");
      rows.push({
        slug: slugify(name), name, board,
        price_band_min: min, price_band_max: max,
        open_date: parseSingleDate(values[2] ?? ""),
        close_date: parseSingleDate(values[3] ?? ""),
        listing_date: parseSingleDate(values[4] ?? ""),
        issue_size_crore: positiveAmount(values[9] ?? ""),
      });
    }
  }

  const seen = new Set<string>();
  return { rows: rows.filter((row) => row.slug && !seen.has(row.slug) && (seen.add(row.slug), true)), tablesMatched };
}

// ---------------------------------------------------------------------------
// Catalogue row assembly
// ---------------------------------------------------------------------------

export type ReconciledIpo = CollectedIpo & {
  listing_date: string | null;
  issue_size_crore: number | null;
  lot_size: number | null;
  est_listing_price: number | null;
  listing_price: number | null;
  listing_gain_pct: number | null;
  field_sources: Partial<Record<string, SourceName>>;
};

/**
 * Builds the row upserted into `ipos`, omitting anything this collection did
 * not actually observe.
 *
 * The catalogue is upserted on `slug`, so a key present with a null value is an
 * UPDATE ... SET col = NULL. A single run that fails to read a price band or a
 * date range would then destroy a value an earlier run read correctly, and the
 * public IPO page would lose data it had already shown. Omitting the key leaves
 * the stored value untouched. This is the same rule buildStockRow follows in
 * screener-row.ts, for the same reason.
 *
 * `sourcesLabel` and `field_sources` are the exception worth calling out:
 * `source`/`source_url` are a human-readable summary of which sources
 * contributed to *this run*, and `field_sources` (merged against whatever was
 * already stored, by the caller) is what the UI reads to show "GMP: source"
 * on each field. Neither is a value a visitor could mistake for observed IPO
 * data, so overwriting them each run is fine.
 */
export function toCatalogueRow(
  ipo: CollectedIpo | ReconciledIpo,
  sourcesLabel: string,
  sourceUrl: string,
  capturedAt: string,
): Record<string, unknown> {
  const row: Record<string, unknown> = {
    slug: ipo.slug,
    name: ipo.name,
    board: ipo.board,
    status: ipo.status,
    source: sourcesLabel,
    source_url: sourceUrl,
    data_as_of: capturedAt,
    updated_at: capturedAt,
  };

  const reconciled = ipo as Partial<ReconciledIpo>;
  const optional: Record<string, unknown> = {
    price_band_min: ipo.price_band_min,
    price_band_max: ipo.price_band_max,
    open_date: ipo.open_date,
    close_date: ipo.close_date,
    listing_date: reconciled.listing_date,
    issue_size_crore: reconciled.issue_size_crore,
    lot_size: reconciled.lot_size,
    listing_price: reconciled.listing_price,
    listing_gain_pct: reconciled.listing_gain_pct,
  };
  for (const [column, value] of Object.entries(optional)) {
    if (value !== null && value !== undefined) row[column] = value;
  }

  if (reconciled.field_sources && Object.keys(reconciled.field_sources).length > 0) {
    row.field_sources = reconciled.field_sources;
  }

  return row;
}

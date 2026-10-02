// AMFI's daily NAVAll.txt, the official free source for every Indian mutual
// fund scheme's NAV.
//
// Columns are resolved by HEADER NAME, never by position. That is the whole
// point of this module: the previous inline parser read the NAV from index 4,
// AMFI later inserted `Plan` and `Option` ahead of it, and NAV moved to index
// 6. Every row then parsed as NaN and was skipped, the job caught the error
// into a report field and still returned 200, and mutual fund NAVs sat frozen
// for weeks while the daily workflow reported success. Header resolution means
// another inserted column changes nothing.
//
// Fetched from portal.amfiindia.com, not www.amfiindia.com - the www host 302s
// and a fetch that does not follow redirects gets 169 bytes of redirect HTML.

export const AMFI_NAVALL_URL = "https://portal.amfiindia.com/spages/NAVAll.txt";

export type AmfiNav = {
  scheme_code: string;
  isin_growth: string | null;
  isin_reinvest: string | null;
  scheme_name: string;
  plan: string | null;
  option: string | null;
  nav: number;
  /** ISO yyyy-mm-dd. */
  nav_date: string;
  /** The fund-house line above this group, e.g. "HDFC Mutual Fund". */
  amc: string | null;
  /** The scheme-type heading above it, e.g. "Equity Scheme - Large Cap Fund". */
  category: string | null;
};

export type AmfiParseResult = {
  rows: AmfiNav[];
  /** False when no recognisable header was found - see parseAmfiNavAll. */
  headerFound: boolean;
};

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

/** AMFI writes dates as `09-Sep-2026`. */
export function amfiDateToISO(raw: string): string | null {
  const match = raw.trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (!match) return null;
  const month = MONTHS[match[2].toLowerCase()];
  if (!month) return null;
  return `${match[3]}-${month}-${match[1].padStart(2, "0")}`;
}

const norm = (value: string) => value.toLowerCase().replace(/[^a-z]/g, "");

/** Header labels AMFI has used, normalised. Order within a list is preference. */
const COLUMN_ALIASES = {
  scheme_code: ["schemecode"],
  isin_growth: ["isindivpayoutisingrowth", "isingrowth", "isindivpayout"],
  isin_reinvest: ["isindivreinvestment", "isinreinvestment"],
  // "NAV Name" in the NAV history report.
  scheme_name: ["schemename", "navname"],
  plan: ["plan"],
  option: ["option"],
  nav: ["netassetvalue", "nav"],
  nav_date: ["date", "navdate"],
} as const;

type ColumnIndex = Partial<Record<keyof typeof COLUMN_ALIASES, number>>;

function resolveHeader(line: string): ColumnIndex | null {
  const cells = line.split(";").map(norm);
  if (cells.length < 4) return null;

  const index: ColumnIndex = {};
  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    for (const alias of aliases) {
      const at = cells.indexOf(alias);
      if (at !== -1) {
        index[field as keyof typeof COLUMN_ALIASES] = at;
        break;
      }
    }
  }
  // A header is only a header if it carries the three fields that make a row
  // meaningful. Anything less and we are looking at data, or at something we no
  // longer understand.
  return index.scheme_code !== undefined && index.nav !== undefined && index.nav_date !== undefined
    ? index
    : null;
}

const cell = (parts: string[], at: number | undefined): string =>
  at === undefined ? "" : (parts[at] ?? "").trim();

const optional = (value: string): string | null => (value && value !== "-" ? value : null);

/**
 * Parses the whole NAVAll.txt payload.
 *
 * The file interleaves data rows with fund-house names and scheme-type
 * headings on their own lines; those carry no semicolons and are skipped by the
 * column-count check rather than by pattern-matching their text.
 *
 * `headerFound: false` is deliberately distinct from an empty `rows`. Zero rows
 * with a header means AMFI published nothing today; zero rows without one means
 * the file changed shape and this parser no longer understands it. Collapsing
 * those two into "no data" is how the previous defect stayed invisible, so the
 * caller is given enough to tell them apart and fail loudly.
 */
/**
 * "Open Ended Schemes ( Equity Scheme - Large Cap Fund )" -> "Equity Scheme -
 * Large Cap Fund". Close-ended and interval schemes cannot be bought on any
 * day, so their category is left null.
 */
const CATEGORY_LINE = /^(open|close|interval)\s+ended\s+schemes?\s*\(\s*(.+?)\s*\)\s*$/i;

export function parseAmfiNavAll(text: string): AmfiParseResult {
  const rows: AmfiNav[] = [];
  let columns: ColumnIndex | null = null;
  // Group context: the file sets these on their own lines above each block.
  let category: string | null = null;
  let amc: string | null = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    if (!columns) {
      columns = resolveHeader(line);
      continue;
    }
    // A later header (AMFI repeats it between sections in some exports) is
    // re-read rather than parsed as data.
    const maybeHeader = resolveHeader(line);
    if (maybeHeader) {
      columns = maybeHeader;
      continue;
    }

    const parts = line.split(";");
    if (parts.length < 4) {
      const heading = line.match(CATEGORY_LINE);
      if (heading) { category = heading[1].toLowerCase() === "open" ? heading[2] : null; amc = null; }
      else if (!line.includes(";")) amc = line;
      continue;
    }

    const scheme_code = cell(parts, columns.scheme_code);
    if (!/^\d+$/.test(scheme_code)) continue;

    const nav = Number.parseFloat(cell(parts, columns.nav));
    const nav_date = amfiDateToISO(cell(parts, columns.nav_date));
    const scheme_name = cell(parts, columns.scheme_name);
    if (!Number.isFinite(nav) || !nav_date || !scheme_name) continue;

    rows.push({
      scheme_code,
      isin_growth: optional(cell(parts, columns.isin_growth)),
      isin_reinvest: optional(cell(parts, columns.isin_reinvest)),
      scheme_name,
      plan: optional(cell(parts, columns.plan)),
      option: optional(cell(parts, columns.option)),
      nav,
      nav_date,
      amc,
      category,
    });
  }

  return { rows, headerFound: columns !== null };
}

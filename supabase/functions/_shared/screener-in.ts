// A company page on screener.in (www.screener.in/company/SYMBOL/consolidated/),
// read into the same statement grids IndianAPI's historical_stats produces -
// IndianAPI serves screener.in's figures, so the labels, units (crore) and
// periods line up row for row. screener.in covers every listed company, where
// IndianAPI's plan runs out at ~80 stocks a day.
//
// Also read: the headline ratios, compounded growth, the quarterly
// shareholding pattern, the machine-generated pros and cons, and the
// company's documents (annual reports, credit ratings, concall transcripts).
//
// Pure: no fetch, no Deno APIs. sync-screener-in does the I/O.

/** A character from an entity's code point; nothing for a code point no character has (String.fromCodePoint would throw). */
const codePoint = (n: number): string => (Number.isInteger(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "");

export type Grid = { periods: string[]; period_ends: (string | null)[]; rows: { label: string; values: (number | null)[] }[] };
export type ScreenerKind = "quarter_results" | "yoy_results" | "balancesheet" | "cashflow" | "ratios";
export type HolderSeries = { category: string; points: { date: string; pct: number }[] };
export type DocLink = { title: string; url: string; note: string | null };
export type Concall = { period: string; transcript: string | null; ppt: string | null; recording: string | null };
export type GrowthTable = { title: string; values: { period: string; pct: number | null }[] };

export type ScreenerPage = {
  name: string | null;
  nse_symbol: string | null;
  bse_code: string | null;
  basis: "consolidated" | "standalone";
  about: string | null;
  top_ratios: {
    market_cap: number | null; price: number | null; high_52: number | null; low_52: number | null;
    pe: number | null; book_value: number | null; dividend_yield: number | null;
    roce: number | null; roe: number | null; face_value: number | null;
  };
  statements: Partial<Record<ScreenerKind, Grid>>;
  growth: GrowthTable[];
  shareholding: HolderSeries[];
  pros: string[];
  cons: string[];
  documents: { annual_reports: DocLink[]; credit_ratings: DocLink[]; concalls: Concall[] };
};

const SECTIONS: Record<string, ScreenerKind> = {
  quarters: "quarter_results",
  "profit-loss": "yoy_results",
  "balance-sheet": "balancesheet",
  "cash-flow": "cashflow",
  ratios: "ratios",
};

/** screener.in's shareholding categories, named as IndianAPI names them. */
const HOLDERS: Record<string, string> = {
  Promoters: "Promoter", FIIs: "FII", DIIs: "DII", Government: "Government", Public: "Public", Others: "Others",
};

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

const decode = (value: string) =>
  value
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n: string) => codePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => codePoint(parseInt(n, 16)));

/** Visible text of a fragment. */
const text = (html: string) => decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

/** "2,07,559", "-1,234", "18%", "0.47 %" -> a number; anything else -> null. */
/**
 * The company page screener.in's search offers for a symbol - the fallback
 * for a company not filed under its NSE symbol, like a BSE-only listing (NSDL
 * is /company/544467/). Only a company-page path is taken, never an off-site
 * or other link.
 */
export function searchResultPath(raw: unknown): string | null {
  const first = Array.isArray(raw) ? raw[0] : null;
  const url = first && typeof first === "object" ? (first as Record<string, unknown>).url : null;
  return typeof url === "string" && /^\/company\/[A-Za-z0-9&%._-]+\/(consolidated\/)?$/.test(url) ? url : null;
}

export function screenerNumber(value: string): number | null {
  const cleaned = text(value).replace(/[,%₹\s]/g, "").replace(/Cr\.?$/i, "");
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** "Jun 2026" -> the month's last day; TTM and anything else -> null. */
export function monthEnd(label: string): string | null {
  const m = /^([A-Za-z]{3})[a-z]*\s+(\d{4})$/.exec(label.trim());
  const month = m ? MONTHS[m[1].toLowerCase()] : undefined;
  if (!m || !month) return null;
  const last = new Date(Date.UTC(Number(m[2]), Number(month), 0)).getUTCDate();
  return `${m[2]}-${month}-${String(last).padStart(2, "0")}`;
}

const section = (html: string, id: string) =>
  new RegExp(`<section id="${id}"[\\s\\S]*?</section>`).exec(html)?.[0] ?? "";

/** The first data table in a fragment, as a grid: header periods, one row per label. */
export function parseTable(fragment: string): Grid | null {
  const table = /<table class="data-table[^"]*">([\s\S]*?)<\/table>/.exec(fragment)?.[1];
  if (!table) return null;
  const head = /<thead>([\s\S]*?)<\/thead>/.exec(table)?.[1] ?? "";
  const headers = [...head.matchAll(/<th([^>]*)>([\s\S]*?)<\/th>/g)].slice(1);
  const periods = headers.map(([, , inner]) => text(inner));
  const period_ends = headers.map(([, attrs, inner]) => {
    const key = /data-date-key="(\d{4}-\d{2}-\d{2})"/.exec(attrs)?.[1];
    return key ?? monthEnd(text(inner));
  });
  if (periods.length === 0) return null;

  const body = /<tbody>([\s\S]*?)<\/tbody>/.exec(table)?.[1] ?? "";
  const rows: Grid["rows"] = [];
  for (const [, row] of body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => c[1]);
    if (cells.length < 2) continue;
    const label = text(cells[0]).replace(/\s*\+$/, "").trim();
    const values = cells.slice(1, periods.length + 1).map(screenerNumber);
    while (values.length < periods.length) values.push(null);
    // "Raw PDF" and other link rows carry no figures.
    if (!label || values.every((v) => v === null)) continue;
    rows.push({ label, values });
  }
  return rows.length > 0 ? { periods, period_ends, rows } : null;
}

function parseTopRatios(html: string): ScreenerPage["top_ratios"] {
  const list = /<ul id="top-ratios">([\s\S]*?)<\/ul>/.exec(html)?.[1] ?? "";
  const byName = new Map<string, number[]>();
  for (const [, li] of list.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)) {
    const name = text(/<span class="name">([\s\S]*?)<\/span>/.exec(li)?.[1] ?? "");
    const numbers = [...li.matchAll(/<span class="number">([\s\S]*?)<\/span>/g)]
      .map((m) => screenerNumber(m[1])).filter((n): n is number => n !== null);
    if (name) byName.set(name, numbers);
  }
  const first = (name: string) => byName.get(name)?.[0] ?? null;
  return {
    market_cap: first("Market Cap"),
    price: first("Current Price"),
    high_52: byName.get("High / Low")?.[0] ?? null,
    low_52: byName.get("High / Low")?.[1] ?? null,
    pe: first("Stock P/E"),
    book_value: first("Book Value"),
    dividend_yield: first("Dividend Yield"),
    roce: first("ROCE"),
    roe: first("ROE"),
    face_value: first("Face Value"),
  };
}

function parseGrowth(html: string): GrowthTable[] {
  return [...html.matchAll(/<table class="ranges-table">([\s\S]*?)<\/table>/g)].map(([, t]) => ({
    title: text(/<th[^>]*>([\s\S]*?)<\/th>/.exec(t)?.[1] ?? ""),
    values: [...t.matchAll(/<tr>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<\/tr>/g)]
      .map(([, p, v]) => ({ period: text(p).replace(/:$/, ""), pct: screenerNumber(v) })),
  })).filter((g) => g.title && g.values.length > 0);
}

function parseShareholding(html: string): HolderSeries[] {
  const quarterly = /<div id="quarterly-shp">([\s\S]*?)<\/table>/.exec(section(html, "shareholding"))?.[1];
  const grid = quarterly ? parseTable(`${quarterly}</table>`) : null;
  if (!grid) return [];
  return grid.rows.flatMap((row) => {
    const category = HOLDERS[row.label];
    if (!category) return []; // "No. of Shareholders" is a count, not a share.
    const points = grid.period_ends
      .map((date, i) => ({ date, pct: row.values[i] }))
      .filter((p): p is { date: string; pct: number } => p.date !== null && p.pct !== null);
    return points.length > 0 ? [{ category, points }] : [];
  });
}

const listItems = (fragment: string) =>
  [...fragment.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((m) => text(m[1])).filter(Boolean);

/** Web links only - these URLs are third-party data. */
const webUrl = (url: string) => (/^https?:\/\//i.test(url) ? decode(url) : null);

function docLinks(block: string): DocLink[] {
  return [...block.matchAll(/<a\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].flatMap(([, href, inner]) => {
    const url = webUrl(href);
    const note = text(/<div[^>]*>([\s\S]*?)<\/div>/.exec(inner)?.[1] ?? "") || null;
    const title = text(inner.replace(/<div[\s\S]*?<\/div>/g, ""));
    return url && title ? [{ title, url, note }] : [];
  });
}

function parseDocuments(html: string): ScreenerPage["documents"] {
  const docs = section(html, "documents");
  const block = (cls: string) => {
    const start = docs.indexOf(`documents ${cls}`);
    if (start === -1) return "";
    const next = docs.indexOf('<div class="documents ', start + 10);
    return docs.slice(start, next === -1 ? undefined : next);
  };
  const concalls = [...block("concalls").matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].flatMap(([, li]) => {
    const period = text(/<div[^>]*>([\s\S]*?)<\/div>/.exec(li)?.[1] ?? "");
    const link = (label: string) => {
      for (const [, a, inner] of li.matchAll(/<a([^>]*)>([\s\S]*?)<\/a>/g)) {
        if (text(inner) !== label) continue;
        const href = /href="([^"]+)"/.exec(a)?.[1];
        return href ? webUrl(href) : null;
      }
      return null;
    };
    const entry = { period, transcript: link("Transcript"), ppt: link("PPT"), recording: link("REC") };
    return period && (entry.transcript || entry.ppt || entry.recording) ? [entry] : [];
  });
  return { annual_reports: docLinks(block("annual-reports")), credit_ratings: docLinks(block("credit-ratings")), concalls };
}

export function parseScreenerPage(html: string): ScreenerPage {
  const statements: Partial<Record<ScreenerKind, Grid>> = {};
  for (const [id, kind] of Object.entries(SECTIONS)) {
    const grid = parseTable(section(html, id));
    if (grid) statements[kind] = grid;
  }
  const analysis = section(html, "analysis");
  const about = /<div class="sub show-more-box about"[^>]*>([\s\S]*?)<\/div>/.exec(html)?.[1];
  const basisNote = text(/<section id="quarters"[\s\S]*?<p class="sub"[^>]*>([\s\S]*?)<\/p>/.exec(html)?.[1] ?? "");
  return {
    name: text(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1] ?? "") || null,
    nse_symbol: /nseindia\.com\/get-quotes\/equity\?symbol=([A-Z0-9&%-]+)/.exec(html)?.[1]?.replace(/%26/g, "&") ?? null,
    bse_code: /bseindia\.com\/stock-share-price\/[^"]*?\/(\d{6})\//.exec(html)?.[1] ?? null,
    basis: /^consolidated/i.test(basisNote) ? "consolidated" : "standalone",
    about: about ? text(about) || null : null,
    top_ratios: parseTopRatios(html),
    statements,
    growth: parseGrowth(html),
    shareholding: parseShareholding(html),
    pros: listItems(/<div class="pros"[^>]*>([\s\S]*?)<\/ul>/.exec(analysis)?.[1] ?? ""),
    cons: listItems(/<div class="cons"[^>]*>([\s\S]*?)<\/ul>/.exec(analysis)?.[1] ?? ""),
    documents: parseDocuments(html),
  };
}

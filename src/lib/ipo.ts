import { supabase } from "@/integrations/supabase/client";

/** A character from an entity's code point; nothing for a code point no character has (String.fromCodePoint would throw). */
const codePoint = (n: number): string => (Number.isInteger(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "");

export type GmpSnapshot = {
  captured_at: string;
  gmp: number;
  est_listing_price: number | null;
  source: string;
};

/** The three sources sync-ipos reconciles. Keep in step with `SourceName` in supabase/functions/_shared/ipo-parse.ts. */
export type IpoSourceName = "ipowatch" | "investorgain" | "chittorgarh";

/** Which source supplied a reconciled field. Absent key = not tracked for that field. */
export type IpoFieldSources = Partial<Record<string, IpoSourceName>>;

export type Ipo = {
  id: string;
  slug: string;
  name: string;
  board: "mainboard" | "sme";
  type: "Mainboard" | "SME";
  status: "upcoming" | "open" | "closed" | "listed";
  price_band_min: number | null;
  price_band_max: number | null;
  price: string;
  lot_size: number | null;
  issue_size_crore: number | null;
  size: string;
  open_date: string | null;
  close_date: string | null;
  date: string;
  allotment_date: string | null;
  listing_date: string | null;
  registrar: string | null;
  rhp_url: string | null;
  drhp_url: string | null;
  subscription_qib: number | null;
  subscription_nii: number | null;
  subscription_retail: number | null;
  listing_price: number | null;
  listing_gain_pct: number | null;
  /** Derived by fetch-ipos from NSE bars when the catalogue has no listing price; null otherwise. */
  listing_day_close?: number | null;
  latest_close?: number | null;
  latest_close_date?: string | null;
  gain_since_issue_pct?: number | null;
  nse_symbol?: string | null;
  source: string;
  source_url: string | null;
  data_as_of: string;
  gmp: number | null;
  est_listing_price: number | null;
  gmp_history: GmpSnapshot[];
  field_sources: IpoFieldSources | null;
  // From the issue's own Chittorgarh page (sync-ipo-details); null until read.
  detail_url: string | null;
  min_investment: number | null;
  min_investment_lots: number | null;
  min_investment_shares: number | null;
  min_investment_category: string | null;
  face_value: number | null;
  issue_type: string | null;
  sale_type: string | null;
  listing_exchanges: string | null;
  fresh_issue_crore: number | null;
  ofs_crore: number | null;
  refund_date: string | null;
  credit_date: string | null;
  lead_managers: string[] | null;
  promoter_holding_pre: number | null;
  promoter_holding_post: number | null;
  details: { sections: IpoPageSection[] } | null;
  details_source: string | null;
  details_fetched_at: string | null;
  // Chittorgarh's subscription page, once bidding opens; null before then.
  subscription_total: number | null;
  subscription_employee: number | null;
  subscription_categories: { category: string; times: number }[] | null;
  subscription_as_of: string | null;
  /** RHP/DRHP, anchor letter, allotment status and company site, from the issue page. */
  documents: IpoDocumentLink[] | null;
  /** Recent coverage from Google News, gathered by the sync. */
  news: IpoNewsItem[] | null;
  news_fetched_at: string | null;
};

export type IpoDocumentLink = { kind: "rhp" | "drhp" | "anchor" | "allotment" | "company"; label: string; url: string };
export type IpoNewsItem = { title: string; source: string; url: string; published_at: string };

/** Only web links are rendered as hrefs - these URLs come from third-party pages. */
export const isWebUrl = (url: string): boolean => /^https?:\/\//i.test(url);

/** One section of the issue page as it was published: tables as rows of cells, text as lines. */
export type IpoPageSection = { title: string; tables: string[][][]; lines: string[] };

type IpoResponse = { success: boolean; ipos?: Ipo[]; error?: string; fetchedAt?: string };

export async function getIpos(slug?: string): Promise<Ipo[]> {
  const { data, error } = await supabase.functions.invoke<IpoResponse>("fetch-ipos", {
    body: slug ? { slug } : {},
  });
  if (error || !data?.success) throw new Error(data?.error || error?.message || "Could not load IPO data");
  return data.ipos ?? [];
}

/** Colour for a signed figure; zero and unknown stay neutral (a ₹0 GMP is not "up"). */
export const signTone = (value: number | null): string =>
  value === null || value === 0 ? "text-muted-foreground" : value > 0 ? "text-secondary" : "text-destructive";

export const formatRupees = (value: number | null, fractionDigits = 0) =>
  value === null ? "—" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: fractionDigits }).format(value);

export const formatDate = (value: string | null) =>
  value ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)) : "Awaited";

/**
 * Lot size is a static fact, not a future event — 84 of 113 IPOs will never
 * carry it because only InvestorGain publishes it. "Not disclosed" says that;
 * "Awaited" would wrongly imply it is still coming.
 */
export const formatLotSize = (value: number | null) => (value === null ? "Not disclosed" : value.toLocaleString("en-IN"));

/** Registrar is likewise a static fact a source either recorded or didn't. */
export const formatRegistrar = (value: string | null) => value ?? "Not disclosed";

/**
 * Paise are kept when there are any: GMP is often the median of two sources
 * (Rs 139.50), and rounding it to Rs 140 beside a percentage computed from
 * 139.5 made the two figures disagree on the same card.
 */
export const formatGmp = (value: number | null) =>
  value === null ? "Not yet quoted" : formatRupees(value, Number.isInteger(value) ? 0 : 2);

export const formatListingGain = (pct: number | null) =>
  pct === null ? null : `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;

type MinInvestmentFields = Pick<Ipo, "min_investment" | "min_investment_lots" | "min_investment_shares" | "min_investment_category">;

/**
 * The smallest application, exactly as the issue page publishes it. Never
 * computed from lot size x price: an SME application must be at least two
 * lots, so that arithmetic would understate an SME minimum by half.
 */
export function formatMinInvestment(ipo: MinInvestmentFields): { amount: string; basis: string | null } | null {
  if (ipo.min_investment === null) return null;
  const lots = ipo.min_investment_lots;
  const shares = ipo.min_investment_shares;
  const parts = [
    lots === null ? null : `${lots} ${lots === 1 ? "lot" : "lots"}`,
    shares === null ? null : `${shares.toLocaleString("en-IN")} shares`,
  ].filter(Boolean);
  return { amount: formatRupees(ipo.min_investment), basis: parts.length > 0 ? parts.join(" · ") : null };
}

/**
 * Whether an issue-page table opens with a header row. Grids of three or more
 * columns do (financials, lot sizes, KPIs); two-column tables are label/value
 * pairs and do not.
 */
/** "1,600", "₹2,86,400", "49.97%", "2.18x", "16.20" - a figure, so right-aligned and kept on one line. */
const SECTION_FIGURE = /^[-+−]?\s*₹?\s*[\d,]+(\.\d+)?\s*(%|x|×|Cr\.?)?$/i;
export const isSectionFigure = (cell: string): boolean => cell === "" || cell === "—" || SECTION_FIGURE.test(cell);

/** Decode, mark a trailing "T" as tentative, and group bare share counts ("1600" -> "1,600"); years are left alone. */
export function tidySectionCell(raw: string): string {
  const cell = decodeEntities(raw).trim().replace(/\s+T$/, " (tentative)");
  if (!/^\d{4,}$/.test(cell)) return cell;
  const n = Number(cell);
  return n >= 1900 && n <= 2100 ? cell : n.toLocaleString("en-IN");
}

export const sectionTableHasHeader = (rows: string[][]): boolean =>
  rows.length > 1 && (rows[0]?.length ?? 0) >= 3;

/**
 * GMP as a percentage of the upper price band - the price an applicant bidding
 * at cut-off pays, and so the base any listing gain is measured from. Absent
 * unless both figures are known and the band is a real price.
 */
export function gmpPercent(ipo: Pick<Ipo, "gmp" | "price_band_max">): number | null {
  if (ipo.gmp === null || ipo.price_band_max === null || ipo.price_band_max <= 0) return null;
  return (ipo.gmp / ipo.price_band_max) * 100;
}

export const formatGmpPercent = (pct: number | null): string | null =>
  pct === null ? null : `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`;

/** A subscription multiple as the market quotes it: "4.71x". */
export const formatSubscription = (times: number | null): string | null =>
  times === null ? null : `${times.toFixed(2)}x`;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", nbsp: " ", quot: '"', apos: "'", lt: "<", gt: ">", minus: "−", ndash: "–", mdash: "—",
  rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", hellip: "…", times: "×", bull: "•", middot: "·", rupee: "₹",
  raquo: "»", laquo: "«", rarr: "→", larr: "←",
};

/**
 * Entities a source left encoded in stored text ("&minus; Anchor Investor").
 * Output is rendered as React text, never HTML, so decoding cannot inject markup.
 */
export function decodeEntities(value: string): string {
  if (!value.includes("&")) return value;
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => {
    if (/^#x/i.test(name)) return codePoint(parseInt(name.slice(2), 16));
    if (name.startsWith("#")) return codePoint(Number(name.slice(1)));
    return NAMED_ENTITIES[name.toLowerCase()] ?? whole;
  });
}

/**
 * The websites IPO data is collected from. None of them is named on the site:
 * a document hosted on one, or a news item one of them published, is left out.
 */
const COLLECTED_FROM = /chittorgarh|ipo ?watch|investorgain/i;

/** Whether a link or a publisher name points at one of the sites IPO data is collected from. */
export const isCollectionSource = (value: string | null | undefined): boolean => !!value && COLLECTED_FROM.test(value);

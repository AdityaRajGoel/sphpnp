// SEBI's public-issue filings, and the IPO pipeline built from them.
//
// Source: sebi.gov.in -> Filings -> Public Issues, read through the listing's
// own pager (POST /sebiweb/ajax/home/getnewslistinfo.jsp, 25 rows a page):
//   smid=10  Draft Offer Documents filed with SEBI  (DRHP, UDRHP, addenda)
//   smid=11  Red Herring Documents filed with ROC   (RHP - about to launch)
// Drafts appear months before an issue opens, so they are the pipeline; a red
// herring filing says the company is about to launch; an entry in our IPO
// catalogue says it has.
//
// Pure: no fetch, no Deno APIs. sync-ipo-pipeline does the I/O.

import { ipoMatchKey } from "./ipo-parse.ts";

/** A character from an entity's code point; nothing for a code point no character has (String.fromCodePoint would throw). */
const codePoint = (n: number): string => (Number.isInteger(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "");

export type FilingCategory = "draft" | "rhp";
export type FilingKind = "drhp" | "udrhp" | "addendum" | "corrigendum" | "rhp" | "prospectus" | "other";

export type SebiFiling = {
  company: string;
  kind: FilingKind;
  category: FilingCategory;
  /** The filing's own words after the company name: "Addendum II to DRHP". */
  detail: string;
  filed_on: string;
  url: string;
  /** Further documents SEBI attaches to the row, e.g. a draft abridged prospectus. */
  extra_links: { label: string; url: string }[];
};

export type PipelineStage = "drhp_filed" | "udrhp_filed" | "rhp_filed" | "launched";

export type PipelineCompany = {
  key: string;
  name: string;
  stage: PipelineStage;
  first_filed_on: string;
  latest_filed_on: string;
  ipo_slug: string | null;
  filings: { kind: FilingKind; detail: string; filed_on: string; url: string; extra_links: { label: string; url: string }[] }[];
};

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

const ENTITIES: Record<string, string> = { amp: "&", nbsp: " ", quot: '"', "#39": "'", apos: "'", ndash: "–", rsquo: "'" };
const decode = (value: string) =>
  value.replace(/&(#\d+|[a-z]+);/gi, (whole, name: string) => {
    if (/^#\d+$/.test(name) && !ENTITIES[name]) return codePoint(Number(name.slice(1)));
    return ENTITIES[name.toLowerCase()] ?? whole;
  });
const clean = (value: string) => decode(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

/** "Sep 04, 2026" -> "2026-09-04". */
function isoDate(value: string): string | null {
  const match = /([A-Za-z]{3})[a-z]*\s+(\d{1,2}),\s*(\d{4})/.exec(value);
  const month = match ? MONTHS[match[1].toLowerCase()] : undefined;
  return match && month ? `${match[3]}-${month}-${match[2].padStart(2, "0")}` : null;
}

function kindOf(detail: string, category: FilingCategory): FilingKind {
  if (/corrigendum/i.test(detail)) return "corrigendum";
  if (/addendum/i.test(detail)) return "addendum";
  if (/\bUDRHP\b/i.test(detail)) return "udrhp";
  if (/\bDRHP\b|draft/i.test(detail)) return "drhp";
  if (/\bRHP\b|red herring/i.test(detail)) return "rhp";
  if (/prospectus/i.test(detail)) return "prospectus";
  if (!detail) return category === "draft" ? "drhp" : "rhp";
  return "other";
}

/**
 * "Company - Filing" into its parts. SEBI separates them with a hyphen or an
 * en dash, spaced inconsistently, and sometimes gives the company alone - in
 * which case the list the row came from says what it is.
 */
export function splitFilingTitle(title: string, category: FilingCategory = "draft"): { company: string; kind: FilingKind; detail: string } {
  const text = clean(title);
  const parts = text.split(/\s+[-–]\s+/);
  const company = (parts.length > 1 ? parts.slice(0, -1).join(" - ") : text).replace(/[\s.,-]+$/, (m) => (m.includes(".") ? "." : "")).trim();
  const detail = parts.length > 1 ? parts[parts.length - 1].replace(/\.$/, "").trim() : "";
  return { company, kind: kindOf(detail, category), detail };
}

const SMALL_WORDS = new Set(["and", "of", "the", "for", "in"]);

/**
 * SEBI files many names in capitals ("ARAGEN LIFE SCIENCES LIMITED"). Those are
 * title-cased for display; words of three letters or fewer stay capitals, as
 * they are usually initialisms ("SS Retail", "M P Steel"). A name that already
 * has lower case is the company's own styling and is left alone.
 */
export function displayCompanyName(name: string): string {
  const spaced = name.replace(/\s+/g, " ").trim();
  if (/[a-z]/.test(spaced)) return spaced;
  return spaced.split(" ").map((word) => {
    const bare = word.replace(/[^A-Za-z]/g, "");
    if (SMALL_WORDS.has(bare.toLowerCase()) && bare.length > 0) return word.toLowerCase();
    if (bare.length <= 3) return word;
    return word.toLowerCase().replace(/[a-z]/, (c) => c.toUpperCase());
  }).join(" ");
}

/** One page of either listing, and the listing's total record count. */
export function parseSebiListing(html: string, category: FilingCategory): { filings: SebiFiling[]; total: number | null } {
  const filings: SebiFiling[] = [];
  for (const [, row] of html.matchAll(/<tr role='row'[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const date = isoDate(/<td>([\s\S]*?)<\/td>/i.exec(row)?.[1] ?? "");
    // The full page quotes href with double quotes, the pager's HTML with single.
    const link = /<a\s+href=(['"])(https:\/\/www\.sebi\.gov\.in\/[^'"]+)\1[^>]*title="([^"]*)"/i.exec(row);
    if (!date || !link) continue;
    // SEBI nests extra documents inside the title attribute as markup.
    const titleMarkup = decode(link[3]);
    const [titleText] = titleMarkup.split(/<br\s*\/?>/i);
    const extra_links = [...titleMarkup.matchAll(/<a\s+href=\s*['"](https:\/\/www\.sebi\.gov\.in\/[^'"]+)['"][^>]*>([\s\S]*?)<\/a>/gi)]
      .map((m) => ({ url: m[1], label: splitFilingTitle(m[2], category).detail || clean(m[2]) }));
    const { company, kind, detail } = splitFilingTitle(titleText, category);
    if (!company) continue;
    filings.push({ company, kind, category, detail, filed_on: date, url: link[2], extra_links });
  }
  const total = /\d+ to \d+ of (\d+) records/.exec(html);
  return { filings, total: total ? Number(total[1]) : null };
}

/** A company silent this long is out of the pipeline: SEBI's observations on a draft lapse after a year. */
export const PIPELINE_WINDOW_DAYS = 548;

/**
 * An RHP is filed about a week before an issue opens. One older than this
 * means the issue has opened (and usually listed) even when it is not in our
 * catalogue, so the company is no longer "about to launch".
 */
const RHP_LAUNCHED_AFTER_DAYS = 30;

/**
 * One entry per company, most recently active first. The stage is the
 * furthest the filings (and our catalogue) show it has come. An IPO in the
 * catalogue is linked only if it opened on or after the company's first
 * filing here - the same name returning years later is a different offering.
 */
export function buildPipeline(
  filings: SebiFiling[],
  ipos: { slug: string; name: string; open_date: string | null }[],
  today: string,
): PipelineCompany[] {
  const daysAgo = (days: number) => new Date(Date.parse(`${today}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10);
  const cutoff = daysAgo(PIPELINE_WINDOW_DAYS);
  const launchedCutoff = daysAgo(RHP_LAUNCHED_AFTER_DAYS);
  const groups = new Map<string, SebiFiling[]>();
  for (const f of filings) {
    const key = ipoMatchKey(f.company);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), f]);
  }

  const companies: PipelineCompany[] = [];
  for (const [key, group] of groups) {
    const sorted = [...group].sort((a, b) => b.filed_on.localeCompare(a.filed_on));
    const latest = sorted[0].filed_on;
    if (latest < cutoff) continue;
    const first = sorted[sorted.length - 1].filed_on;
    // The company's own mixed-case styling where SEBI used it anywhere.
    const name = displayCompanyName(sorted.find((f) => /[a-z]/.test(f.company))?.company ?? sorted[0].company);

    const ipo = ipos.find((i) => ipoMatchKey(i.name) === key && (i.open_date === null || i.open_date >= first));
    const latestRhp = sorted.find((f) => f.category === "rhp")?.filed_on ?? null;
    const stage: PipelineStage = ipo || (latestRhp !== null && latestRhp < launchedCutoff)
      ? "launched"
      : latestRhp !== null
      ? "rhp_filed"
      : group.some((f) => f.kind === "udrhp")
      ? "udrhp_filed"
      : "drhp_filed";

    companies.push({
      key, name, stage, first_filed_on: first, latest_filed_on: latest, ipo_slug: ipo?.slug ?? null,
      filings: sorted.map(({ kind, detail, filed_on, url, extra_links }) => ({ kind, detail, filed_on, url, extra_links })),
    });
  }
  return companies.sort((a, b) => b.latest_filed_on.localeCompare(a.latest_filed_on) || a.name.localeCompare(b.name));
}

// SEBI's enforcement orders and corporate-action filings for one listed stock.
//
// Found with SEBI's own listing search (the same getnewslistinfo.jsp pager the
// IPO pipeline reads, with `search` set to the company's name), one search per
// category:
//   order        Enforcement -> Orders           (sid=2, ssid=9)
//   buyback      Filings -> Buybacks             (sid=3, ssid=22)
//   open_offer   Filings -> Takeovers            (sid=3, ssid=20)
//   rights_issue Filings -> Rights Issues        (sid=3, ssid=16)
//
// The search is broad ("Tata Motors" also finds Tata Motors Finance), so a
// result is kept only if its title names this company. Order titles often
// carry individuals' PANs; SEBI publishes them, this site has no need to.
//
// Pure: no fetch, no Deno APIs. sync-sebi-actions does the I/O.

import { ipoMatchKey } from "./ipo-parse.ts";
import { splitFilingTitle } from "./sebi-filings.ts";

export type SebiActionCategory = "order" | "buyback" | "open_offer" | "rights_issue";
export type SebiAction = { category: SebiActionCategory; kind: string; title: string; filed_on: string; url: string };
export type SebiRow = { filed_on: string; title: string; url: string };

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

const decode = (value: string) =>
  value
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)));

/** Visible text: tags, zero-width characters and runs of whitespace removed. */
const clean = (value: string) =>
  decode(value).replace(/<[^>]+>/g, " ").replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\s+/g, " ").trim();

function isoDate(value: string): string | null {
  const match = /([A-Za-z]{3})[a-z]*\s+(\d{1,2}),\s*(\d{4})/.exec(value);
  const month = match ? MONTHS[match[1].toLowerCase()] : undefined;
  return match && month ? `${match[3]}-${month}-${match[2].padStart(2, "0")}` : null;
}

/** Every row of a SEBI listing or search result. */
export function parseSebiRows(html: string): SebiRow[] {
  const rows: SebiRow[] = [];
  for (const [, row] of html.matchAll(/<tr role='row'[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const filed_on = isoDate(/<td>([\s\S]*?)<\/td>/i.exec(row)?.[1] ?? "");
    const link = /<a\s+href=(['"])(https:\/\/www\.sebi\.gov\.in\/[^'"]+)\1[^>]*title="([^"]*)"/i.exec(row);
    if (!filed_on || !link) continue;
    // Extra documents are nested in the title attribute after a <br>.
    const title = clean(decode(link[3]).split(/<br\s*\/?>/i)[0]);
    if (title) rows.push({ filed_on, title, url: link[2] });
  }
  return rows;
}

/** A PAN - five letters, four digits, a letter - with any "PAN:" label and brackets around it. */
export function redactPan(text: string): string {
  return text
    .replace(/\s*[([]?\s*(?:PAN\s*(?:No\.?)?\s*[:\-]?\s*)?[A-Z]{5}\d{4}[A-Z]\s*[)\]]?/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;])/g, "$1")
    .trim();
}

/** Lower case, "&" as "and", punctuation as spaces - the form both sides are compared in. */
const normalise = (value: string) =>
  ` ${value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim()} `;

const LEGAL_SUFFIX = /\s+(?:limited|ltd\.?)$/i;

/** The company's name as searched: without its legal suffix. */
export function searchName(companyName: string): string {
  return companyName.replace(/\s+/g, " ").trim().replace(LEGAL_SUFFIX, "").trim();
}

/**
 * Whether a title names this company: its name followed directly by Limited or
 * Ltd, allowing the "(India)" or "India" companies often carry in between.
 * "Tata Motors Finance Limited" does not name Tata Motors; a short name like
 * "ITC" only counts as a whole word.
 */
export function titleNamesCompany(title: string, companyName: string): boolean {
  const name = normalise(searchName(companyName)).trim();
  if (!name) return false;
  const haystack = normalise(title);
  return [" limited ", " ltd ", " india limited ", " india ltd "].some((suffix) => haystack.includes(` ${name}${suffix}`));
}

/** What kind of order a title describes. */
export function orderKind(title: string): string {
  const t = title.toLowerCase();
  if (t.startsWith("settlement")) return "Settlement order";
  if (t.startsWith("adjudication")) return "Adjudication order";
  if (t.startsWith("interim")) return "Interim order";
  if (t.startsWith("final order")) return "Final order";
  if (t.startsWith("directions")) return "Directions";
  if (t.startsWith("judgment") || t.startsWith("judgement")) return "Judgment";
  if (t.includes("show cause")) return "Show cause notice";
  return "Order";
}

const CATEGORY_LABEL: Record<Exclude<SebiActionCategory, "order">, string> = {
  buyback: "Buyback",
  open_offer: "Open offer",
  rights_issue: "Rights issue",
};

/**
 * This stock's results from one search. Orders must name the company in their
 * title; a corporate-action filing's title is the company itself (sometimes
 * with the document after a dash), which must be this company.
 */
export function actionsForStock(rows: SebiRow[], category: SebiActionCategory, companyName: string): SebiAction[] {
  const key = ipoMatchKey(companyName);
  const actions: SebiAction[] = [];
  for (const row of rows) {
    if (category === "order") {
      if (!titleNamesCompany(row.title, companyName)) continue;
      actions.push({ category, kind: orderKind(row.title), title: redactPan(row.title), filed_on: row.filed_on, url: row.url });
      continue;
    }
    const { company, detail } = splitFilingTitle(row.title);
    if (!key || ipoMatchKey(company) !== key) continue;
    const label = CATEGORY_LABEL[category];
    actions.push({ category, kind: detail ? `${label} - ${detail}` : label, title: row.title, filed_on: row.filed_on, url: row.url });
  }
  return actions;
}

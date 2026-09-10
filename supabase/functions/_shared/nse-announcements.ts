// NSE's own RSS feeds: corporate actions, financial-results filings and general
// company announcements.
//
// These are primary-source and exchange-published, which is what the nine
// business-press feeds in fetch-news are not. Press RSS carries a journalist's
// summary of what happened and cannot be filtered by company; these carry the
// exchange's record of what a named company filed, which is the only thing that
// can drive a per-ticker announcements surface.
//
// They also need no cookie or session, unlike NSE's JSON APIs - verified
// against the live feeds - which is why they are reachable from the edge
// runtime at all rather than needing the browser runner.
//
// Financial_Results is the interesting one: it publishes DIRECT XBRL URLs. NSE's
// corporates-financial-results JSON endpoint stopped returning filings after
// 31-Dec-2024, which is what froze fundamentals_income, so this feed is a
// possible route to filings that API no longer serves.

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

/** `11-Sep-2026` -> `2026-09-11`. Null on anything else. */
export function parseNseDate(raw: string): string | null {
  const match = raw.trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (!match) return null;
  const month = MONTHS[match[2].toLowerCase()];
  return month ? `${match[3]}-${month}-${match[1].padStart(2, "0")}` : null;
}

/**
 * `10-Sep-2026 03:09:43` -> an ISO instant.
 *
 * NSE stamps its feeds in its own format, not RFC 822, so Date.parse returns
 * NaN and a generic RSS date helper falls back to "now". That is precisely the
 * defect that made three press feeds claim every story was breaking news, so
 * this returns null rather than guessing and lets the caller decide.
 *
 * Treated as UTC deliberately: the feed carries no offset, and inventing IST
 * would shift every timestamp by 5.5 hours on a page that shows relative ages.
 */
export function parseNseDateTime(raw: string): string | null {
  const match = raw.trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return null;
  const month = MONTHS[match[2].toLowerCase()];
  if (!month) return null;
  const day = match[1].padStart(2, "0");
  return `${match[3]}-${month}-${day}T${match[4]}:${match[5]}:${match[6]}.000Z`;
}

/**
 * NSE packs structured data into the description as `LABEL:value |LABEL:value`.
 *
 * Split on the FIRST colon only: a purpose like "DIVIDEND - RS 3 PER SHARE"
 * contains its own punctuation and must survive whole. A lone "-" is NSE's way
 * of writing "no value", and is dropped rather than carried through - left in,
 * it renders as a record date of "-" on the page.
 */
export function parsePipeFields(description: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const part of description.split("|")) {
    const at = part.indexOf(":");
    if (at === -1) continue;
    const key = part.slice(0, at).trim();
    const value = part.slice(at + 1).trim();
    if (key && value && value !== "-") fields[key] = value;
  }
  return fields;
}

const decode = (value: string) =>
  value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

const tag = (item: string, name: string): string => {
  const match = item.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return match ? decode(match[1]) : "";
};

const items = (xml: string): string[] => xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];

export type CorporateAction = {
  company: string;
  purpose: string | null;
  series: string | null;
  faceValue: string | null;
  exDate: string | null;
  recordDate: string | null;
  publishedAt: string | null;
  link: string;
};

export function parseCorporateActions(xml: string): CorporateAction[] {
  return items(xml).flatMap((item) => {
    const title = tag(item, "title");
    if (!title) return [];
    // "Company Name - Ex-Date: 11-Sep-2026". The suffix must come off the name,
    // or nothing can ever be joined to a ticker.
    const split = title.match(/^([\s\S]*?)\s*-\s*Ex-Date:\s*(.+)$/i);
    const company = (split ? split[1] : title).trim();
    const fields = parsePipeFields(tag(item, "description"));
    return [{
      company,
      purpose: fields.PURPOSE ?? null,
      series: fields.SERIES ?? null,
      faceValue: fields["FACE VALUE"] ?? null,
      exDate: split ? parseNseDate(split[2]) : null,
      recordDate: fields["RECORD DATE"] ? parseNseDate(fields["RECORD DATE"]) : null,
      publishedAt: parseNseDateTime(tag(item, "pubDate")),
      link: tag(item, "link"),
    }];
  });
}

export type FinancialResultFiling = {
  company: string;
  xbrlUrl: string;
  periodEnded: string | null;
  period: string | null;
  isConsolidated: boolean | null;
  isAudited: boolean | null;
  publishedAt: string | null;
};

export function parseFinancialResults(xml: string): FinancialResultFiling[] {
  return items(xml).flatMap((item) => {
    const company = tag(item, "title");
    const xbrlUrl = tag(item, "link");
    if (!company || !xbrlUrl) return [];
    const fields = parsePipeFields(tag(item, "description"));
    const consolidated = fields["CONSOLIDATED/NON-CONSOLIDATED"];
    const audited = fields["AUDITED/UNAUDITED"];
    return [{
      company,
      xbrlUrl,
      periodEnded: fields["PERIOD ENDED"] ? parseNseDate(fields["PERIOD ENDED"]) : null,
      period: fields.PERIOD ?? null,
      // Null, not false, when the field is absent: "we were not told" and "the
      // filing is standalone" are different claims about a company's accounts.
      isConsolidated: consolidated ? /^consolidated$/i.test(consolidated) : null,
      isAudited: audited ? /^audited$/i.test(audited) : null,
      publishedAt: parseNseDateTime(tag(item, "pubDate")),
    }];
  });
}

export type Announcement = {
  company: string;
  subject: string | null;
  detail: string;
  attachmentUrl: string;
  publishedAt: string | null;
};

export function parseAnnouncements(xml: string): Announcement[] {
  return items(xml).flatMap((item) => {
    const company = tag(item, "title");
    if (!company) return [];
    const description = tag(item, "description");
    const fields = parsePipeFields(description);
    return [{
      company,
      subject: fields.SUBJECT ?? null,
      // The prose half, before the pipe-delimited fields begin.
      detail: description.split("|")[0].trim(),
      attachmentUrl: tag(item, "link"),
      publishedAt: parseNseDateTime(tag(item, "pubDate")),
    }];
  });
}

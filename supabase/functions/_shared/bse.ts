// A company's announcements filed with BSE, from the exchange's own API
// (api.bseindia.com/BseIndiaAPI/api/AnnSubCategoryGetData), queried by BSE
// scrip code. The code for each tracked stock comes from its screener.in page.
// BSE answers only with its own site as Referer/Origin - see BSE_HEADERS.
//
// Pure apart from the header constant: no fetch. sync-bse-announcements does the I/O.

export const BSE_HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Referer: "https://www.bseindia.com/",
  Origin: "https://www.bseindia.com",
  Accept: "application/json, text/plain, */*",
};

export type BseAnnouncement = {
  news_id: string;
  symbol: string;
  scrip_code: string;
  subject: string;
  summary: string | null;
  category: string | null;
  subcategory: string | null;
  critical: boolean;
  attachment_url: string | null;
  published_at: string | null;
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().replace(/''/g, "'").replace(/\s+/g, " ") : null);

/** yyyymmdd, as the API takes its date range. */
export const bseDay = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");

/** The announcements query for one scrip over [from, to]. */
export function bseAnnouncementsUrl(scripCode: string, from: Date, to: Date): string {
  const q = new URLSearchParams({
    pageno: "1", strCat: "-1", strPrevDate: bseDay(from), strScrip: scripCode,
    strSearch: "P", strToDate: bseDay(to), strType: "C", subcategory: "-1",
  });
  return `https://api.bseindia.com/BseIndiaAPI/api/AnnSubCategoryGetData/w?${q}`;
}

/** BSE's "2026-09-10T19:39:13.183" is India time with no offset. */
export function bseTimestamp(value: unknown): string | null {
  const s = str(value);
  if (!s || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return null;
  const t = Date.parse(`${s.slice(0, 19)}+05:30`);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

/** Announcements from one response, newest first; rows for another scrip are dropped. */
export function parseBseAnnouncements(raw: unknown, symbol: string, scripCode: string): BseAnnouncement[] {
  const rows = isRecord(raw) && Array.isArray(raw.Table) ? raw.Table : [];
  const out: BseAnnouncement[] = [];
  for (const row of rows.filter(isRecord)) {
    const news_id = str(row.NEWSID);
    const subject = str(row.NEWSSUB);
    if (!news_id || !subject || String(row.SCRIP_CD ?? "") !== scripCode) continue;
    const attachment = str(row.ATTACHMENTNAME);
    const summary = str(row.HEADLINE);
    out.push({
      news_id,
      symbol,
      scrip_code: scripCode,
      // Subjects often open with "Company Ltd - 500325 - "; the page already says whose it is.
      subject: subject.replace(/^.*?\s-\s\d{6}\s-\s/, ""),
      summary: summary && summary !== subject ? summary : null,
      category: str(row.CATEGORYNAME),
      subcategory: str(row.SUBCATNAME),
      critical: Number(row.CRITICALNEWS) === 1,
      attachment_url: attachment && /^[\w.-]+\.pdf$/i.test(attachment)
        ? `https://www.bseindia.com/stockinfo/AnnPdfOpen.aspx?Pname=${attachment}`
        : null,
      published_at: bseTimestamp(row.NEWS_DT) ?? bseTimestamp(row.DT_TM),
    });
  }
  return out.sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? ""));
}

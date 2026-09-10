import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  parseNseDateTime,
  parsePipeFields,
  parseCorporateActions,
  parseFinancialResults,
  parseAnnouncements,
} from "../../supabase/functions/_shared/nse-announcements";

/*
 * NSE's own RSS feeds — primary-source, exchange-published filings.
 *
 * These are distinct from the nine general business-press feeds fetch-news
 * already reads. Those carry journalists' summaries and cannot be filtered by
 * company; these are the exchange's own record of what a named company filed,
 * which is the only thing that can power a per-ticker announcements surface.
 *
 * They also need no cookie or session, unlike NSE's JSON APIs — verified
 * against the live feeds, which is why they are reachable from the edge
 * runtime at all.
 *
 * Fixtures are real captures, trimmed to four items each.
 */

const fixture = (name: string) => readFileSync(`src/test/fixtures/nse-rss/${name}.xml`, "utf-8");

describe("parseNseDateTime", () => {
  it("reads NSE's own timestamp format", () => {
    // "10-Sep-2026 03:09:43" is not RFC 822, so Date.parse gives NaN and any
    // generic RSS date helper would silently fall back to "now" — which is
    // exactly the bug that made three press feeds claim every story was
    // breaking news.
    expect(parseNseDateTime("10-Sep-2026 03:09:43")).toBe("2026-09-10T03:09:43.000Z");
  });

  it("returns null for anything it does not recognise, rather than now", () => {
    expect(parseNseDateTime("not a date")).toBeNull();
    expect(parseNseDateTime("")).toBeNull();
    expect(parseNseDateTime("2026-09-10")).toBeNull();
  });
});

describe("parsePipeFields", () => {
  it("splits NSE's pipe-delimited description into labelled fields", () => {
    const fields = parsePipeFields(
      "SERIES:EQ |PURPOSE:DIVIDEND - RS 3 PER SHARE |FACE VALUE:2 |RECORD DATE:11-Sep-2026",
    );

    expect(fields.SERIES).toBe("EQ");
    expect(fields["FACE VALUE"]).toBe("2");
    expect(fields["RECORD DATE"]).toBe("11-Sep-2026");
  });

  it("keeps a value containing its own separator intact", () => {
    // "DIVIDEND - RS 3 PER SHARE" has a dash and spaces; splitting on the
    // first colon only is what keeps it whole.
    const fields = parsePipeFields("PURPOSE:DIVIDEND - RS 3 PER SHARE |SERIES:EQ");
    expect(fields.PURPOSE).toBe("DIVIDEND - RS 3 PER SHARE");
  });

  it("treats a lone dash as absent", () => {
    // NSE writes "-" for a field it has no value for. Carried through literally
    // it would render as a date of "-" on the page.
    const fields = parsePipeFields("BOOK CLOSURE START DATE:- |SERIES:EQ");
    expect(fields["BOOK CLOSURE START DATE"]).toBeUndefined();
    expect(fields.SERIES).toBe("EQ");
  });
});

describe("parseCorporateActions", () => {
  it("reads company, purpose and dates from a real capture", () => {
    const rows = parseCorporateActions(fixture("corporate-action"));

    expect(rows.length).toBeGreaterThan(0);
    const first = rows[0];
    expect(first.company).toBe("Shaily Engineering Plastics Limited");
    expect(first.purpose).toContain("DIVIDEND");
    expect(first.exDate).toBe("2026-09-11");
    expect(first.series).toBe("EQ");
    expect(first.publishedAt).toBeTruthy();
  });

  it("strips the ex-date suffix from the company name", () => {
    // The title is "Company - Ex-Date: 11-Sep-2026"; leaving that on the name
    // would break any join to a ticker.
    const rows = parseCorporateActions(fixture("corporate-action"));
    for (const row of rows) expect(row.company).not.toMatch(/Ex-Date/i);
  });
});

describe("parseFinancialResults", () => {
  it("captures the XBRL link, which is the point of this feed", () => {
    // NSE's corporates-financial-results JSON endpoint stopped returning
    // filings after Dec-2024. This feed still publishes direct XBRL URLs, so it
    // is a possible route to filings the JSON API no longer serves.
    const rows = parseFinancialResults(fixture("financial-results"));

    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].xbrlUrl).toMatch(/\.xml$/);
    expect(rows[0].company).toBe("Asian Hotels (West) Limited");
    expect(rows[0].periodEnded).toBe("2021-03-31");
    expect(rows[0].isConsolidated).toBe(true);
    expect(rows[0].isAudited).toBe(true);
  });
});

describe("parseAnnouncements", () => {
  it("reads company, subject and attachment from a real capture", () => {
    const rows = parseAnnouncements(fixture("announcements"));

    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].company).toBe("Aarnav Fashions Limited");
    expect(rows[0].subject).toBe("Copy of Newspaper Publication");
    expect(rows[0].attachmentUrl).toMatch(/^https?:\/\//);
    expect(rows[0].publishedAt).toBeTruthy();
  });

  it("returns nothing for a feed with no items rather than throwing", () => {
    expect(parseAnnouncements("<rss><channel></channel></rss>")).toEqual([]);
    expect(parseAnnouncements("")).toEqual([]);
  });
});

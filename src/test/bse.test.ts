import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseBseAnnouncements, bseAnnouncementsUrl, bseTimestamp } from "../../supabase/functions/_shared/bse";

/* RELIANCE's (BSE 500325) announcements filed with BSE, captured 2026-09-11. */

const raw = JSON.parse(readFileSync("src/test/fixtures/nse-api/bse-announcements-500325.json", "utf-8"));

describe("parseBseAnnouncements", () => {
  const items = parseBseAnnouncements(raw, "RELIANCE", "500325");

  it("reads each announcement's subject, category, time and PDF", () => {
    expect(items).toHaveLength(17);
    expect(items[0]).toMatchObject({
      symbol: "RELIANCE", scrip_code: "500325",
      subject: "Update On Institutional Investors' Meeting - UBS India Summit 2026",
      category: "Company Update", critical: false,
      attachment_url: "https://www.bseindia.com/stockinfo/AnnPdfOpen.aspx?Pname=3fe1d4fd-73e0-474f-aca5-1062b4062bb3.pdf",
      published_at: "2026-09-10T14:09:13.000Z",
    });
  });

  it("sorts newest first and ignores another scrip's rows", () => {
    expect(items.map((i) => i.published_at)).toEqual([...items.map((i) => i.published_at)].sort().reverse());
    expect(parseBseAnnouncements(raw, "TCS", "532540")).toEqual([]);
  });

  it("drops the 'Company - code -' prefix BSE puts on some subjects", () => {
    const [item] = parseBseAnnouncements({ Table: [{ NEWSID: "x", SCRIP_CD: 590070, NEWSSUB: "Radaan Mediaworks India Ltd - 590070 - Announcement under Regulation 30 (LODR)-Newspaper Publication" }] }, "RADAAN", "590070");
    expect(item.subject).toBe("Announcement under Regulation 30 (LODR)-Newspaper Publication");
  });
});

describe("bse request helpers", () => {
  it("builds the per-scrip query and reads BSE's India-time stamps", () => {
    expect(bseAnnouncementsUrl("500325", new Date("2026-08-12T00:00:00Z"), new Date("2026-09-11T00:00:00Z")))
      .toBe("https://api.bseindia.com/BseIndiaAPI/api/AnnSubCategoryGetData/w?pageno=1&strCat=-1&strPrevDate=20260812&strScrip=500325&strSearch=P&strToDate=20260911&strType=C&subcategory=-1");
    expect(bseTimestamp("2026-09-10T19:39:13.183")).toBe("2026-09-10T14:09:13.000Z");
  });
});

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  parseSebiListing,
  splitFilingTitle,
  displayCompanyName,
  buildPipeline,
  type SebiFiling,
} from "../../supabase/functions/_shared/sebi-filings";

/*
 * SEBI's public-issue filings, captured 2026-09-11: the first page of "Draft
 * Offer Documents filed with SEBI" and of "Red Herring Documents filed with
 * ROC". Drafts appear months before an issue opens, which is what makes an IPO
 * pipeline possible; the red herring list says a company is about to launch.
 */

const page = (name: string) => readFileSync(`src/test/fixtures/sebi/${name}.html`, "utf-8");

describe("splitFilingTitle", () => {
  it("separates the company from the filing, whatever dash SEBI used", () => {
    expect(splitFilingTitle("Mahanadi Coalfields Ltd. - DRHP")).toEqual({ company: "Mahanadi Coalfields Ltd.", kind: "drhp", detail: "DRHP" });
    expect(splitFilingTitle("Rentomojo Limited –  Addendum to RHP")).toEqual({ company: "Rentomojo Limited", kind: "addendum", detail: "Addendum to RHP" });
    expect(splitFilingTitle("ArMee Infotech Limited -  Addendum II to DRHP").kind).toBe("addendum");
  });

  it("tells the filing types apart", () => {
    expect(splitFilingTitle("Torrent Gas Limited - UDRHP-I").kind).toBe("udrhp");
    expect(splitFilingTitle("Incred Holdings Limited - Corrigendum to UDRHP").kind).toBe("corrigendum");
    expect(splitFilingTitle("T.C. Terrytex Limited - Addendum-cum-Corrigendum to DRHP").kind).toBe("corrigendum");
    expect(splitFilingTitle("HERO MOTORS LIMITED - RHP").kind).toBe("rhp");
  });

  it("keeps a title with no filing type as the company, typed by its list", () => {
    expect(splitFilingTitle("India Exposition Mart Limited", "draft")).toEqual({ company: "India Exposition Mart Limited", kind: "drhp", detail: "" });
  });
});

describe("displayCompanyName", () => {
  it("title-cases SEBI's all-capitals names but keeps short initialisms", () => {
    expect(displayCompanyName("ARAGEN LIFE SCIENCES LIMITED")).toBe("Aragen Life Sciences Limited");
    expect(displayCompanyName("M P STEEL (INDIA) LIMITED")).toBe("M P Steel (India) Limited");
    expect(displayCompanyName("GEMINI EDIBLES & FATS INDIA LIMITED")).toBe("Gemini Edibles & Fats India Limited");
    expect(displayCompanyName("SS RETAIL LIMITED")).toBe("SS Retail Limited");
  });

  it("leaves a name that already has lower case alone, apart from spacing", () => {
    expect(displayCompanyName("Manika Plastech Limited ")).toBe("Manika Plastech Limited");
  });
});

describe("parseSebiListing", () => {
  it("reads every filing on a page with its date, link and any extra document", () => {
    const { filings, total } = parseSebiListing(page("drafts-page-1"), "draft");
    expect(total).toBe(2200);
    expect(filings).toHaveLength(25);
    const mahanadi = filings.find((f) => f.company.startsWith("Mahanadi"))!;
    expect(mahanadi).toMatchObject({
      company: "Mahanadi Coalfields Ltd.",
      kind: "drhp",
      category: "draft",
      filed_on: "2026-09-04",
      url: "https://www.sebi.gov.in/filings/public-issues/sep-2026/mahanadi-coalfields-ltd-drhp_104290.html",
    });
    expect(mahanadi.extra_links).toEqual([{
      label: "Draft Abridged Prospectus",
      url: "https://www.sebi.gov.in/sebi_data/commondocs/sep-2026/Mahanadi%20Coalfields%20Limited%20_Draft%20Abridged%20Prospectus_p.pdf",
    }]);
  });

  it("reads the red herring list the same way", () => {
    const { filings } = parseSebiListing(page("rhp-page-1"), "rhp");
    expect(filings.find((f) => f.company === "LCC PROJECTS LIMITED")).toMatchObject({ kind: "rhp", category: "rhp" });
  });
});

const filing = (over: Partial<SebiFiling>): SebiFiling => ({
  company: "Acme Limited", kind: "drhp", category: "draft", detail: "DRHP", filed_on: "2026-05-01",
  url: `https://www.sebi.gov.in/filings/public-issues/${Math.random()}.html`, extra_links: [], ...over,
});

describe("buildPipeline", () => {
  const today = "2026-09-11";

  it("gathers a company's filings and moves it along as they arrive", () => {
    const pipeline = buildPipeline([
      filing({ company: "TORRENT GAS LIMITED", kind: "drhp", filed_on: "2026-03-02" }),
      filing({ company: "Torrent Gas Limited", kind: "udrhp", detail: "UDRHP-I", filed_on: "2026-09-09" }),
      filing({ company: "Mahanadi Coalfields Ltd.", kind: "drhp", filed_on: "2026-09-04" }),
    ], [], today);
    const torrent = pipeline.find((c) => c.name === "Torrent Gas Limited")!;
    expect(torrent).toMatchObject({ stage: "udrhp_filed", first_filed_on: "2026-03-02", latest_filed_on: "2026-09-09", ipo_slug: null });
    expect(torrent.filings.map((f) => f.filed_on)).toEqual(["2026-09-09", "2026-03-02"]);
    expect(pipeline.find((c) => c.name.startsWith("Mahanadi"))!.stage).toBe("drhp_filed");
  });

  it("marks a company whose red herring prospectus is filed as about to launch", () => {
    const [c] = buildPipeline([
      filing({ company: "Hero Motors Limited", kind: "drhp", filed_on: "2026-04-01" }),
      filing({ company: "HERO MOTORS LIMITED", kind: "rhp", category: "rhp", filed_on: "2026-09-10" }),
    ], [], today);
    expect(c.stage).toBe("rhp_filed");
  });

  it("treats a red herring filing older than a month as a launched issue", () => {
    // An RHP is filed about a week before an issue opens. One from months ago
    // means the issue opened long since - it just predates our catalogue - and
    // "about to launch" would be false.
    const [c] = buildPipeline([filing({ company: "Old Issue Limited", kind: "rhp", category: "rhp", filed_on: "2025-11-20" })], [], today);
    expect(c).toMatchObject({ stage: "launched", ipo_slug: null });
  });

  it("links a company to its IPO page once the issue is in the catalogue", () => {
    const [c] = buildPipeline(
      [filing({ company: "LCC PROJECTS LIMITED", kind: "rhp", category: "rhp", filed_on: "2026-09-01" })],
      [{ slug: "lcc-projects", name: "LCC Projects", open_date: "2026-09-09" }],
      today,
    );
    expect(c).toMatchObject({ stage: "launched", ipo_slug: "lcc-projects" });
  });

  it("does not link an old IPO of the same name to a new filing", () => {
    const [c] = buildPipeline(
      [filing({ company: "Acme Limited", filed_on: "2026-08-01" })],
      [{ slug: "acme", name: "Acme", open_date: "2024-01-10" }],
      today,
    );
    expect(c.ipo_slug).toBeNull();
  });

  it("drops a company whose last filing is older than the pipeline window", () => {
    // SEBI's observations on a draft lapse a year after they are issued; a
    // company silent for 18 months is not in the pipeline any more.
    expect(buildPipeline([filing({ filed_on: "2024-12-01" })], [], today)).toEqual([]);
  });

  it("lists the most recently active companies first", () => {
    const pipeline = buildPipeline([
      filing({ company: "Older Co Limited", filed_on: "2026-06-01" }),
      filing({ company: "Newer Co Limited", filed_on: "2026-09-01" }),
    ], [], today);
    expect(pipeline.map((c) => c.name)).toEqual(["Newer Co Limited", "Older Co Limited"]);
  });
});

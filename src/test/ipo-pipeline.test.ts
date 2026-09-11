import { describe, it, expect, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { filterPipeline, pipelineCounts, isSebiUrl, type PipelineCompany } from "@/lib/ipo-pipeline";

const company = (over: Partial<PipelineCompany>): PipelineCompany => ({
  key: "acme", name: "Acme Limited", stage: "drhp_filed", first_filed_on: "2026-05-01",
  latest_filed_on: "2026-05-01", ipo_slug: null, filings: [], ...over,
});

const companies = [
  company({ key: "mahanadi", name: "Mahanadi Coalfields Ltd.", stage: "drhp_filed" }),
  company({ key: "torrent", name: "Torrent Gas Limited", stage: "udrhp_filed" }),
  company({ key: "hero", name: "Hero Motors Limited", stage: "rhp_filed" }),
  company({ key: "lcc", name: "LCC Projects Limited", stage: "launched", ipo_slug: "lcc-projects" }),
];

describe("filterPipeline", () => {
  it("opens on companies still on their way to market", () => {
    expect(filterPipeline(companies, "pipeline", "").map((c) => c.key)).toEqual(["mahanadi", "torrent", "hero"]);
  });

  it("shows launched issues on their own", () => {
    expect(filterPipeline(companies, "launched", "").map((c) => c.key)).toEqual(["lcc"]);
  });

  it("searches names case-insensitively within the view", () => {
    expect(filterPipeline(companies, "all", "torrent").map((c) => c.key)).toEqual(["torrent"]);
    expect(filterPipeline(companies, "launched", "torrent")).toEqual([]);
  });
});

describe("pipelineCounts", () => {
  it("counts each view", () => {
    expect(pipelineCounts(companies)).toEqual({ pipeline: 3, launched: 1, all: 4 });
  });
});

describe("isSebiUrl", () => {
  it("renders only SEBI's own links", () => {
    expect(isSebiUrl("https://www.sebi.gov.in/filings/public-issues/sep-2026/x_1.html")).toBe(true);
    expect(isSebiUrl("javascript:alert(1)")).toBe(false);
    expect(isSebiUrl("https://evil.example/sebi.gov.in")).toBe(false);
  });
});

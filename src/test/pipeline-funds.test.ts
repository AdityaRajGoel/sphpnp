import { describe, it, expect, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { pipelineStats } from "@/components/ipo/PipelineOverview";
import { trailingCagr } from "@/lib/mutual-funds";
import type { PipelineCompany } from "@/lib/ipo-pipeline";

const company = (over: Partial<PipelineCompany>): PipelineCompany => ({
  key: over.name ?? "x", name: "X", stage: "drhp_filed", first_filed_on: "2026-01-10", latest_filed_on: "2026-01-10", ipo_slug: null, filings: [], ...over,
});

describe("pipelineStats", () => {
  const companies = [
    company({ name: "A", stage: "drhp_filed", first_filed_on: "2026-09-02", filings: [{ kind: "drhp", detail: "", filed_on: "2026-09-02", url: "", extra_links: [] }] }),
    company({ name: "B", stage: "drhp_filed", first_filed_on: "2026-08-15", filings: [{ kind: "drhp", detail: "", filed_on: "2026-08-15", url: "", extra_links: [] }] }),
    company({
      name: "C", stage: "launched", first_filed_on: "2026-01-01", latest_filed_on: "2026-07-01",
      filings: [{ kind: "rhp", detail: "", filed_on: "2026-07-01", url: "", extra_links: [] }, { kind: "drhp", detail: "", filed_on: "2026-01-01", url: "", extra_links: [] }],
    }),
    company({ name: "Old", stage: "rhp_filed", filings: [{ kind: "rhp", detail: "", filed_on: "2024-05-01", url: "", extra_links: [] }] }),
  ];
  const s = pipelineStats(companies, "2026-09-14");

  it("counts companies at each stage", () => {
    expect(s.byStage).toEqual({ drhp_filed: 2, udrhp_filed: 0, rhp_filed: 1, launched: 1 });
  });

  it("buckets filings into the last twelve months, oldest first, ignoring older filings", () => {
    expect(s.monthly).toHaveLength(12);
    expect(s.monthly[0].month).toBe("2025-10");
    expect(s.monthly[11]).toMatchObject({ month: "2026-09", count: 1 });
    expect(s.monthly.reduce((sum, m) => sum + m.count, 0)).toBe(4);
  });

  it("lists newest drafts first and measures first draft to launch", () => {
    expect(s.recentDrafts.map((c) => c.name)).toEqual(["A", "B"]);
    expect(s.medianMonthsToLaunch).toBeCloseTo(5.95, 1);
  });
});

describe("trailingCagr", () => {
  const navs = [{ date: "2023-09-11", nav: 100 }, { date: "2025-09-11", nav: 110 }, { date: "2026-09-11", nav: 121 }];

  it("annualises from the NAV nearest the start of the window", () => {
    expect(trailingCagr(navs, 1)).toBeCloseTo(10, 6);
    expect(trailingCagr(navs, 3)).toBeCloseTo((Math.pow(1.21, 1 / 3) - 1) * 100, 6);
  });

  it("refuses a window longer than the history", () => {
    expect(trailingCagr(navs, 5)).toBeNull();
  });
});

import { supabase } from "@/integrations/supabase/client";

/**
 * The IPO pipeline: companies that have filed offer documents with SEBI, one
 * row each, rebuilt daily by sync-ipo-pipeline from SEBI's filings lists.
 */
export type PipelineStage = "drhp_filed" | "udrhp_filed" | "rhp_filed" | "launched";

export type PipelineFiling = {
  kind: "drhp" | "udrhp" | "addendum" | "corrigendum" | "rhp" | "prospectus" | "other";
  detail: string;
  filed_on: string;
  url: string;
  extra_links: { label: string; url: string }[];
};

export type PipelineCompany = {
  key: string;
  name: string;
  stage: PipelineStage;
  first_filed_on: string;
  latest_filed_on: string;
  ipo_slug: string | null;
  filings: PipelineFiling[];
};

export const STAGE_LABEL: Record<PipelineStage, string> = {
  drhp_filed: "DRHP filed",
  udrhp_filed: "Updated DRHP filed",
  rhp_filed: "RHP filed - opening soon",
  launched: "Launched",
};

/** What a filing is, in words: SEBI's own detail where it gave one. */
export const FILING_LABEL: Record<PipelineFiling["kind"], string> = {
  drhp: "Draft red herring prospectus (DRHP)",
  udrhp: "Updated DRHP",
  addendum: "Addendum",
  corrigendum: "Corrigendum",
  rhp: "Red herring prospectus (RHP)",
  prospectus: "Prospectus",
  other: "Filing",
};

export type PipelineView = "pipeline" | "launched" | "all";

/** Companies still on their way to market - the view the page opens on. */
const IN_PIPELINE: ReadonlySet<PipelineStage> = new Set(["drhp_filed", "udrhp_filed", "rhp_filed"]);

export function filterPipeline(companies: PipelineCompany[], view: PipelineView, query: string): PipelineCompany[] {
  const q = query.trim().toLowerCase();
  return companies.filter((c) => {
    if (view === "pipeline" && !IN_PIPELINE.has(c.stage)) return false;
    if (view === "launched" && c.stage !== "launched") return false;
    return q === "" || c.name.toLowerCase().includes(q);
  });
}

export function pipelineCounts(companies: PipelineCompany[]): Record<PipelineView, number> {
  const inPipeline = companies.filter((c) => IN_PIPELINE.has(c.stage)).length;
  return { pipeline: inPipeline, launched: companies.length - inPipeline, all: companies.length };
}

/** Only web links are rendered - these URLs come from SEBI's listing. */
export const isSebiUrl = (url: string) => /^https:\/\/www\.sebi\.gov\.in\//.test(url);

export async function getPipeline(): Promise<PipelineCompany[]> {
  const { data, error } = await (supabase.from("ipo_pipeline" as never) as ReturnType<typeof supabase.from>)
    .select("key,name,stage,first_filed_on,latest_filed_on,ipo_slug,filings")
    .order("latest_filed_on", { ascending: false })
    .limit(1000);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as PipelineCompany[];
}

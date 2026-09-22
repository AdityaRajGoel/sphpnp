import { supabase } from "@/integrations/supabase/client";
import type { ContractOption } from "../../supabase/functions/_shared/span-margin";

export type { ContractOption };
export type SpanResult = { span: number; exposure: number; netPremium: number; total: number };
export type SpanLeg = { contract: ContractOption; lots: number; side: "buy" | "sell" };

/** Contracts matching every word of the query ("RELIANCE 27OCT CE"), via the span-margin function. */
export async function searchContracts(query: string): Promise<ContractOption[]> {
  const { data, error } = await supabase.functions.invoke("span-margin", { body: { action: "search", query } });
  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error(data?.error ?? "Search failed");
  return data.contracts as ContractOption[];
}

/** Exact SPAN + exposure for the whole portfolio, so hedges and spreads get their offset. */
export async function calculateMargin(legs: SpanLeg[]): Promise<SpanResult> {
  const positions = legs.map((l) => ({
    exchange: l.contract.exchange,
    id: l.contract.id,
    quantity: (l.side === "sell" ? -1 : 1) * l.lots * l.contract.lotSize,
  }));
  const { data, error } = await supabase.functions.invoke("span-margin", { body: { action: "calculate", positions } });
  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error(data?.error ?? "Margin calculation failed");
  return { span: data.span, exposure: data.exposure, netPremium: data.netPremium, total: data.total };
}

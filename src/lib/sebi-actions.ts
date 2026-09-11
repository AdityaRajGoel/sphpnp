import { supabase } from "@/integrations/supabase/client";

/** One SEBI order or corporate-action filing that names a stock (sebi_actions). */
export type SebiAction = {
  category: "order" | "buyback" | "open_offer" | "rights_issue";
  kind: string;
  title: string;
  filed_on: string;
  url: string;
};

/** Corporate actions first-class; regulatory orders are listed separately. */
export function splitSebiActions(actions: SebiAction[]): { corporate: SebiAction[]; orders: SebiAction[] } {
  const byDate = [...actions].sort((a, b) => b.filed_on.localeCompare(a.filed_on));
  return {
    corporate: byDate.filter((a) => a.category !== "order"),
    orders: byDate.filter((a) => a.category === "order"),
  };
}

/** Only SEBI's own links are rendered. */
export const isSebiLink = (url: string) => /^https:\/\/www\.sebi\.gov\.in\//.test(url);

export async function getSebiActions(symbol: string): Promise<SebiAction[]> {
  const { data, error } = await (supabase.from("sebi_actions" as never) as ReturnType<typeof supabase.from>)
    .select("category,kind,title,filed_on,url")
    .eq("symbol", symbol.toUpperCase())
    .order("filed_on", { ascending: false })
    .limit(60);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as SebiAction[];
}

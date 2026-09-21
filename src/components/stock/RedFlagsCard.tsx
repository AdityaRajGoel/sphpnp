import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { fetchRedFlagInputs, redFlags } from "../../../supabase/functions/_shared/red-flags";

/** Warning signs from exchange filings: pledges, promoter selling, surveillance, weak scores, critical filings. */
export default function RedFlagsCard({ symbol }: { symbol: string }) {
  const { data: flags, isLoading } = useQuery({
    queryKey: ["red-flags", symbol],
    queryFn: async () => redFlags(await fetchRedFlagInputs(supabase, symbol)),
    staleTime: 30 * 60_000,
  });
  if (isLoading || !flags) return null;

  if (flags.length === 0) {
    return (
      <p className="mt-6 flex items-center gap-2 rounded-lg border border-secondary/30 bg-secondary/5 px-4 py-3 text-sm">
        <ShieldCheck className="h-4 w-4 shrink-0 text-secondary" aria-hidden="true" />
        No red flags in exchange filings: no rising pledge, promoter selling, surveillance or critical filing on record.
      </p>
    );
  }

  return (
    <Card className="mt-6 border-destructive/30 p-5" aria-labelledby="red-flags-heading">
      <h2 id="red-flags-heading" className="flex items-center gap-2 font-heading text-lg font-bold">
        <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden="true" />
        {flags.length} red flag{flags.length === 1 ? "" : "s"} to read up on
      </h2>
      <ul className="mt-3 divide-y divide-border/70">
        {flags.map((f) => (
          <li key={f.id} className="flex items-start gap-3 py-2.5">
            <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${f.severity === "high" ? "bg-destructive text-destructive-foreground" : "bg-brand-orange/15 text-brand-orange"}`}>
              {f.severity}
            </span>
            <div className="min-w-0">
              <p className="font-semibold">{f.title}</p>
              <p className="text-sm text-muted-foreground">{f.detail}{f.date ? ` · ${new Date(f.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : ""}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">From NSE and BSE filings. A flag is a reason to read the filing, not a rating.</p>
    </Card>
  );
}

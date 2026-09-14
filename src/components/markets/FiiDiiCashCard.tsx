import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import AnimatedNumber from "@/components/ui/animated-number";
import LiveIndicator from "@/components/ui/live-indicator";
import { supabase } from "@/integrations/supabase/client";
import type { FiiDiiRow } from "../../../supabase/functions/_shared/fii-dii";

async function loadFiiDii(): Promise<{ rows: FiiDiiRow[]; fetched_at: string }> {
  const { data, error } = await supabase.functions.invoke("fetch-fii-dii", { body: {} });
  if (error || !data?.success) throw new Error(data?.error ?? error?.message ?? "FII/DII activity unavailable");
  return data;
}

const crore = (v: number) => `₹${Math.abs(v).toLocaleString("en-IN", { maximumFractionDigits: 0 })} Cr`;

/**
 * The day's provisional FII and DII cash-market buying and selling. Renders
 * nothing when the feed is unreachable, rather than a card of dashes.
 */
export default function FiiDiiCashCard() {
  const { data } = useQuery({ queryKey: ["fii-dii-cash"], queryFn: loadFiiDii, staleTime: 20 * 60_000, retry: false });
  if (!data || data.rows.length === 0) return null;
  const scale = Math.max(...data.rows.map((r) => Math.max(r.buy_cr, r.sell_cr)));
  const date = new Date(`${data.rows[0].date}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold">FII &amp; DII cash market</h3>
        <span className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">Provisional, {date} · NSE, BSE and MSEI combined <LiveIndicator updatedAt={data.fetched_at} staleAfterMinutes={60} /></span>
      </div>
      <div className="mt-4 grid gap-5 sm:grid-cols-2">
        {data.rows.map((r) => (
          <div key={r.category}>
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium">{r.category === "DII" ? "Domestic institutions" : "Foreign institutions"}</span>
              <AnimatedNumber value={r.net_cr} format={(v) => `${v >= 0 ? "+" : "−"}${crore(v)}`} className={`text-xl font-bold ${r.net_cr >= 0 ? "text-secondary" : "text-destructive"}`} />
            </div>
            <div className="mt-2 space-y-1 text-xs">
              {([["Bought", r.buy_cr, "bg-secondary/70"], ["Sold", r.sell_cr, "bg-destructive/70"]] as const).map(([label, value, bar]) => (
                <div key={label} className="grid grid-cols-[3.5rem_1fr_6rem] items-center gap-2">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="h-2 rounded-full bg-muted overflow-hidden" aria-hidden="true"><span className={`block h-full ${bar}`} style={{ width: `${(value / scale) * 100}%` }} /></span>
                  <span className="text-right tabular-nums">{crore(value)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

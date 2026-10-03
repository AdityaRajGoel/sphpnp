import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, SectionHeading } from "@/components/markets/chart-kit";
import { contractMonth, mcxBoard, mcxContracts, mcxName, mcxUnit, type McxQuote } from "@/lib/mcx-data";
import { shortDate } from "@/lib/market-data";

const rupees = (v: number | null) => (v === null ? "—" : `₹${v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const pct = (v: number | null) => (v === null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(2)}%`);
const tone = (v: number | null) => (v === null || v === 0 ? "text-muted-foreground" : v > 0 ? "text-secondary" : "text-destructive");
const count = (v: number) => v.toLocaleString("en-IN");

/**
 * Every MCX commodity's most-held futures contract on its latest trading day,
 * from MCX's own market watch, most traded first; choose one to see all of its
 * contracts by expiry (the term structure).
 */
export default function McxBoard() {
  const board = useQuery({ queryKey: ["mcx-board"], queryFn: mcxBoard, staleTime: 5 * 60_000, refetchInterval: 5 * 60_000 });
  const [picked, setPicked] = useState<string | null>(null);
  const rows = board.data ?? [];
  const selected = rows.find((r) => r.symbol === (picked ?? rows[0]?.symbol));
  const contracts = useQuery({
    queryKey: ["mcx-contracts", selected?.symbol, selected?.trade_date],
    queryFn: () => mcxContracts(selected!.symbol, selected!.trade_date),
    enabled: Boolean(selected),
    staleTime: 5 * 60_000,
  });
  const latest = rows.reduce((max, r) => (r.ltt > max ? r.ltt : max), "");

  return (
    <section aria-labelledby="mcx-board" className="mt-10">
      <SectionHeading
        id="mcx-board"
        title="MCX futures board"
        subtitle={latest ? `Each commodity's most-held contract, from MCX's market watch. Last trade ${new Date(latest).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })} IST.` : "Each commodity's most-held contract, from MCX's market watch."}
      />
      {board.isLoading ? <Skeleton className="mt-4 h-96 w-full" /> : rows.length === 0 ? (
        <div className="mt-4"><EmptyState text="MCX quotes are not available right now." /></div>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_22rem]">
          <Card className="min-w-0 overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2.5 text-left font-medium">Commodity</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Price</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Change</th>
                  <th scope="col" className="hidden px-4 py-2.5 text-right font-medium md:table-cell">Day range</th>
                  <th scope="col" className="hidden px-4 py-2.5 text-right font-medium sm:table-cell">Open interest</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const active = r.symbol === selected?.symbol;
                  return (
                    <tr key={r.symbol} className={`border-t transition-colors ${active ? "bg-secondary/[0.06]" : "hover:bg-muted/40"}`}>
                      <th scope="row" className="px-4 py-2.5 text-left font-normal">
                        <button type="button" onClick={() => setPicked(r.symbol)} aria-pressed={active} className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary rounded-sm">
                          <span className="block font-medium">{mcxName(r.symbol)}</span>
                          <span className="block text-[11px] text-muted-foreground">{contractMonth(r.expiry)} · {mcxUnit(r.unit) || r.symbol}</span>
                        </button>
                      </th>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold tabular-nums">{rupees(r.close)}</td>
                      <td className={`whitespace-nowrap px-4 py-2.5 text-right tabular-nums ${tone(r.change_pct)}`}>{pct(r.change_pct)}</td>
                      <td className="hidden whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-muted-foreground md:table-cell">{r.low && r.high ? `${rupees(r.low)} – ${rupees(r.high)}` : "—"}</td>
                      <td className="hidden whitespace-nowrap px-4 py-2.5 text-right tabular-nums sm:table-cell">{count(r.oi)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>

          {selected && <ContractsPanel quote={selected} contracts={contracts.data} loading={contracts.isLoading} />}
        </div>
      )}
    </section>
  );
}

function ContractsPanel({ quote, contracts, loading }: { quote: McxQuote; contracts: McxQuote[] | undefined; loading: boolean }) {
  const maxOi = Math.max(1, ...(contracts ?? []).map((c) => c.oi));
  return (
    <Card className="self-start p-5 lg:sticky lg:top-24">
      <h3 className="font-semibold">{mcxName(quote.symbol)}: every contract</h3>
      <p className="mt-1 text-xs text-muted-foreground">{shortDate(quote.trade_date)}, {mcxUnit(quote.unit) || "per MCX unit"}. Bars show open interest.</p>
      {loading ? <Skeleton className="mt-4 h-40 w-full" /> : (
        <ol className="mt-4 space-y-3">
          {(contracts ?? []).map((c) => (
            <li key={c.expiry}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className={c.expiry === quote.expiry ? "font-semibold" : ""}>{contractMonth(c.expiry)}</span>
                <span className="tabular-nums"><span className="font-semibold">{rupees(c.close)}</span> <span className={`text-xs ${tone(c.change_pct)}`}>{pct(c.change_pct)}</span></span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden><span className="block h-full rounded-full bg-secondary/60" style={{ width: `${(c.oi / maxOi) * 100}%` }} /></span>
                <span className="w-20 text-right text-[11px] tabular-nums text-muted-foreground">{count(c.oi)} OI</span>
              </div>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-4 text-xs text-muted-foreground">Later contracts usually price above the near one when carrying costs dominate, and below it when supply is tight now.</p>
    </Card>
  );
}

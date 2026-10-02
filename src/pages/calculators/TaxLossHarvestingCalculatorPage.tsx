import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import CalculatorShell from "@/components/calculators/CalculatorShell";
import TaxRulesUsed from "@/components/calculators/TaxRulesUsed";
import { Headline, NumberField, Rows, inr, num } from "@/components/calculators/fields";
import { useScreenerUniverse } from "@/hooks/useScreenerUniverse";
import { loadSavedHoldings } from "@/lib/portfolio-csv";
import { harvest } from "@/lib/tax-harvest";
import { TAX_RULES, TAX_YEAR_LABEL, pctLabel } from "@/lib/tax-rules";

const E = TAX_RULES.equity;

/** One editable row. Prices stay strings so a half-typed field is never overwritten. */
type Row = { id: number; symbol: string; qty: string; avg: string; price: string; longTerm: boolean };

const blankRow = (id: number): Row => ({ id, symbol: "", qty: "", avg: "", price: "", longTerm: false });
const cell = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm tabular-nums";

export default function TaxLossHarvestingCalculatorPage() {
  const universe = useScreenerUniverse();
  const [stcg, setStcg] = useState("100000");
  const [ltcg, setLtcg] = useState("250000");
  // Seeded from the holdings saved on /portfolio, which never leave this browser.
  const [rows, setRows] = useState<Row[]>(() => {
    const saved = loadSavedHoldings().filter((h) => h.avg !== null);
    return saved.length ? saved.map((h, i) => ({ id: i, symbol: h.symbol, qty: String(h.qty), avg: String(h.avg), price: "", longTerm: false })) : [blankRow(0)];
  });
  const fromPortfolio = rows.some((r) => r.symbol);

  // A blank price falls back to the stock's last tracked price.
  const livePrice = (symbol: string) => universe.data?.get(symbol.toUpperCase())?.quote?.price ?? null;
  const positions = rows.flatMap((r) => {
    const price = r.price.trim() ? num(r.price) : livePrice(r.symbol);
    const qty = num(r.qty), avg = num(r.avg);
    return r.symbol && qty > 0 && avg > 0 && price !== null && price > 0 ? [{ symbol: r.symbol.toUpperCase(), qty, avg, price, longTerm: r.longTerm }] : [];
  });
  const result = harvest({ stcg: num(stcg) || 0, ltcg: num(ltcg) || 0, positions });

  const update = (id: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  return (
    <CalculatorShell
      path="/tax-loss-harvesting-calculator"
      name="Tax-Loss Harvesting Calculator"
      seoTitle="Tax-Loss Harvesting Calculator India: Save Capital Gains Tax"
      description={`See how much capital-gains tax booking your losing stocks could save in ${TAX_YEAR_LABEL}: short- and long-term set-off, the ₹1.25 lakh exemption and carry-forward.`}
      intro={`Selling shares that are below cost turns a paper loss into a capital loss, which reduces the tax on gains you have already booked this year. Enter those gains and your holdings; ${TAX_YEAR_LABEL} rules.`}
      notes={
        <>
          An estimate, not tax advice. Surcharge, brokerage, STT and other selling costs are left out. Buying the same shares back resets their cost and restarts the 12-month holding period; speak to your tax adviser before acting. Holdings saved on <Link to="/portfolio" className="underline underline-offset-4">your portfolio page</Link> are read from this browser only.
        </>
      }
      faqItems={[
        { question: "What is tax-loss harvesting?", answer: "Selling investments that are below their cost before the tax year ends, so the loss reduces the tax on capital gains booked in the same year. A short-term loss can reduce any capital gain; a long-term loss only long-term gains." },
        { question: "What happens to losses I cannot use this year?", answer: `They carry forward for up to ${E.lossCarryForwardYears.value} tax years, provided the return is filed on time, and keep the same set-off rules.` },
        { question: "When is a holding long-term?", answer: `Listed shares and equity fund units held for more than ${E.longTermAfterMonths.value} months.` },
      ]}
    >
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="min-w-0 space-y-4 lg:col-span-3">
          <Card className="grid gap-3 p-5 sm:grid-cols-2">
            <NumberField id="h-stcg" label="Short-term gains booked this year (₹)" value={stcg} onChange={setStcg} hint={`Taxed at ${pctLabel(E.stcgRate.value)}`} />
            <NumberField id="h-ltcg" label="Long-term gains booked this year (₹)" value={ltcg} onChange={setLtcg} hint={`${pctLabel(E.ltcgRate.value)} above ${inr(E.ltcgExemption.value)}`} />
          </Card>

          <Card className="p-0">
            <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-4">
              <h2 className="font-semibold">Your holdings</h2>
              <p className="text-xs text-muted-foreground">{fromPortfolio ? "Filled from your saved portfolio." : "Add the shares you hold, or save them on the portfolio page."} A blank price uses the last tracked price.</p>
            </div>
            {/* contain:paint: without it the 640px table still widened the root on phones (scrollWidth 631). */}
            <div className="mt-3 overflow-x-auto [contain:paint]">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-left font-medium">Symbol</th>
                    <th scope="col" className="px-2 py-2 text-right font-medium">Quantity</th>
                    <th scope="col" className="px-2 py-2 text-right font-medium">Avg cost (₹)</th>
                    <th scope="col" className="px-2 py-2 text-right font-medium">Price now (₹)</th>
                    <th scope="col" className="px-2 py-2 text-center font-medium">Held &gt; 12 months</th>
                    <th scope="col" className="px-2 py-2 text-right font-medium">P&amp;L</th>
                    <th scope="col" className="px-2 py-2"><span className="sr-only">Remove</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const live = livePrice(r.symbol);
                    const price = r.price.trim() ? num(r.price) : live;
                    const pnl = price !== null && num(r.qty) > 0 && num(r.avg) > 0 ? (price - num(r.avg)) * num(r.qty) : null;
                    return (
                      <tr key={r.id} className="border-t">
                        <td className="px-3 py-1.5"><input aria-label="Symbol" className={`${cell} uppercase`} value={r.symbol} onChange={(e) => update(r.id, { symbol: e.target.value })} placeholder="e.g. INFY" /></td>
                        <td className="px-2 py-1.5"><input aria-label={`Quantity of ${r.symbol || "this holding"}`} inputMode="decimal" className={`${cell} text-right`} value={r.qty} onChange={(e) => update(r.id, { qty: e.target.value })} /></td>
                        <td className="px-2 py-1.5"><input aria-label={`Average cost of ${r.symbol || "this holding"}`} inputMode="decimal" className={`${cell} text-right`} value={r.avg} onChange={(e) => update(r.id, { avg: e.target.value })} /></td>
                        <td className="px-2 py-1.5"><input aria-label={`Current price of ${r.symbol || "this holding"}`} inputMode="decimal" className={`${cell} text-right`} value={r.price} onChange={(e) => update(r.id, { price: e.target.value })} placeholder={live !== null ? live.toFixed(2) : "enter"} /></td>
                        <td className="px-2 py-1.5 text-center"><input type="checkbox" aria-label={`${r.symbol || "This holding"} held more than 12 months`} className="h-4 w-4 accent-[hsl(var(--secondary))]" checked={r.longTerm} onChange={(e) => update(r.id, { longTerm: e.target.checked })} /></td>
                        <td className={`px-2 py-1.5 text-right tabular-nums ${pnl === null ? "text-muted-foreground" : pnl < 0 ? "text-destructive" : "text-secondary"}`}>{pnl === null ? "—" : inr(pnl)}</td>
                        <td className="px-2 py-1.5 text-right">
                          <button type="button" onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((x) => x.id !== r.id) : [blankRow(r.id + 1)]))} className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Remove ${r.symbol || "this row"}`}>
                            <Trash2 className="h-4 w-4" aria-hidden />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-5 pb-4 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setRows((rs) => [...rs, blankRow(Math.max(...rs.map((r) => r.id)) + 1)])}>
                <Plus className="mr-1 h-4 w-4" aria-hidden /> Add a holding
              </Button>
            </div>
          </Card>
        </div>

        <div className="min-w-0 space-y-6 lg:col-span-2" aria-live="polite">
          <Headline label="Tax you could save this year" value={inr(result.saved)}>
            <Rows rows={[
              { label: "Losses available, short-term", value: inr(result.shortTermLoss) },
              { label: "Losses available, long-term", value: inr(result.longTermLoss) },
              { label: "Gains taxed now: short / long", value: `${inr(result.before.stcg)} / ${inr(result.before.ltcg)}` },
              { label: "After booking the losses", value: `${inr(result.after.stcg)} / ${inr(result.after.ltcg)}` },
              { label: "Tax with cess, now", value: inr(result.before.tax) },
              { label: "Tax with cess, after", value: inr(result.after.tax), strong: true },
              ...(result.carryForward.shortTerm + result.carryForward.longTerm > 0
                ? [{ label: "Carried forward to next year", value: `${inr(result.carryForward.shortTerm)} short, ${inr(result.carryForward.longTerm)} long` }]
                : []),
            ]} />
            {result.losses.length > 0 && (
              <p className="mt-3 text-sm text-muted-foreground">
                Largest losses: {result.losses.slice(0, 3).map((l) => `${l.symbol} ${inr(l.loss)} (${l.longTerm ? "long" : "short"}-term)`).join(", ")}.
              </p>
            )}
          </Headline>
          <TaxRulesUsed rules={[
            { label: "Short-term gains", value: pctLabel(E.stcgRate.value), rule: E.stcgRate },
            { label: "Long-term gains", value: `${pctLabel(E.ltcgRate.value)} above ${inr(E.ltcgExemption.value)} a year`, rule: E.ltcgRate },
            { label: "Setting off losses", value: E.lossSetOff.value, rule: E.lossSetOff },
            { label: "Carry forward", value: `${E.lossCarryForwardYears.value} tax years`, rule: E.lossCarryForwardYears },
            { label: "Health and Education Cess", value: `${pctLabel(TAX_RULES.cess.value)} of the tax`, rule: TAX_RULES.cess },
          ]} />
        </div>
      </div>
    </CalculatorShell>
  );
}

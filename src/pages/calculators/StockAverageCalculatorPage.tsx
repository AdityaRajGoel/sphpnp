import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import CalculatorShell from "@/components/calculators/CalculatorShell";
import { Figure, Headline, NumberField, Segmented, inr, num } from "@/components/calculators/fields";
import { averagePrice, sharesToReachAverage, type Trade } from "@/lib/calculators";

type Row = { id: number; side: Trade["side"]; qty: string; price: string };

const EXAMPLE: Row[] = [
  { id: 1, side: "buy", qty: "50", price: "1200" },
  { id: 2, side: "buy", qty: "50", price: "1000" },
];

const SIDES: { value: Trade["side"]; label: string }[] = [
  { value: "buy", label: "Buy" },
  { value: "sell", label: "Sell" },
];

const price2 = (n: number) => inr(n, 2);

export default function StockAverageCalculatorPage() {
  const [rows, setRows] = useState<Row[]>(EXAMPLE);
  const [marketPrice, setMarketPrice] = useState("900");
  const [target, setTarget] = useState("1000");
  const update = (id: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const add = () => setRows((rs) => [...rs, { id: Math.max(0, ...rs.map((r) => r.id)) + 1, side: "buy", qty: "", price: "" }]);
  const remove = (id: number) => setRows((rs) => rs.filter((r) => r.id !== id));

  const r = averagePrice(rows.map((x) => ({ side: x.side, qty: num(x.qty), price: num(x.price) })));
  const errorAt = (i: number, field: "qty" | "price") => ("error" in r && r.row === i && r.field === field ? r.error : null);

  const mp = num(marketPrice);
  const tg = num(target);
  const needed = r.ok && r.qty > 0 ? sharesToReachAverage(r.qty, r.average, mp, tg) : null;

  return (
    <CalculatorShell
      path="/stock-average-calculator"
      name="Stock Average Calculator"
      seoTitle="Stock Average Calculator: Average Buy Price"
      description="Work out your average buy price across several purchases and sales of a share, and how many shares a lower-priced buy needs to reach a target average."
      intro="Your average buy price across several purchases, including buys at a lower price (averaging down) and any shares you have sold."
      notes="Sells are matched against the earliest buys first (first in, first out), and the average is of the shares still held. Brokerage and taxes are not included; averaging down adds to a position and does not by itself change what a share is worth."
      faqItems={[
        { question: "How is the average price calculated?", answer: "Total cost of the shares still held divided by the number of shares. A sell removes the earliest-bought shares first." },
        { question: "What is averaging down?", answer: "Buying more of a share at a price below your average, which lowers the average cost of the holding. It also raises the amount at stake in that one share." },
      ]}
    >
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="p-5 lg:col-span-3 lg:self-start">
          <h2 className="mb-4 text-sm font-semibold text-foreground">Your trades, oldest first</h2>
          <ol className="space-y-4">
            {rows.map((row, i) => (
              <li key={row.id}>
                <fieldset className="grid grid-cols-2 gap-x-3 rounded-lg border p-3 sm:grid-cols-[auto_1fr_1fr_auto] sm:items-start">
                  <legend className="px-1 text-xs font-medium text-muted-foreground">Trade {i + 1}</legend>
                  <div className="col-span-2 mb-3 flex items-center justify-between sm:col-span-1 sm:mb-0 sm:pt-5">
                    <Segmented label={`Trade ${i + 1} side`} value={row.side} options={SIDES} onChange={(v) => update(row.id, { side: v })} />
                    <button type="button" onClick={() => remove(row.id)} disabled={rows.length <= 1} aria-label={`Remove trade ${i + 1}`}
                      className="grid h-10 w-10 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40 sm:hidden">
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                  <NumberField id={`avg-qty-${row.id}`} label="Shares" value={row.qty} onChange={(v) => update(row.id, { qty: v })} error={errorAt(i, "qty")} step="1" />
                  <NumberField id={`avg-price-${row.id}`} label="Price (₹)" value={row.price} onChange={(v) => update(row.id, { price: v })} error={errorAt(i, "price")} />
                  <button type="button" onClick={() => remove(row.id)} disabled={rows.length <= 1} aria-label={`Remove trade ${i + 1}`}
                    className="mt-5 hidden h-10 w-10 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40 sm:grid">
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </fieldset>
              </li>
            ))}
          </ol>
          <button type="button" onClick={add} className="mt-4 inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-secondary hover:text-secondary">
            <Plus className="h-4 w-4" aria-hidden="true" /> Add trade
          </button>
        </Card>

        <div className="space-y-6 lg:col-span-2" aria-live="polite">
          {"error" in r ? (
            <Card className="p-5 text-sm text-muted-foreground">Trade {r.row + 1}: {r.error}.</Card>
          ) : (
            <Headline label="Average buy price" value={r.qty > 0 ? price2(r.average) : "No shares held"}>
              <dl className="grid grid-cols-2 gap-4">
                <Figure label="Shares held" value={r.qty.toLocaleString("en-IN")} />
                <Figure label="Cost of shares held" value={price2(r.cost)} />
                <Figure label="Realised profit / loss" value={price2(r.realised)} hint="On shares sold" />
              </dl>
            </Headline>
          )}

          {r.ok && r.qty > 0 && (
            <Card className="space-y-2 p-5">
              <h2 className="text-sm font-semibold text-foreground">Shares needed for a target average</h2>
              <NumberField id="avg-market" label="Price you would buy at (₹)" value={marketPrice} onChange={setMarketPrice} />
              <NumberField id="avg-target" label="Target average (₹)" value={target} onChange={setTarget} />
              <p className="text-sm text-muted-foreground">
                {needed !== null ? (
                  <>
                    Buying <span className="font-semibold tabular-nums text-foreground">{needed.toLocaleString("en-IN")}</span> shares at {price2(mp)} (
                    {price2(needed * mp)}) brings the average to {price2((r.cost + needed * mp) / (r.qty + needed))}.
                  </>
                ) : (
                  <>The target has to lie between the buy price and your current average of {price2(r.average)}.</>
                )}
              </p>
            </Card>
          )}
        </div>
      </div>
    </CalculatorShell>
  );
}

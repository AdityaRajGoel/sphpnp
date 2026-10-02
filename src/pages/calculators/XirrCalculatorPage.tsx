import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import CalculatorShell from "@/components/calculators/CalculatorShell";
import { Figure, Headline, NumberField, Segmented, inr, num, pct } from "@/components/calculators/fields";
import { cashFlowXirr } from "@/lib/calculators";

type Dir = "in" | "out";
type Row = { id: number; date: string; amount: string; dir: Dir };

// Fixed example dates, so the prerendered page and every visit show the same answer.
const EXAMPLE: Row[] = [
  { id: 1, date: "2022-04-01", amount: "50000", dir: "in" },
  { id: 2, date: "2023-04-01", amount: "25000", dir: "in" },
  { id: 3, date: "2024-10-01", amount: "10000", dir: "out" },
  { id: 4, date: "2026-09-01", amount: "92000", dir: "out" },
];

const DIRS: { value: Dir; label: string }[] = [
  { value: "in", label: "Paid in" },
  { value: "out", label: "Received" },
];

const dateError = (r: Row) => (/^\d{4}-\d{2}-\d{2}$/.test(r.date) ? null : "Enter a date");
const amountError = (r: Row) => (num(r.amount) > 0 ? null : "Enter an amount above 0");

export default function XirrCalculatorPage() {
  const [rows, setRows] = useState<Row[]>(EXAMPLE);
  const update = (id: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const add = () => setRows((rs) => [...rs, { id: Math.max(0, ...rs.map((r) => r.id)) + 1, date: "", amount: "", dir: "out" }]);
  const remove = (id: number) => setRows((rs) => rs.filter((r) => r.id !== id));

  const valid = rows.every((r) => !dateError(r) && !amountError(r));
  const flows = rows.map((r) => ({ date: r.date, amount: (r.dir === "in" ? -1 : 1) * num(r.amount) }));
  const rate = valid ? cashFlowXirr(flows) : null;
  const paidIn = valid ? flows.filter((f) => f.amount < 0).reduce((s, f) => s - f.amount, 0) : 0;
  const received = valid ? flows.filter((f) => f.amount > 0).reduce((s, f) => s + f.amount, 0) : 0;

  return (
    <CalculatorShell
      path="/xirr-calculator"
      name="XIRR Calculator"
      seoTitle="XIRR Calculator: Returns on Dated Cash Flows"
      description="Work out the annualised return (XIRR) on money paid in and taken out on different dates, such as SIPs, top-ups, withdrawals and a current value."
      intro="The yearly return on money that went in and came out on different dates. Enter each amount with its date; include today's value as money received."
      notes="XIRR finds the one yearly rate at which all the flows, discounted by their dates on a 365-day year, net to zero. It is solved by bisection between −99% and +1,000% a year; outside that range, or when the flows do not go both ways, no rate is shown."
      faqItems={[
        { question: "What is XIRR?", answer: "The annualised return on cash flows made on irregular dates: the single yearly rate at which the money paid in and the money received, each discounted to its date, balance out." },
        { question: "How do I value an investment I still hold?", answer: "Add its current value as money received, dated today." },
      ]}
    >
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="p-5 lg:col-span-3 lg:self-start">
          <h2 className="mb-4 text-sm font-semibold text-foreground">Cash flows</h2>
          <ol className="space-y-4">
            {rows.map((r, i) => (
              <li key={r.id}>
                <fieldset className="grid gap-x-3 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_auto]">
                  <legend className="px-1 text-xs font-medium text-muted-foreground">Cash flow {i + 1}</legend>
                  <NumberField id={`xirr-date-${r.id}`} label="Date" type="date" value={r.date} onChange={(v) => update(r.id, { date: v })} error={dateError(r)} />
                  <NumberField id={`xirr-amount-${r.id}`} label="Amount (₹)" value={r.amount} onChange={(v) => update(r.id, { amount: v })} error={amountError(r)} />
                  <div className="flex items-center justify-between gap-2 sm:flex-col sm:items-end sm:justify-start sm:pt-5">
                    <Segmented label={`Cash flow ${i + 1} direction`} value={r.dir} options={DIRS} onChange={(v) => update(r.id, { dir: v })} />
                    <button type="button" onClick={() => remove(r.id)} disabled={rows.length <= 2} aria-label={`Remove cash flow ${i + 1}`}
                      className="grid h-10 w-10 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40 sm:h-8 sm:w-8">
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </fieldset>
              </li>
            ))}
          </ol>
          <button type="button" onClick={add} className="mt-4 inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-secondary hover:text-secondary">
            <Plus className="h-4 w-4" aria-hidden="true" /> Add cash flow
          </button>
        </Card>

        <div className="space-y-6 lg:col-span-2" aria-live="polite">
          {!valid ? (
            <Card className="p-5 text-sm text-muted-foreground">Fix the highlighted rows to see the return.</Card>
          ) : rate === null ? (
            <Card className="p-5">
              <p className="font-semibold text-foreground">No return could be worked out</p>
              <p className="mt-1 text-sm text-muted-foreground">
                XIRR needs money paid in and money received, on at least two different dates, and a yearly rate between −99% and +1,000% that balances them. Check the directions and dates.
              </p>
            </Card>
          ) : (
            <Headline label="XIRR (annualised)" value={pct(rate)}>
              <dl className="grid grid-cols-2 gap-4">
                <Figure label="Paid in" value={inr(paidIn)} />
                <Figure label="Received" value={inr(received)} />
                <Figure label="Net gain" value={inr(received - paidIn)} />
              </dl>
            </Headline>
          )}
        </div>
      </div>
    </CalculatorShell>
  );
}

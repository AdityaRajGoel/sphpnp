import { useState } from "react";
import { Card } from "@/components/ui/card";
import CalculatorShell from "@/components/calculators/CalculatorShell";
import ValueChart from "@/components/calculators/ValueChart";
import { ASSUMED_RETURN_HINT, Figure, Headline, SliderField, inr } from "@/components/calculators/fields";
import { lumpsum } from "@/lib/calculators";

export default function LumpsumCalculatorPage() {
  const [amount, setAmount] = useState(100000);
  const [rate, setRate] = useState(12);
  const [years, setYears] = useState(10);
  const r = lumpsum(amount, rate, years);

  return (
    <CalculatorShell
      path="/lumpsum-calculator"
      name="Lumpsum Calculator"
      seoTitle="Lumpsum Calculator: One-Time Investment Growth"
      description="Estimate what a one-time investment could grow to at an assumed yearly return, compounded annually, with a year-by-year chart."
      intro="What one amount invested today could grow to, compounded once a year at a return you assume."
      notes="The value compounds once a year at the assumed rate. Real returns vary from year to year, and tax, exit loads and costs are not included."
      faqItems={[
        { question: "How is lumpsum value calculated?", answer: "Value = amount × (1 + assumed yearly return) ^ years. The return is compounded once a year." },
        { question: "Is the result guaranteed?", answer: "No. The return is an assumption you enter. Market-linked investments can return less than assumed, or lose money." },
      ]}
    >
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="space-y-6 p-5 lg:col-span-2 lg:self-start">
          <SliderField id="ls-amount" label="Amount invested" prefix="₹" value={amount} min={1000} max={10000000} step={1000} onChange={setAmount}
            valueText={(n) => inr(n)} minLabel="₹1,000" maxLabel="₹1 crore" />
          <SliderField id="ls-rate" label="Assumed return (% a year)" suffix="%" value={rate} min={1} max={30} step={0.5} onChange={setRate}
            valueText={(n) => `${n}% a year`} minLabel="1%" maxLabel="30%" hint={ASSUMED_RETURN_HINT} />
          <SliderField id="ls-years" label="Period (years)" value={years} min={1} max={40} step={1} onChange={setYears}
            valueText={(n) => `${n} ${n === 1 ? "year" : "years"}`} minLabel="1 yr" maxLabel="40 yrs" />
        </Card>

        <div className="space-y-6 lg:col-span-3" aria-live="polite">
          {r && (
            <>
              <Headline label={`Estimated value after ${years} ${years === 1 ? "year" : "years"}`} value={inr(r.value)}>
                <dl className="grid grid-cols-2 gap-4">
                  <Figure label="Invested" value={inr(r.invested)} />
                  <Figure label="Estimated growth" value={inr(r.gain)} hint={`${(r.value / r.invested).toFixed(2)}× the amount`} />
                </dl>
              </Headline>
              <Card className="p-5">
                <h2 className="mb-3 text-sm font-semibold text-foreground">Value by year</h2>
                <ValueChart
                  rows={r.rows.map((x) => ({ year: x.year, a: x.value, b: x.invested }))}
                  subject={{ key: "a", label: "Estimated value" }}
                  reference={{ key: "b", label: "Invested" }}
                  label={`Estimated value rising from ${inr(r.rows[0].value)} after one year to ${inr(r.value)} after ${years} years, against ${inr(amount)} invested`}
                />
              </Card>
            </>
          )}
        </div>
      </div>
    </CalculatorShell>
  );
}

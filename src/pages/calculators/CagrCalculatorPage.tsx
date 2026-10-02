import { useState } from "react";
import { Card } from "@/components/ui/card";
import CalculatorShell from "@/components/calculators/CalculatorShell";
import { Figure, Headline, NumberField, inr, num, pct } from "@/components/calculators/fields";
import { cagr } from "@/lib/calculators";

export default function CagrCalculatorPage() {
  const [start, setStart] = useState("100000");
  const [end, setEnd] = useState("250000");
  const [years, setYears] = useState("7");
  const s = num(start);
  const e = num(end);
  const y = num(years);
  const errors = {
    start: Number.isFinite(s) && s > 0 ? null : "Enter a starting value above 0",
    end: Number.isFinite(e) && e >= 0 ? null : "Enter an ending value of 0 or more",
    years: Number.isFinite(y) && y > 0 ? null : "Enter a period above 0",
  };
  const rate = cagr(s, e, y);

  return (
    <CalculatorShell
      path="/cagr-calculator"
      name="CAGR Calculator"
      seoTitle="CAGR Calculator: Compound Annual Growth Rate"
      description="Work out the compound annual growth rate between a starting and an ending value over any number of years, with the absolute return."
      intro="The steady yearly rate that takes a starting value to an ending value over a period. Useful for comparing growth over different lengths of time."
      notes="CAGR assumes a single amount at the start and nothing added or taken out. For money paid in or out on different dates, use the XIRR calculator."
      faqItems={[
        { question: "What is CAGR?", answer: "Compound annual growth rate: the constant yearly rate at which a starting value would grow to the ending value over the period. CAGR = (end ÷ start) ^ (1 ÷ years) − 1." },
        { question: "CAGR or XIRR?", answer: "CAGR fits one investment made at the start. When money goes in or comes out on several dates, XIRR gives the annual return." },
      ]}
    >
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="space-y-2 p-5 lg:col-span-2 lg:self-start">
          <NumberField id="cagr-start" label="Starting value (₹)" value={start} onChange={setStart} error={errors.start} />
          <NumberField id="cagr-end" label="Ending value (₹)" value={end} onChange={setEnd} error={errors.end} />
          <NumberField id="cagr-years" label="Period (years)" value={years} onChange={setYears} error={errors.years} hint="Decimals work: 2.5 for two and a half years." />
        </Card>

        <div className="space-y-6 lg:col-span-3" aria-live="polite">
          {rate === null ? (
            <Card className="p-5 text-sm text-muted-foreground">Fix the highlighted values to see the growth rate.</Card>
          ) : (
            <Headline label="Compound annual growth rate" value={pct(rate)}>
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Figure label="Absolute return" value={pct((e / s - 1) * 100)} />
                <Figure label="Change in value" value={inr(e - s)} />
                <Figure label="Multiple" value={`${(e / s).toFixed(2)}×`} />
              </dl>
            </Headline>
          )}
        </div>
      </div>
    </CalculatorShell>
  );
}

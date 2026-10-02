import { useState } from "react";
import { Card } from "@/components/ui/card";
import CalculatorShell from "@/components/calculators/CalculatorShell";
import ValueChart from "@/components/calculators/ValueChart";
import { ASSUMED_RETURN_HINT, Figure, Headline, SliderField, inr } from "@/components/calculators/fields";
import { stepUpSip } from "@/lib/calculators";

export default function StepUpSipCalculatorPage() {
  const [monthly, setMonthly] = useState(5000);
  const [stepUp, setStepUp] = useState(10);
  const [rate, setRate] = useState(12);
  const [years, setYears] = useState(15);
  const r = stepUpSip(monthly, stepUp, rate, years);
  const flat = stepUpSip(monthly, 0, rate, years);
  const lastInstalment = monthly * Math.pow(1 + stepUp / 100, years - 1);

  return (
    <CalculatorShell
      path="/step-up-sip-calculator"
      name="Step-up SIP Calculator"
      seoTitle="Step-up SIP Calculator: SIP With Yearly Increase"
      description="Estimate a SIP that rises by a set percentage every year: total invested, estimated value and the gap over a flat SIP, at an assumed return."
      intro="A monthly SIP that rises by a fixed percentage every twelve months, worked out month by month at a return you assume."
      notes="Instalments are paid at the start of each month and the assumed yearly return is applied monthly (rate ÷ 12), the same convention as the SIP calculator. Tax, exit loads and costs are not included."
      faqItems={[
        { question: "What is a step-up SIP?", answer: "A SIP whose monthly instalment is raised by a set percentage once a year, for example 10% every twelve months." },
        { question: "How is it calculated?", answer: "Month by month: each instalment is added at the start of the month and the balance grows by the assumed yearly return divided by 12. The instalment rises by the step-up percentage every twelve months." },
      ]}
    >
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="space-y-6 p-5 lg:col-span-2 lg:self-start">
          <SliderField id="su-monthly" label="Starting monthly SIP" prefix="₹" value={monthly} min={500} max={100000} step={500} onChange={setMonthly}
            valueText={(n) => `${inr(n)} a month`} minLabel="₹500" maxLabel="₹1,00,000" />
          <SliderField id="su-step" label="Yearly step-up (%)" suffix="%" value={stepUp} min={0} max={25} step={1} onChange={setStepUp}
            valueText={(n) => `${n}% more each year`} minLabel="0%" maxLabel="25%" />
          <SliderField id="su-rate" label="Assumed return (% a year)" suffix="%" value={rate} min={1} max={30} step={0.5} onChange={setRate}
            valueText={(n) => `${n}% a year`} minLabel="1%" maxLabel="30%" hint={ASSUMED_RETURN_HINT} />
          <SliderField id="su-years" label="Period (years)" value={years} min={1} max={40} step={1} onChange={setYears}
            valueText={(n) => `${n} ${n === 1 ? "year" : "years"}`} minLabel="1 yr" maxLabel="40 yrs" />
        </Card>

        <div className="space-y-6 lg:col-span-3" aria-live="polite">
          {r && flat && (
            <>
              <Headline label={`Estimated value after ${years} ${years === 1 ? "year" : "years"}`} value={inr(r.value)}>
                <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <Figure label="Total invested" value={inr(r.invested)} />
                  <Figure label="Estimated growth" value={inr(r.gain)} />
                  <Figure label="Monthly SIP in the last year" value={inr(lastInstalment)} />
                </dl>
              </Headline>
              <Card className="p-5">
                <p className="text-sm text-muted-foreground">
                  The same {inr(monthly)} SIP with no step-up: {inr(flat.invested)} invested, an estimated{" "}
                  <span className="font-semibold tabular-nums text-foreground">{inr(flat.value)}</span>.
                </p>
              </Card>
              <Card className="p-5">
                <h2 className="mb-3 text-sm font-semibold text-foreground">Value by year</h2>
                <ValueChart
                  rows={r.rows.map((x) => ({ year: x.year, a: x.value, b: x.invested }))}
                  subject={{ key: "a", label: "Estimated value" }}
                  reference={{ key: "b", label: "Invested so far" }}
                  label={`Estimated value reaching ${inr(r.value)} after ${years} years, against ${inr(r.invested)} invested`}
                />
              </Card>
            </>
          )}
        </div>
      </div>
    </CalculatorShell>
  );
}

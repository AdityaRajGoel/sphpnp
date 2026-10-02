import { useState } from "react";
import { Card } from "@/components/ui/card";
import CalculatorShell from "@/components/calculators/CalculatorShell";
import ValueChart from "@/components/calculators/ValueChart";
import { ASSUMED_RETURN_HINT, Figure, Headline, SliderField, inr } from "@/components/calculators/fields";
import { swp } from "@/lib/calculators";

export default function SwpCalculatorPage() {
  const [corpus, setCorpus] = useState(1000000);
  const [withdrawal, setWithdrawal] = useState(8000);
  const [rate, setRate] = useState(8);
  const [years, setYears] = useState(10);
  const r = swp(corpus, withdrawal, rate, years);
  const ranOut = r?.depleted ? `${Math.floor((r.monthsPaid - 1) / 12) + 1}` : null;

  return (
    <CalculatorShell
      path="/swp-calculator"
      name="SWP Calculator"
      seoTitle="SWP Calculator: Systematic Withdrawal Plan"
      description="Estimate a systematic withdrawal plan: total withdrawn, the balance left, and whether the corpus runs out, at an assumed return."
      intro="A fixed monthly withdrawal from a lump sum: how much you take out, what is left, and whether the money lasts the period."
      notes="Each month the balance earns the assumed yearly return divided by 12, then the withdrawal is paid. The month the balance runs short, what is left is paid out. Tax on withdrawals, exit loads and costs are not included."
      faqItems={[
        { question: "What is an SWP?", answer: "A systematic withdrawal plan pays you a fixed amount from an investment every month, while the rest stays invested." },
        { question: "When does the corpus run out?", answer: "When the monthly withdrawals are more than the balance earns. The calculator shows the year it happens at the return you assume." },
      ]}
    >
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="space-y-6 p-5 lg:col-span-2 lg:self-start">
          <SliderField id="swp-corpus" label="Starting corpus" prefix="₹" value={corpus} min={100000} max={50000000} step={10000} onChange={setCorpus}
            valueText={(n) => inr(n)} minLabel="₹1 lakh" maxLabel="₹5 crore" />
          <SliderField id="swp-withdrawal" label="Monthly withdrawal" prefix="₹" value={withdrawal} min={500} max={500000} step={500} onChange={setWithdrawal}
            valueText={(n) => `${inr(n)} a month`} minLabel="₹500" maxLabel="₹5,00,000" />
          <SliderField id="swp-rate" label="Assumed return (% a year)" suffix="%" value={rate} min={0} max={30} step={0.5} onChange={setRate}
            valueText={(n) => `${n}% a year`} minLabel="0%" maxLabel="30%" hint={ASSUMED_RETURN_HINT} />
          <SliderField id="swp-years" label="Period (years)" value={years} min={1} max={40} step={1} onChange={setYears}
            valueText={(n) => `${n} ${n === 1 ? "year" : "years"}`} minLabel="1 yr" maxLabel="40 yrs" />
        </Card>

        <div className="space-y-6 lg:col-span-3" aria-live="polite">
          {r && (
            <>
              <Headline label={r.depleted ? "The corpus runs out" : `Balance left after ${years} ${years === 1 ? "year" : "years"}`}
                value={r.depleted ? `In year ${ranOut}` : inr(r.balance)}>
                <dl className="grid grid-cols-2 gap-4">
                  <Figure label="Total withdrawn" value={inr(r.withdrawn)} hint={`${r.monthsPaid} monthly ${r.monthsPaid === 1 ? "payment" : "payments"}`} />
                  <Figure label="Starting corpus" value={inr(corpus)} />
                </dl>
                {r.depleted && (
                  <p className="mt-4 text-sm text-muted-foreground">
                    At an assumed {rate}% a year, {inr(withdrawal)} a month is more than the balance can keep paying for {years} years.
                  </p>
                )}
              </Headline>
              <Card className="p-5">
                <h2 className="mb-3 text-sm font-semibold text-foreground">Balance by year</h2>
                <ValueChart
                  rows={r.rows.map((x) => ({ year: x.year, a: x.balance, b: x.withdrawn }))}
                  subject={{ key: "a", label: "Balance" }}
                  reference={{ key: "b", label: "Withdrawn so far" }}
                  label={`Balance ${r.balance < corpus ? "falling" : "growing"} from ${inr(corpus)} to ${inr(r.balance)}, with ${inr(r.withdrawn)} withdrawn in total`}
                />
              </Card>
            </>
          )}
        </div>
      </div>
    </CalculatorShell>
  );
}

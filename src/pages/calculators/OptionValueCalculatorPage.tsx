import { useState } from "react";
import { Card } from "@/components/ui/card";
import CalculatorShell from "@/components/calculators/CalculatorShell";
import { NumberField, SliderField, num } from "@/components/calculators/fields";
import { optionValue, type OptionSide } from "@/lib/calculators";

const fixed = (digits: number) => (n: number) =>
  `${n < 0 ? "−" : ""}${Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
const f2 = fixed(2);
const f4 = fixed(4);

const GREEKS: { key: keyof OptionSide; label: string; hint: string; fmt: (n: number) => string }[] = [
  { key: "delta", label: "Delta", hint: "Change in value for a ₹1 move in the underlying", fmt: f4 },
  { key: "gamma", label: "Gamma", hint: "Change in delta for a ₹1 move", fmt: (n) => n.toPrecision(3) },
  { key: "theta", label: "Theta", hint: "Change in value per calendar day", fmt: f2 },
  { key: "vega", label: "Vega", hint: "Change in value per 1 point of volatility", fmt: f2 },
  { key: "rho", label: "Rho", hint: "Change in value per 1 point of interest rate", fmt: f2 },
];

export default function OptionValueCalculatorPage() {
  const [spot, setSpot] = useState("25000");
  const [strike, setStrike] = useState("25000");
  const [days, setDays] = useState(30);
  const [vol, setVol] = useState(14);
  const [rate, setRate] = useState(6.5);
  const s = num(spot);
  const k = num(strike);
  const errors = {
    spot: s > 0 ? null : "Enter a price above 0",
    strike: k > 0 ? null : "Enter a strike above 0",
  };
  const r = optionValue({ spot: s, strike: k, days, volPct: vol, ratePct: rate });

  return (
    <CalculatorShell
      path="/option-value-calculator"
      name="Option Value Calculator"
      seoTitle="Option Value Calculator: Black-Scholes and Greeks"
      description="Black-Scholes value of a European call and put from the underlying price, strike, days to expiry, volatility and interest rate, with delta, gamma, theta, vega and rho."
      intro="The Black-Scholes model value of a call and a put, and the Greeks, from the inputs you give it. A model value, not a market quote."
      notes="Black-Scholes values a European option (exercised only at expiry) on an underlying that pays no dividend, with volatility and interest rate held constant. Days are calendar days on a 365-day year. The volatility you enter drives the answer more than anything else; a traded premium also reflects demand, liquidity and the bid-ask spread."
      faqItems={[
        { question: "What does the option value calculator show?", answer: "The Black-Scholes value of a European call and put, with delta, gamma, theta (per day), vega and rho (per percentage point)." },
        { question: "Why does it differ from the traded premium?", answer: "The model uses the volatility you enter and assumes constant rates and no dividends. The market price reflects the volatility traders are actually paying for, plus supply and demand." },
      ]}
    >
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="space-y-5 p-5 lg:col-span-2 lg:self-start">
          <div className="grid grid-cols-2 gap-3">
            <NumberField id="opt-spot" label="Underlying price (₹)" value={spot} onChange={setSpot} error={errors.spot} />
            <NumberField id="opt-strike" label="Strike price (₹)" value={strike} onChange={setStrike} error={errors.strike} />
          </div>
          <SliderField id="opt-days" label="Days to expiry" value={days} min={1} max={365} step={1} onChange={setDays}
            valueText={(n) => `${n} ${n === 1 ? "day" : "days"}`} minLabel="1 day" maxLabel="365 days" />
          <SliderField id="opt-vol" label="Volatility (% a year)" suffix="%" value={vol} min={1} max={100} step={0.5} onChange={setVol}
            valueText={(n) => `${n}% volatility`} minLabel="1%" maxLabel="100%" hint="Use the option's implied volatility from the option chain." />
          <SliderField id="opt-rate" label="Risk-free rate (% a year)" suffix="%" value={rate} min={0} max={15} step={0.25} onChange={setRate}
            valueText={(n) => `${n}% a year`} minLabel="0%" maxLabel="15%" hint="Roughly the 91-day Treasury bill yield." />
        </Card>

        <div className="space-y-6 lg:col-span-3" aria-live="polite">
          {!r ? (
            <Card className="p-5 text-sm text-muted-foreground">Fix the highlighted values to see the option value.</Card>
          ) : (
            <Card className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <caption className="px-5 pt-5 text-left text-sm font-semibold text-foreground">Model value and Greeks, per unit</caption>
                <thead>
                  <tr className="text-muted-foreground">
                    <th scope="col" className="px-5 py-3 text-left font-medium"><span className="sr-only">Measure</span></th>
                    <th scope="col" className="px-3 py-3 text-right font-medium">Call</th>
                    <th scope="col" className="px-5 py-3 text-right font-medium">Put</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t">
                    <th scope="row" className="px-5 py-3 text-left font-semibold text-foreground">Value (₹)</th>
                    <td className="px-3 py-3 text-right text-xl font-bold tabular-nums text-foreground">{f2(r.call.price)}</td>
                    <td className="px-5 py-3 text-right text-xl font-bold tabular-nums text-foreground">{f2(r.put.price)}</td>
                  </tr>
                  {GREEKS.map((g) => (
                    <tr key={g.key} className="border-t">
                      <th scope="row" className="px-5 py-2.5 text-left font-normal">
                        <span className="block font-medium text-foreground">{g.label}</span>
                        <span className="block text-xs text-muted-foreground">{g.hint}</span>
                      </th>
                      <td className="px-3 py-2.5 text-right tabular-nums">{g.fmt(r.call[g.key])}</td>
                      <td className="px-5 py-2.5 text-right tabular-nums">{g.fmt(r.put[g.key])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
          {r && (
            <p className="text-xs text-muted-foreground">
              Intrinsic value: call {f2(Math.max(0, s - k))}, put {f2(Math.max(0, k - s))}. The rest of each value is time value, which theta wears away as expiry nears.
            </p>
          )}
        </div>
      </div>
    </CalculatorShell>
  );
}

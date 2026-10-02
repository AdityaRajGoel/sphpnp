import { useState } from "react";
import { Card } from "@/components/ui/card";
import CalculatorShell, { type RelatedGuide } from "@/components/calculators/CalculatorShell";
import TaxRulesUsed from "@/components/calculators/TaxRulesUsed";
import { Headline, NumberField, Segmented, inr, num } from "@/components/calculators/fields";
import { incomeTax, type AgeBand, type RegimeResult } from "@/lib/tax-calculators";
import { TAX_RULES, TAX_YEAR_LABEL, pctLabel, type Slab } from "@/lib/tax-rules";

/** Learning Center articles on income tax; fill in slugs as they are published. */
export const INCOME_TAX_GUIDES: RelatedGuide[] = [];

const NR = TAX_RULES.newRegime;
const OR = TAX_RULES.oldRegime;

const AGES: { value: AgeBand; label: string }[] = [
  { value: "below60", label: "Below 60" },
  { value: "60to79", label: "60 to 79" },
  { value: "80plus", label: "80 or more" },
];

/** "₹4,00,001 to ₹8,00,000: 5%" lines for a slab table. */
const slabLines = (slabs: readonly Slab[]) => {
  let floor = 0;
  return slabs.map(({ upTo, rate }) => {
    const line = upTo === null ? `Above ${inr(floor)}` : floor === 0 ? `Up to ${inr(upTo)}` : `${inr(floor + 1)} to ${inr(upTo)}`;
    floor = upTo ?? floor;
    return `${line}: ${rate === 0 ? "nil" : pctLabel(rate)}`;
  });
};

const amount = (s: string) => {
  const n = num(s);
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const amountError = (s: string) => (s.trim() === "" || num(s) >= 0 ? null : "Enter 0 or more");

const ROWS: { key: keyof RegimeResult; label: string; strong?: boolean }[] = [
  { key: "grossIncome", label: "Gross income" },
  { key: "deductions", label: "Deductions" },
  { key: "taxableIncome", label: "Taxable income" },
  { key: "slabTax", label: "Tax on slabs" },
  { key: "rebate", label: "Rebate" },
  { key: "surcharge", label: "Surcharge" },
  { key: "cess", label: `Cess (${pctLabel(TAX_RULES.cess.value)})` },
  { key: "total", label: "Total tax", strong: true },
];

export default function IncomeTaxCalculatorPage() {
  const [age, setAge] = useState<AgeBand>("below60");
  const [salary, setSalary] = useState("1500000");
  const [other, setOther] = useState("50000");
  const [investments, setInvestments] = useState("150000");
  const [healthSelf, setHealthSelf] = useState("25000");
  const [healthParents, setHealthParents] = useState("0");
  const [parentsSenior, setParentsSenior] = useState(false);
  const [homeLoan, setHomeLoan] = useState("0");
  const [hra, setHra] = useState("0");

  const r = incomeTax({
    age, salary: amount(salary), otherIncome: amount(other), investments: amount(investments), healthSelf: amount(healthSelf),
    healthParents: amount(healthParents), parentsSenior, homeLoanInterest: amount(homeLoan), hraExempt: amount(hra),
  });
  const diff = Math.round(r.old.total) - Math.round(r.new.total);
  const verdict = diff === 0 ? "The same under both regimes" : `${inr(Math.abs(diff))} less under the ${diff > 0 ? "new" : "old"} regime`;
  const selfCap = age === "below60" ? OR.caps.healthSelf.value : OR.caps.healthSenior.value;
  const parentsCap = parentsSenior ? OR.caps.healthSenior.value : OR.caps.healthParents.value;

  return (
    <CalculatorShell
      path="/income-tax-calculator"
      name="Income Tax Calculator"
      seoTitle="Income Tax Calculator FY 2026-27: Old vs New Regime"
      description={`Compare income tax under the old and new regimes for ${TAX_YEAR_LABEL}: slabs, standard deduction, rebate, surcharge and cess, with common old-regime deductions.`}
      intro={`Tax on salary and other income under the new regime and the old one, side by side, for ${TAX_YEAR_LABEL}. Sections are those of the Income-tax Act, 2025.`}
      relatedGuides={INCOME_TAX_GUIDES}
      notes={
        <>
          An estimate for a resident individual, not tax advice or a return. It covers salary and other income taxed at slab rates; capital gains, business income, rent from let-out property, employer NPS contributions and other exemptions are not included. Surcharge follows the Finance Act, 2026 with marginal relief. Figures are rounded to the rupee.
        </>
      }
      faqItems={[
        { question: "What are the new-regime slabs for FY 2026-27?", answer: `${slabLines(NR.slabs.value).join("; ")}. Salaried taxpayers get a ${inr(NR.standardDeduction.value)} standard deduction, and a rebate makes the tax nil up to ${inr(NR.rebateIncomeLimit.value)} of taxable income.` },
        { question: "Which deductions does the new regime not allow?", answer: "Most old-regime deductions, including investments under section 123, health insurance under section 126, interest on a self-occupied home loan and the HRA exemption." },
      ]}
    >
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="space-y-4 p-5 lg:col-span-2 lg:self-start">
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Your age during the year</p>
            <Segmented<AgeBand> label="Your age during the year" value={age} onChange={setAge} options={AGES} />
          </div>
          <NumberField id="it-salary" label="Gross salary for the year (₹)" value={salary} onChange={setSalary} error={amountError(salary)} />
          <NumberField id="it-other" label="Other income: interest, etc. (₹)" value={other} onChange={setOther} error={amountError(other)} />

          <fieldset className="space-y-1 border-t pt-4">
            <legend className="text-sm font-semibold text-foreground">Old-regime deductions</legend>
            <p className="pb-2 text-xs text-muted-foreground">Ignored by the new regime. Each is capped as the Act caps it.</p>
            <NumberField id="it-123" label={`Investments, section 123 (80C), up to ${inr(OR.caps.investments.value)}`} value={investments} onChange={setInvestments} error={amountError(investments)} />
            <NumberField id="it-health-self" label={`Health cover for your family, section 126 (80D), up to ${inr(selfCap)}`} value={healthSelf} onChange={setHealthSelf} error={amountError(healthSelf)} />
            <NumberField id="it-health-parents" label={`Health cover for parents, up to ${inr(parentsCap)}`} value={healthParents} onChange={setHealthParents} error={amountError(healthParents)} />
            <label className="flex items-center gap-2 pb-3 text-sm text-foreground">
              <input type="checkbox" checked={parentsSenior} onChange={(e) => setParentsSenior(e.target.checked)} className="h-4 w-4 accent-secondary" />
              A parent covered is 60 or older
            </label>
            <NumberField id="it-home-loan" label={`Home-loan interest, self-occupied, up to ${inr(OR.caps.homeLoanInterest.value)}`} value={homeLoan} onChange={setHomeLoan} error={amountError(homeLoan)} />
            <NumberField id="it-hra" label="HRA exemption (₹)" value={hra} onChange={setHra} error={amountError(hra)} hint="The exempt part of your house rent allowance, as worked out by your employer." />
          </fieldset>
        </Card>

        <div className="space-y-6 lg:col-span-3" aria-live="polite">
          <Headline label="Estimated tax for the year" value={verdict}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Tax under the new and old regimes</caption>
                <thead>
                  <tr className="text-muted-foreground">
                    <th scope="col" className="py-2 pr-3 text-left font-medium"><span className="sr-only">Figure</span></th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">New regime</th>
                    <th scope="col" className="py-2 pl-3 text-right font-medium">Old regime</th>
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map(({ key, label, strong }) => (
                    <tr key={key} className="border-t">
                      <th scope="row" className={`py-2 pr-3 text-left ${strong ? "font-semibold text-foreground" : "font-normal text-muted-foreground"}`}>{label}</th>
                      <td className={`px-3 py-2 text-right tabular-nums text-foreground ${strong ? "font-semibold" : ""}`}>{inr(r.new[key])}</td>
                      <td className={`py-2 pl-3 text-right tabular-nums text-foreground ${strong ? "font-semibold" : ""}`}>{inr(r.old[key])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Headline>

          <TaxRulesUsed rules={[
            { label: "New regime slabs", value: slabLines(NR.slabs.value).join(" · "), rule: NR.slabs },
            { label: `Old regime slabs (${AGES.find((a) => a.value === age)!.label.toLowerCase()})`, value: slabLines(OR.slabs[age].value).join(" · "), rule: OR.slabs[age] },
            { label: "Standard deduction on salary", value: `New ${inr(NR.standardDeduction.value)}, old ${inr(OR.standardDeduction.value)}`, rule: NR.standardDeduction },
            { label: "Rebate, new regime", value: `Up to ${inr(NR.rebateMax.value)} at income up to ${inr(NR.rebateIncomeLimit.value)}, with marginal relief`, rule: NR.rebateMax },
            { label: "Rebate, old regime", value: `Up to ${inr(OR.rebateMax.value)} at income up to ${inr(OR.rebateIncomeLimit.value)}`, rule: OR.rebateMax },
            { label: "Surcharge, new regime", value: NR.surcharge.value.map((b) => `${pctLabel(b.rate)} above ${inr(b.above)}`).join(", "), rule: NR.surcharge },
            { label: "Surcharge, old regime", value: OR.surcharge.value.map((b) => `${pctLabel(b.rate)} above ${inr(b.above)}`).join(", "), rule: OR.surcharge },
            { label: "Health and Education Cess", value: `${pctLabel(TAX_RULES.cess.value)} of tax and surcharge`, rule: TAX_RULES.cess },
          ]} />
        </div>
      </div>
    </CalculatorShell>
  );
}

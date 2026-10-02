import { useState } from "react";
import { Card } from "@/components/ui/card";
import CalculatorShell, { type RelatedGuide } from "@/components/calculators/CalculatorShell";
import TaxRulesUsed from "@/components/calculators/TaxRulesUsed";
import { Headline, NumberField, Rows, Segmented, fmtDate, inr, num } from "@/components/calculators/fields";
import { capitalGainsTax } from "@/lib/tax-calculators";
import { TAX_RULES, TAX_YEAR_LABEL, pctLabel } from "@/lib/tax-rules";

/** Learning Center articles on capital-gains tax; fill in slugs as they are published. */
export const CAPITAL_GAINS_GUIDES: RelatedGuide[] = [];

const E = TAX_RULES.equity;

/** Long-term equity tax plus cess on a year's net long-term gain, for the worked examples. */
const ltcgTax = (netGain: number) => {
  const taxable = Math.max(0, netGain - E.ltcgExemption.value);
  const tax = taxable * E.ltcgRate.value * (1 + TAX_RULES.cess.value);
  return { taxable, tax };
};

function Example({ caption, head, rows }: { caption: string; head: [string, string]; rows: [string, number, number][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="pb-2 text-left text-xs text-muted-foreground">{caption}</caption>
        <thead>
          <tr className="text-muted-foreground">
            <th scope="col" className="py-2 pr-3 text-left font-medium"><span className="sr-only">Figure</span></th>
            <th scope="col" className="px-3 py-2 text-right font-medium">{head[0]}</th>
            <th scope="col" className="py-2 pl-3 text-right font-medium">{head[1]}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, a, b]) => (
            <tr key={label} className="border-t">
              <th scope="row" className="py-2 pr-3 text-left font-normal text-muted-foreground">{label}</th>
              <td className="px-3 py-2 text-right tabular-nums text-foreground">{inr(a)}</td>
              <td className="py-2 pl-3 text-right tabular-nums text-foreground">{inr(b)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WorkedExamples() {
  // Tax-loss harvesting: ₹2,00,000 of long-term gains booked, a ₹60,000 long-term loss sitting unbooked elsewhere.
  const gains = 200000;
  const loss = 60000;
  const keep = ltcgTax(gains);
  const book = ltcgTax(gains - loss);
  // Using the exemption: bought at ₹4,00,000, worth ₹5,20,000 now and ₹6,40,000 in a later year, no other long-term gains.
  const once = ltcgTax(640000 - 400000);
  const yearOne = ltcgTax(520000 - 400000);
  const yearTwo = ltcgTax(640000 - 520000);
  return (
    <section aria-labelledby="cg-examples" className="mt-8 space-y-4">
      <h2 id="cg-examples" className="text-xl font-bold tracking-tight text-foreground">Two worked illustrations</h2>
      <p className="max-w-prose text-sm text-muted-foreground">
        Numbers only, at the {TAX_YEAR_LABEL} rates above, for someone with no other long-term equity gains that year. Brokerage, STT and other costs of selling and buying back are left out; they reduce both results.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="font-semibold text-foreground">Tax-loss harvesting</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {inr(gains)} of long-term gains already booked this year, and another holding showing a {inr(loss)} long-term loss. A long-term loss can be set off only against long-term gains; if unused, it can be carried forward for {E.lossCarryForwardYears.value} tax years.
          </p>
          <div className="mt-4">
            <Example caption="Long-term gains for the year" head={["Loss not booked", "Loss booked"]} rows={[
              ["Net long-term gain", gains, gains - loss],
              [`Taxable above ${inr(E.ltcgExemption.value)}`, keep.taxable, book.taxable],
              ["Tax with cess", keep.tax, book.tax],
            ]} />
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="font-semibold text-foreground">Using the yearly {inr(E.ltcgExemption.value)} exemption</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Shares bought for {inr(400000)}, worth {inr(520000)} after a year and {inr(640000)} in a later year. Either sold once at the end, or sold and bought back at {inr(520000)} in year one, which resets the cost and restarts the 12-month holding period.
          </p>
          <div className="mt-4">
            <Example caption="Tax on the same total gain" head={["Sold once", "Sold in two years"]} rows={[
              ["Total gain", 240000, 240000],
              ["Taxable", once.taxable, yearOne.taxable + yearTwo.taxable],
              ["Tax with cess", once.tax, yearOne.tax + yearTwo.tax],
            ]} />
          </div>
        </Card>
      </div>
    </section>
  );
}

type Asset = "shares" | "fund";

export default function CapitalGainsTaxCalculatorPage() {
  const [asset, setAsset] = useState<Asset>("shares");
  const [buyDate, setBuyDate] = useState("2024-05-15");
  const [sellDate, setSellDate] = useState("2026-09-15");
  const [cost, setCost] = useState("300000");
  const [sale, setSale] = useState("480000");
  const [fmv, setFmv] = useState("");
  const [otherLtcg, setOtherLtcg] = useState("0");

  const beforeGrandfather = /^\d{4}-\d{2}-\d{2}$/.test(buyDate) && buyDate < E.grandfatherBefore.value;
  const r = capitalGainsTax({ buyDate, sellDate, cost: num(cost), sale: num(sale), fmv2018: beforeGrandfather ? num(fmv) : undefined, otherLtcg: num(otherLtcg) || 0 });
  const unit = asset === "shares" ? "shares" : "units";

  return (
    <CalculatorShell
      path="/capital-gains-tax-calculator"
      name="Capital Gains Tax Calculator"
      seoTitle="Capital Gains Tax Calculator: Shares & Equity Funds"
      description={`Estimate short- and long-term capital gains tax on listed shares and equity mutual funds for ${TAX_YEAR_LABEL}: 20% short-term, 12.5% long-term above ₹1.25 lakh, with cess.`}
      intro={`Tax on selling listed equity shares or equity mutual fund units (STT paid) in ${TAX_YEAR_LABEL}, at the rates in the Income-tax Act, 2025.`}
      relatedGuides={CAPITAL_GAINS_GUIDES}
      notes={
        <>
          An estimate, not tax advice or a tax return. Surcharge is not included (it applies when total income exceeds ₹50 lakh, and is capped at {pctLabel(TAX_RULES.surchargeCapOnGains.value)} on these gains), nor is the use of any unused basic exemption limit by a resident with low other income. Losses from other sales, costs of transfer and your other income are not modelled.
        </>
      }
      faqItems={[
        { question: "How are gains on listed shares taxed in FY 2026-27?", answer: `Held for ${E.longTermAfterMonths.value} months or less: short-term, taxed at ${pctLabel(E.stcgRate.value)}. Held longer: long-term, taxed at ${pctLabel(E.ltcgRate.value)} on gains above ${inr(E.ltcgExemption.value)} in the year. Cess of ${pctLabel(TAX_RULES.cess.value)} is added to the tax.` },
        { question: "What about shares bought before 1 February 2018?", answer: "For a long-term sale, the cost is taken as the higher of the actual cost and the lower of the 31 January 2018 value and the sale value." },
      ]}
    >
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="space-y-4 p-5 lg:col-span-2 lg:self-start">
          <Segmented<Asset> label="What was sold" value={asset} onChange={setAsset} options={[{ value: "shares", label: "Listed shares" }, { value: "fund", label: "Equity fund units" }]} />
          <div className="grid gap-x-3 sm:grid-cols-2">
            <NumberField id="cg-buy-date" label="Bought on" type="date" value={buyDate} onChange={setBuyDate} error={buyDate ? null : "Enter a date"} />
            <NumberField id="cg-sell-date" label="Sold on" type="date" value={sellDate} onChange={setSellDate} error={!sellDate ? "Enter a date" : "error" in r && r.error.startsWith("The sale date") ? r.error : null} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <NumberField id="cg-cost" label="Purchase cost (₹)" value={cost} onChange={setCost} error={num(cost) > 0 ? null : "Enter an amount above 0"} />
            <NumberField id="cg-sale" label="Sale value (₹)" value={sale} onChange={setSale} error={num(sale) >= 0 ? null : "Enter 0 or more"} />
          </div>
          {beforeGrandfather && (
            <NumberField id="cg-fmv" label={`Value on ${fmtDate(E.grandfatherFmvDate.value)} (₹)`} value={fmv} onChange={setFmv}
              hint={`Bought before ${fmtDate(E.grandfatherBefore.value)}: the highest price quoted that day (NAV for fund units) times the ${unit} sold. Leave blank to use the actual cost.`} />
          )}
          <NumberField id="cg-other" label="Other long-term equity gains this year (₹)" value={otherLtcg} onChange={setOtherLtcg}
            hint={`These use up the ${inr(E.ltcgExemption.value)} exemption first.`} />
        </Card>

        <div className="space-y-6 lg:col-span-3" aria-live="polite">
          {"error" in r ? (
            <Card className="p-5 text-sm text-muted-foreground">{r.error}.</Card>
          ) : (
            <Headline label="Estimated tax on this sale" value={inr(r.total)}>
              <Rows rows={[
                { label: "Holding", value: `${r.term === "long" ? "Long-term" : "Short-term"}, ${r.heldDays.toLocaleString("en-IN")} days` },
                ...(r.grandfathered ? [{ label: `Cost used (31 Jan 2018 rule)`, value: inr(r.costUsed) }] : []),
                { label: r.gain < 0 ? "Capital loss" : "Capital gain", value: inr(r.gain) },
                ...(r.term === "long" ? [{ label: "Exemption used", value: inr(r.exemption) }] : []),
                { label: "Taxable gain", value: inr(r.taxable) },
                { label: `Tax at ${pctLabel(r.rate)}`, value: inr(r.tax) },
                { label: `Cess at ${pctLabel(TAX_RULES.cess.value)}`, value: inr(r.cess) },
                { label: "Total", value: inr(r.total), strong: true },
              ]} />
              {r.gain < 0 && (
                <p className="mt-3 text-sm text-muted-foreground">
                  A {r.term}-term loss pays no tax here. {r.term === "short" ? "It can be set off against any capital gains" : "It can be set off only against long-term gains"}, and carried forward for up to {E.lossCarryForwardYears.value} tax years.
                </p>
              )}
            </Headline>
          )}
          <TaxRulesUsed rules={[
            { label: `Short-term (held ${E.longTermAfterMonths.value} months or less)`, value: pctLabel(E.stcgRate.value), rule: E.stcgRate },
            { label: "Long-term", value: `${pctLabel(E.ltcgRate.value)} above ${inr(E.ltcgExemption.value)} a year`, rule: E.ltcgRate },
            { label: "Holding period for long-term", value: `More than ${E.longTermAfterMonths.value} months`, rule: E.longTermAfterMonths },
            { label: "Bought before 1 Feb 2018", value: "Cost stepped up to the 31 Jan 2018 value", rule: E.grandfatherBefore },
            { label: "Health and Education Cess", value: `${pctLabel(TAX_RULES.cess.value)} of the tax`, rule: TAX_RULES.cess },
          ]} />
        </div>
      </div>

      <WorkedExamples />
    </CalculatorShell>
  );
}

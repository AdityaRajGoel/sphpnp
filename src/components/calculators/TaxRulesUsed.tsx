import { ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ACT_2025_PAGE, TAX_YEAR_LABEL, type Rule } from "@/lib/tax-rules";
import { fmtDate } from "./fields";

type Item = { label: string; value: string; rule: Rule<unknown> };

/**
 * The rates a tax calculator used, each with the provision, a link to the
 * official text and the date it was checked. A figure not verified against
 * that text is flagged "check current rate" rather than shown as settled.
 */
export default function TaxRulesUsed({ rules }: { rules: Item[] }) {
  const checked = rules.map((r) => r.rule.asOf).sort().at(-1);
  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold text-foreground">Rates used, {TAX_YEAR_LABEL}</h2>
      <dl className="mt-3 space-y-3">
        {rules.map(({ label, value, rule }) => (
          <div key={label} className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="text-sm sm:text-right">
              <span className="font-medium tabular-nums text-foreground">{value}</span>
              {!rule.verified && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-foreground">check current rate</span>}
              <a href={rule.source} target="_blank" rel="noopener noreferrer" className="block text-xs text-muted-foreground underline-offset-2 hover:text-secondary hover:underline">
                {rule.ref}
              </a>
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
        Checked against the gazetted Acts on {checked ? fmtDate(checked) : "-"}.{" "}
        <a href={ACT_2025_PAGE} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline-offset-2 hover:text-secondary hover:underline">
          Income-tax Act, 2025 on incometax.gov.in <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </a>
      </p>
    </Card>
  );
}

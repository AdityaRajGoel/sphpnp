import { useState } from "react";
import { Plus, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { METRICS, METRIC_BY_ID, METRIC_GROUP_LABEL, RULE_OPS, type MetricGroup, type Rule, type RuleOp } from "@/lib/screener-metrics";

type Props = { rules: Rule[]; onChange: (rules: Rule[]) => void; matches: number };

const GROUPS = Object.keys(METRIC_GROUP_LABEL) as MetricGroup[];

/** Unit hint beside the value box, so "15" is never ambiguous between 15% and 0.15. */
const unitHint = (id: string) => {
  const unit = METRIC_BY_ID.get(id)?.unit;
  return unit === "pct" || unit === "signed_pct" ? "%" : unit === "crore" ? "₹ Cr" : unit === "rupees" ? "₹" : unit === "percentile" ? "0-100" : unit === "sigma" ? "σ" : "";
};

/**
 * Screen on any metric the site holds, including the derived ones: pick a
 * metric, a comparison and a number; every rule must hold. Rules live in the
 * URL, so a custom screen is shareable like the ready-made ones.
 */
export default function CustomFilterBuilder({ rules, onChange, matches }: Props) {
  const [metric, setMetric] = useState("roce");
  const [op, setOp] = useState<RuleOp>(">");
  const [value, setValue] = useState("");

  const add = () => {
    const n = Number(value);
    if (value.trim() === "" || !Number.isFinite(n)) return;
    onChange([...rules.filter((r) => !(r.metric === metric && r.op === op)), { metric, op, value: n }]);
    setValue("");
  };

  return (
    <Card className="p-4 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <SlidersHorizontal className="w-4 h-4" aria-hidden="true" /> Custom screen
          <span className="font-normal">· {METRICS.length} metrics</span>
        </div>
        {rules.length > 0 && <span className="text-xs text-muted-foreground tabular-nums">{matches} match all {rules.length} rule{rules.length > 1 ? "s" : ""}</span>}
      </div>

      <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <Select value={metric} onValueChange={setMetric}>
          <SelectTrigger aria-label="Metric" className="w-full sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent className="max-h-80">
            {GROUPS.map((g) => (
              <SelectGroup key={g}>
                <SelectLabel>{METRIC_GROUP_LABEL[g]}</SelectLabel>
                {METRICS.filter((m) => m.group === g).map((m) => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
        <Select value={op} onValueChange={(v) => setOp(v as RuleOp)}>
          <SelectTrigger aria-label="Comparison" className="w-20"><SelectValue /></SelectTrigger>
          <SelectContent>{RULE_OPS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
        </Select>
        <div className="relative w-32">
          <Input aria-label="Value" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Value" className="pr-12" />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{unitHint(metric)}</span>
        </div>
        <Button type="submit" size="sm" variant="outline" disabled={value.trim() === ""}><Plus className="w-4 h-4 mr-1" /> Add rule</Button>
      </form>
      <p className="mt-2 text-xs text-muted-foreground" title={METRIC_BY_ID.get(metric)?.title}>{METRIC_BY_ID.get(metric)?.title}</p>

      {rules.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Active rules">
          {rules.map((rule) => {
            const m = METRIC_BY_ID.get(rule.metric);
            return (
              <li key={`${rule.metric}${rule.op}`} className="inline-flex items-center gap-1 rounded-lg border border-secondary/40 bg-secondary/10 pl-3 pr-1 py-1 text-xs font-semibold text-secondary">
                <span className="font-mono">{m?.label ?? rule.metric} {rule.op} {rule.value}{unitHint(rule.metric) === "%" ? "%" : ""}</span>
                <button type="button" aria-label={`Remove rule ${m?.label ?? rule.metric} ${rule.op} ${rule.value}`} onClick={() => onChange(rules.filter((r) => r !== rule))} className="rounded p-1 hover:bg-secondary/20">
                  <X className="w-3 h-3" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

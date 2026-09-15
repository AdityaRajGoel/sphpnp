import { useEffect, useMemo, useState } from "react";
import { Code2, Plus, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { METRICS, METRIC_BY_ID, METRIC_GROUP_LABEL, RULE_OPS, type MetricGroup, type Rule, type RuleOp } from "@/lib/screener-metrics";
import { MAX_QUERY_LENGTH, parseQuery } from "@/lib/screener-query";

type Props = {
  rules: Rule[];
  onChange: (rules: Rule[]) => void;
  matches: number;
  query: string;
  onQueryChange: (query: string) => void;
  queryMatches: number | null;
};

const GROUPS = Object.keys(METRIC_GROUP_LABEL) as MetricGroup[];

const EXAMPLE_QUERIES = [
  { label: "Quality at a fair price", q: "ROCE > 20 AND D/E < 0.5 AND P/E < 30" },
  { label: "Growth with margin", q: "(Sales YoY > 15 OR Profit YoY > 20) AND OPM > 15" },
  { label: "Yield beats valuation", q: "Earnings yield > 2 * Div. yield AND Piotroski >= 7" },
  { label: "Oversold quality", q: "RSI < 35 AND ROE > 15 AND NOT D/E > 1" },
];

/** Unit hint beside the value box, so "15" is never ambiguous between 15% and 0.15. */
const unitHint = (id: string) => {
  const unit = METRIC_BY_ID.get(id)?.unit;
  return unit === "pct" || unit === "signed_pct" ? "%" : unit === "crore" ? "₹ Cr" : unit === "rupees" ? "₹" : unit === "percentile" ? "0-100" : unit === "sigma" ? "σ" : "";
};

/**
 * Screen on any metric the site holds, including the derived ones - either by
 * picking rules (every rule must hold) or by typing a query with AND / OR,
 * brackets and arithmetic. Both live in the URL, so a screen is shareable.
 */
export default function CustomFilterBuilder({ rules, onChange, matches, query, onQueryChange, queryMatches }: Props) {
  const [mode, setMode] = useState<"rules" | "query">(query ? "query" : "rules");
  const [metric, setMetric] = useState("roce");
  const [op, setOp] = useState<RuleOp>(">");
  const [value, setValue] = useState("");
  const [draft, setDraft] = useState(query);

  useEffect(() => setDraft(query), [query]);

  const parsed = useMemo(() => (draft.trim() ? parseQuery(draft) : null), [draft]);
  const dirty = draft.trim() !== query.trim();

  const add = () => {
    const n = Number(value);
    if (value.trim() === "" || !Number.isFinite(n)) return;
    onChange([...rules.filter((r) => !(r.metric === metric && r.op === op)), { metric, op, value: n }]);
    setValue("");
  };

  const run = (text = draft) => {
    const p = text.trim() ? parseQuery(text) : null;
    if (text.trim() && !p?.ok) return;
    onQueryChange(text.trim());
  };

  return (
    <Card className="p-4 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <SlidersHorizontal className="w-4 h-4" aria-hidden="true" /> Custom screen
          <span className="font-normal">· {METRICS.length} metrics</span>
        </div>
        <div role="tablist" aria-label="Screen input" className="inline-flex rounded-lg border border-border p-0.5 text-xs font-medium">
          {(["rules", "query"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={`pressable rounded-md px-3 py-1.5 transition-colors ${mode === m ? "bg-secondary text-secondary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              {m === "rules" ? "Pick rules" : "Type a query"}
            </button>
          ))}
        </div>
      </div>

      {mode === "rules" ? (
        <>
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
          <p className="mt-2 text-xs text-muted-foreground">{METRIC_BY_ID.get(metric)?.title}</p>
          {rules.length > 0 && <p className="mt-1 text-xs text-muted-foreground tabular-nums">{matches} match all {rules.length} rule{rules.length > 1 ? "s" : ""}</p>}
        </>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); run(); }}>
          <label htmlFor="screen-query" className="sr-only">Screen query</label>
          <div className="relative">
            <Code2 className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <textarea
              id="screen-query"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); run(); } }}
              rows={3}
              maxLength={MAX_QUERY_LENGTH}
              spellCheck={false}
              aria-invalid={parsed ? !parsed.ok : undefined}
              aria-describedby="screen-query-status"
              placeholder="ROCE > 20 AND Debt to equity < 0.5 AND Market cap > 5000"
              className={`w-full rounded-lg border bg-background py-2.5 pl-9 pr-3 font-mono text-sm leading-relaxed outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${parsed && !parsed.ok ? "border-destructive/60" : parsed?.ok ? "border-secondary/50" : "border-input"}`}
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p id="screen-query-status" aria-live="polite" className={`text-xs ${parsed && !parsed.ok ? "text-destructive" : "text-muted-foreground"}`}>
              {!parsed
                ? "Use metric names or labels, AND / OR / NOT, brackets, and + - * /. Ctrl+Enter runs it."
                : parsed.ok
                  ? `Reads ${parsed.metrics.length} metric${parsed.metrics.length === 1 ? "" : "s"}: ${parsed.metrics.map((m) => m.label).join(", ")}`
                  : `${parsed.error} (at character ${parsed.at + 1})`}
            </p>
            <div className="flex items-center gap-2">
              {query && queryMatches !== null && <span className="text-xs tabular-nums text-muted-foreground">{queryMatches} match</span>}
              {query && <Button type="button" size="sm" variant="ghost" onClick={() => { setDraft(""); onQueryChange(""); }}><X className="mr-1 h-3.5 w-3.5" /> Clear</Button>}
              <Button type="submit" size="sm" disabled={!dirty || (parsed !== null && !parsed.ok)}>Run query</Button>
            </div>
          </div>
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Example queries">
            {EXAMPLE_QUERIES.map((ex) => (
              <li key={ex.label}>
                <button
                  type="button"
                  onClick={() => { setDraft(ex.q); run(ex.q); }}
                  title={ex.q}
                  className="pressable rounded-md border border-dashed border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-secondary/50 hover:text-secondary"
                >
                  {ex.label}
                </button>
              </li>
            ))}
          </ul>
        </form>
      )}

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

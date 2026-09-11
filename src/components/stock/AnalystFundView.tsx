import { motion } from "motion/react";
import { Card } from "@/components/ui/card";
import { revealItem, revealSection } from "@/lib/motion";
import type { TickertapeProfile } from "@/lib/stock-disclosures";

type Holding = TickertapeProfile["holdings"][number];

/** The holder groups of one quarter's split, in the order the bar stacks them. */
const GROUPS: { key: keyof Omit<Holding, "date" | "dii">; label: string; color: string }[] = [
  { key: "promoter", label: "Promoters", color: "bg-primary" },
  { key: "fii", label: "Foreign institutions", color: "bg-sky-500" },
  { key: "mutual_funds", label: "Mutual funds", color: "bg-secondary" },
  { key: "insurance", label: "Insurance", color: "bg-brand-gold" },
  { key: "other_dii", label: "Other domestic institutions", color: "bg-violet-500" },
  { key: "retail", label: "Retail", color: "bg-brand-orange" },
  { key: "others", label: "Others", color: "bg-muted-foreground/50" },
];

const quarter = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" });
const pp = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(2)} pp`;

function BuyRing({ pct }: { pct: number }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 72 72" className="w-20 h-20 shrink-0" role="img" aria-label={`${pct}% of analysts recommend buy`}>
      <circle cx="36" cy="36" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
      <circle cx="36" cy="36" r={r} fill="none" stroke="hsl(var(--secondary))" strokeWidth="8" strokeLinecap="round"
        strokeDasharray={`${(pct / 100) * c} ${c}`} transform="rotate(-90 36 36)" />
      <text x="36" y="40" textAnchor="middle" className="fill-foreground" style={{ fontSize: 15, fontWeight: 700 }}>{Math.round(pct)}%</text>
    </svg>
  );
}

/**
 * What the market's professionals do with the stock, from Tickertape: analyst
 * recommendations, how institutions' holdings have moved quarter to quarter
 * (mutual funds and insurers split out of "domestic institutions"), and the
 * funds holding the most of it.
 */
export default function AnalystFundView({ tickertape, pe }: { tickertape: TickertapeProfile; pe: number | null }) {
  const holdings = tickertape.holdings.slice(-6);
  const latest = holdings[holdings.length - 1];
  const prior = holdings[holdings.length - 2];
  const mfChange = latest?.mutual_funds != null && prior?.mutual_funds != null ? latest.mutual_funds - prior.mutual_funds : null;
  const funds = tickertape.top_funds.slice(0, 6);
  const { analysts, sector, scorecard } = tickertape;
  if (!analysts && holdings.length === 0 && funds.length === 0 && scorecard.length === 0) return null;

  let i = 0;
  return (
    <motion.section {...revealSection} aria-labelledby="analyst-heading" className="space-y-4">
      <h2 id="analyst-heading" className="text-2xl font-bold">Analysts &amp; fund holdings</h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {(analysts || sector.pe !== null) && (
          <motion.div {...revealItem(i++)} className="min-w-0">
            <Card className="p-4 h-full space-y-4">
              {analysts && (
                <div className="flex items-center gap-4">
                  <BuyRing pct={analysts.buy_pct} />
                  <div>
                    <div className="font-semibold">{Math.round(analysts.buy_pct)}% recommend buy</div>
                    <div className="text-sm text-muted-foreground">{analysts.total} analysts cover the stock</div>
                  </div>
                </div>
              )}
              {sector.pe !== null && (
                <div className="text-sm">
                  <div className="text-xs text-muted-foreground mb-1">Valuation vs {sector.name ?? "sector"}</div>
                  <div className="flex justify-between"><span>P/E</span><span className="tabular-nums font-semibold">{pe !== null ? pe.toFixed(1) : "—"} <span className="text-muted-foreground font-normal">vs {sector.pe.toFixed(1)}</span></span></div>
                  {sector.pb !== null && <div className="flex justify-between"><span>Sector P/B</span><span className="tabular-nums">{sector.pb.toFixed(2)}</span></div>}
                  {tickertape.beta !== null && <div className="flex justify-between"><span>Beta</span><span className="tabular-nums">{tickertape.beta.toFixed(2)}</span></div>}
                </div>
              )}
            </Card>
          </motion.div>
        )}

        {holdings.length > 0 && (
          <motion.div {...revealItem(i++)} className="min-w-0 lg:col-span-2">
            <Card className="p-4 h-full">
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                <h3 className="font-semibold text-sm">Who holds the shares, quarter by quarter</h3>
                {latest?.mutual_funds != null && (
                  <span className="text-xs text-muted-foreground">
                    Mutual funds {latest.mutual_funds.toFixed(2)}%
                    {mfChange !== null && <span className={mfChange >= 0 ? "text-secondary" : "text-destructive"}> ({pp(mfChange)})</span>}
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {holdings.map((h) => (
                  <div key={h.date} className="flex items-center gap-2">
                    <span className="w-14 text-xs text-muted-foreground tabular-nums">{quarter(h.date)}</span>
                    <div className="flex-1 flex h-4 rounded overflow-hidden" role="img"
                      aria-label={GROUPS.map((g) => `${g.label} ${(h[g.key] ?? 0).toFixed(1)}%`).join(", ")}>
                      {GROUPS.map((g) => (h[g.key] ?? 0) > 0 && (
                        <div key={g.key} className={g.color} style={{ width: `${h[g.key]}%` }} title={`${g.label}: ${(h[g.key] ?? 0).toFixed(2)}%`} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <ul className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
                {GROUPS.map((g) => (
                  <li key={g.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className={`w-2.5 h-2.5 rounded-sm ${g.color}`} aria-hidden="true" />{g.label}
                    {latest?.[g.key] != null && <span className="tabular-nums text-foreground">{latest[g.key]!.toFixed(1)}%</span>}
                  </li>
                ))}
              </ul>
            </Card>
          </motion.div>
        )}
      </div>

      {(funds.length > 0 || scorecard.length > 0) && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {funds.length > 0 && (
            <motion.div {...revealItem(i++)} className="min-w-0 lg:col-span-2">
              <Card className="p-0 overflow-x-auto h-full">
                <table className="w-full text-sm min-w-[520px]">
                  <caption className="text-left p-3 font-semibold text-sm">Mutual funds holding the most</caption>
                  <thead>
                    <tr className="border-y text-left">
                      <th scope="col" className="px-3 py-2 font-medium">Fund</th>
                      <th scope="col" className="px-3 py-2 font-medium text-right">% of company</th>
                      <th scope="col" className="px-3 py-2 font-medium text-right">% of fund</th>
                      <th scope="col" className="px-3 py-2 font-medium text-right">3-month change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {funds.map((f) => (
                      <tr key={f.name} className="border-b last:border-0">
                        <td className="px-3 py-2">
                          {f.name}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{f.pct_of_company === null ? "—" : `${f.pct_of_company.toFixed(2)}%`}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{f.weight_in_fund === null ? "—" : `${f.weight_in_fund.toFixed(2)}%`}</td>
                        <td className={`px-3 py-2 text-right tabular-nums ${f.change_3m === null ? "text-muted-foreground" : f.change_3m >= 0 ? "text-secondary" : "text-destructive"}`}>
                          {f.change_3m === null ? "—" : pp(f.change_3m)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </motion.div>
          )}
          {scorecard.length > 0 && (
            <motion.div {...revealItem(i++)} className="min-w-0">
              <Card className="p-4 h-full">
                <h3 className="font-semibold text-sm mb-3">Scorecard</h3>
                <dl className="grid grid-cols-2 gap-2">
                  {scorecard.map((s) => (
                    <div key={s.name} className="rounded-lg border p-2" title={s.description ?? undefined}>
                      <dt className="text-xs text-muted-foreground">{s.name}</dt>
                      <dd className={`text-sm font-semibold ${s.tone === "good" ? "text-secondary" : s.tone === "bad" ? "text-destructive" : ""}`}>{s.tag}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
            </motion.div>
          )}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Analyst coverage, holdings and scorecard from market data; not a recommendation by Parasram India.
      </p>
    </motion.section>
  );
}

import { Check, Minus } from "lucide-react";
import { appById } from "@/lib/trading-apps";
import { useT } from "@/i18n/LanguageContext";

/** true = has it, false = does not, null = not listed anywhere we can check, string = a figure. */
type Cell = boolean | string | null;

const money = appById("money");
const trade = appById("trade");

// Only what the apps' own screens, the store listings and the launch posters
// show. The posters announce Tradetron and instant pledge for Parasram Money;
// for the other two that is unconfirmed (Tradetron does connect to XTS
// brokers), so those cells say "not listed" rather than "no".
const ROWS: { key: string; cells: [Cell, Cell, Cell] }[] = [
  { key: "apps.compare.phone", cells: [true, true, false] },
  { key: "apps.compare.web", cells: [true, true, false] },
  { key: "apps.compare.windows", cells: [false, false, true] },
  { key: "apps.compare.depth", cells: [true, true, true] },
  { key: "apps.compare.algo", cells: [true, null, null] },
  { key: "apps.compare.pledge", cells: [true, null, null] },
  { key: "apps.compare.downloads", cells: [money.play.downloads, trade.play.downloads, "—"] },
];

const CellView = ({ value }: { value: Cell }) => {
  const { t } = useT();
  if (typeof value === "string") return <span className="font-semibold tabular-nums text-foreground">{value}</span>;
  if (value === null) return <span className="text-xs text-muted-foreground">{t("apps.compare.notListed")}</span>;
  return value ? (
    <Check className="mx-auto h-5 w-5 text-secondary" aria-label={t("apps.compare.yes")} />
  ) : (
    <Minus className="mx-auto h-5 w-5 text-muted-foreground/50" aria-label={t("apps.compare.no")} />
  );
};

/** Parasram Money, Parasram Trade and MoneyMaker side by side. */
const CompareTable = () => {
  const { t } = useT();
  const cols = [t(money.nameKey), t(trade.nameKey), "MoneyMaker"];
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th scope="col" className="px-5 py-4 text-left font-semibold text-muted-foreground">{t("apps.compare.feature")}</th>
            {cols.map((c, i) => (
              <th key={c} scope="col" className={`px-4 py-4 text-center font-heading text-base font-bold ${i === 0 ? "text-secondary" : "text-foreground"}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => (
            <tr key={r.key} className="border-b border-border/60 last:border-0">
              <th scope="row" className="px-5 py-3.5 text-left font-medium text-foreground">{t(r.key)}</th>
              {r.cells.map((c, i) => (
                <td key={i} className={`px-4 py-3.5 text-center ${i === 0 ? "bg-secondary/[0.04]" : ""}`}><CellView value={c} /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default CompareTable;

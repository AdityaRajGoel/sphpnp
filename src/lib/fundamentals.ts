export type IncomeRow = {
  symbol: string;
  period_end: string;
  is_consolidated: boolean;
  revenue: number | null;
  other_income: number | null;
  total_income: number | null;
  total_expenses: number | null;
  profit_before_tax: number | null;
  profit_after_tax: number | null;
  basic_eps: number | null;
  diluted_eps: number | null;
  debt_equity_ratio: number | null;
  debt_service_coverage_ratio: number | null;
};

export type Basis = "consolidated" | "standalone";

/**
 * Pick one reporting basis and stay on it.
 *
 * Indian companies file both bases for the same quarter, so ordering by
 * period_end alone interleaves them: consolidated revenue in one column and
 * standalone in the next, rendered as a trend, with nothing on screen saying
 * so. Consolidated wins when present because it describes the whole group.
 */
export function selectBasis(rows: IncomeRow[]): {
  basis: Basis | null;
  rows: IncomeRow[];
  bothAvailable: boolean;
} {
  const consolidated = rows.filter((r) => r.is_consolidated);
  const standalone = rows.filter((r) => !r.is_consolidated);
  const bothAvailable = consolidated.length > 0 && standalone.length > 0;
  const chosen = consolidated.length > 0 ? consolidated : standalone;
  const basis: Basis | null =
    chosen.length === 0 ? null : consolidated.length > 0 ? "consolidated" : "standalone";
  const sorted = [...chosen].sort((a, b) => b.period_end.localeCompare(a.period_end));
  return { basis, rows: sorted, bothAvailable };
}

const CRORE = 10_000_000;
const LAKH = 100_000;

/** Indian grouping: 1,28,260 rather than 128,260. */
const group = (n: number): string =>
  n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatINR(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= CRORE) return `${sign}₹${group(abs / CRORE)} Cr`;
  if (abs >= LAKH) return `${sign}₹${group(abs / LAKH)} L`;
  return `${sign}₹${group(abs)}`;
}

export function formatRatio(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return value.toFixed(2);
}

export type Cell =
  | { kind: "value"; text: string }
  | { kind: "missing"; reason: string };

/**
 * Null means the XBRL fact was absent from the filing. That is information, so
 * it is stated rather than hidden - and a real 0 is a value, not a gap.
 */
export function toCell(value: number | null, format: (n: number) => string): Cell {
  if (value === null || !Number.isFinite(value)) {
    return { kind: "missing", reason: "not reported in this filing" };
  }
  return { kind: "value", text: format(value) };
}

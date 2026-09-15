import { METRICS, METRIC_BY_ID, type Metric, type MetricRow } from "@/lib/screener-metrics";

/**
 * A screener.in-style query language over the metric registry:
 *
 *   ROCE > 20 AND Debt to equity < 0.5
 *   (Sales YoY > 15 OR Profit YoY > 20) AND Market cap > 5000
 *   Earnings yield > 2 * Div. yield AND NOT RSI > 70
 *
 * Metrics are named by registry id (`roce`, `debt_to_equity`) or by their
 * label (`ROCE`, `D/E`), case-insensitively, with a few spoken aliases
 * ("Market capitalization", "Debt to equity"). A comparison involving a metric
 * a stock does not have is false for that stock - the same rule every filter
 * on the site follows - so an unknown ROCE never passes "ROCE > 20".
 *
 * Safety: a query is never sent anywhere. It is tokenised against a closed
 * list of metric names, numbers, operators and brackets - anything else is
 * rejected - and evaluated in the browser over rows already loaded, so there
 * is no SQL, no eval and nothing to inject into. It arrives from the URL
 * (`?fx=`), so a shared link is untrusted input: length, token count and
 * bracket depth are capped, because bracket parsing backtracks and an
 * unbounded "((((((..." would otherwise freeze the tab.
 */

export const MAX_QUERY_LENGTH = 400;
export const MAX_QUERY_TOKENS = 120;
export const MAX_BRACKET_DEPTH = 6;

export type Expr =
  | { type: "num"; value: number }
  | { type: "metric"; metric: Metric }
  | { type: "arith"; op: "+" | "-" | "*" | "/"; left: Expr; right: Expr }
  | { type: "neg"; expr: Expr };

export type Cond =
  | { type: "cmp"; op: ">" | ">=" | "<" | "<=" | "=" | "!="; left: Expr; right: Expr }
  | { type: "and" | "or"; left: Cond; right: Cond }
  | { type: "not"; cond: Cond };

export type ParseResult = { ok: true; cond: Cond; metrics: Metric[] } | { ok: false; error: string; at: number };

/** Spoken names people type that differ from a label. */
const ALIASES: Record<string, string> = {
  "market capitalization": "market_cap",
  "market capitalisation": "market_cap",
  "market cap": "market_cap",
  "debt to equity": "debt_to_equity",
  "return on equity": "roe",
  "return on capital employed": "roce",
  "operating profit margin": "opm",
  "price to earning": "pe",
  "price to earnings": "pe",
  "price to book": "pb",
  "dividend yield": "dividend_yield",
  "sales growth": "sales_growth_yoy",
  "profit growth": "profit_growth_yoy",
  "sales growth 3years": "revenue_cagr_3y",
  "profit growth 3years": "profit_cagr_3y",
  "piotroski score": "piotroski_score",
  "current price": "price",
  "rsi": "rsi_14",
  "adx": "adx",
  "beta": "beta_1y",
  "volatility": "volatility_1y",
  "free cash flow yield": "fcf_yield",
  "delivery percentage": "delivery_recent",
};

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/** Every name a metric answers to, longest first, so "ROCE" never swallows a longer label. */
const NAMES: { name: string; metric: Metric }[] = (() => {
  const out = new Map<string, Metric>();
  for (const m of METRICS) {
    out.set(norm(m.id), m);
    out.set(norm(m.id.replace(/_/g, " ")), m);
    out.set(norm(m.label), m);
  }
  for (const [alias, id] of Object.entries(ALIASES)) {
    const m = METRIC_BY_ID.get(id);
    if (m && !out.has(alias)) out.set(alias, m);
  }
  return [...out.entries()].map(([name, metric]) => ({ name, metric })).sort((a, b) => b.name.length - a.name.length);
})();

type Token =
  | { t: "num"; v: number; at: number }
  | { t: "metric"; m: Metric; at: number }
  | { t: "op"; v: string; at: number }
  | { t: "kw"; v: "and" | "or" | "not"; at: number }
  | { t: "(" | ")"; at: number };

const isWordChar = (c: string | undefined) => !!c && /[A-Za-z0-9_]/.test(c);

export function tokenize(input: string): { ok: true; tokens: Token[] } | { ok: false; error: string; at: number } {
  const tokens: Token[] = [];
  let i = 0;
  const lower = input.toLowerCase();
  while (i < input.length) {
    const c = input[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === "(" || c === ")") { tokens.push({ t: c, at: i }); i++; continue; }
    const two = input.slice(i, i + 2);
    if ([">=", "<=", "!=", "==", "<>"].includes(two)) { tokens.push({ t: "op", v: two === "==" ? "=" : two === "<>" ? "!=" : two, at: i }); i += 2; continue; }
    if ("><=+-*/".includes(c)) { tokens.push({ t: "op", v: c, at: i }); i++; continue; }
    const num = /^\d+(?:\.\d+)?/.exec(input.slice(i));
    if (num && !isWordChar(input[i + num[0].length])) { tokens.push({ t: "num", v: Number(num[0]), at: i }); i += num[0].length; continue; }
    const kw = /^(and|or|not)\b/i.exec(input.slice(i));
    if (kw) { tokens.push({ t: "kw", v: kw[1].toLowerCase() as "and" | "or" | "not", at: i }); i += kw[0].length; continue; }
    // Longest metric name that matches here and ends on a word boundary.
    const rest = lower.slice(i).replace(/\s+/g, " ");
    const hit = NAMES.find(({ name }) => rest.startsWith(name) && !(isWordChar(name[name.length - 1]) && isWordChar(rest[name.length])));
    if (hit) {
      // Advance through the original text by the matched length, allowing for collapsed whitespace.
      let consumed = 0, j = i;
      while (consumed < hit.name.length && j < input.length) {
        if (/\s/.test(input[j])) { while (j < input.length && /\s/.test(input[j])) j++; consumed++; } else { j++; consumed++; }
      }
      tokens.push({ t: "metric", m: hit.metric, at: i });
      i = j;
      continue;
    }
    const word = /^[^\s()<>=!+\-*/]+(?:\s[^\s()<>=!+\-*/]+)*/.exec(input.slice(i))?.[0].split(/\s(?:and|or|not)\s|\s*[<>=!]/i)[0] ?? c;
    return { ok: false, error: `Unknown metric "${word.trim().slice(0, 40)}"`, at: i };
  }
  return { ok: true, tokens };
}

export function parseQuery(input: string): ParseResult {
  if (!input.trim()) return { ok: false, error: "Type a condition, e.g. ROCE > 20 AND Debt to equity < 0.5", at: 0 };
  if (input.length > MAX_QUERY_LENGTH) return { ok: false, error: `Queries are limited to ${MAX_QUERY_LENGTH} characters`, at: MAX_QUERY_LENGTH };
  const tk = tokenize(input);
  if (!tk.ok) return tk;
  const tokens = tk.tokens;
  if (tokens.length > MAX_QUERY_TOKENS) return { ok: false, error: `Queries are limited to ${MAX_QUERY_TOKENS} terms`, at: tokens[MAX_QUERY_TOKENS].at };
  let depth = 0;
  for (const t of tokens) {
    depth += t.t === "(" ? 1 : t.t === ")" ? -1 : 0;
    if (depth > MAX_BRACKET_DEPTH) return { ok: false, error: `Brackets can nest at most ${MAX_BRACKET_DEPTH} deep`, at: t.at };
  }
  let pos = 0;
  const peek = () => tokens[pos];
  const fail = (error: string): never => { throw Object.assign(new Error(error), { at: peek()?.at ?? input.length }); };

  const primary = (): Expr => {
    const t = peek();
    if (!t) return fail("The condition ends too early");
    if (t.t === "num") { pos++; return { type: "num", value: t.v }; }
    if (t.t === "metric") { pos++; return { type: "metric", metric: t.m }; }
    if (t.t === "op" && t.v === "-") { pos++; return { type: "neg", expr: primary() }; }
    if (t.t === "(") {
      pos++;
      const e = additive();
      if (peek()?.t !== ")") fail("Missing a closing bracket");
      pos++;
      return e;
    }
    return fail("Expected a metric or a number");
  };
  const multiplicative = (): Expr => {
    let left = primary();
    for (let t = peek(); t?.t === "op" && (t.v === "*" || t.v === "/"); t = peek()) { pos++; left = { type: "arith", op: t.v as "*" | "/", left, right: primary() }; }
    return left;
  };
  const additive = (): Expr => {
    let left = multiplicative();
    for (let t = peek(); t?.t === "op" && (t.v === "+" || t.v === "-"); t = peek()) { pos++; left = { type: "arith", op: t.v as "+" | "-", left, right: multiplicative() }; }
    return left;
  };
  const comparison = (): Cond => {
    // A bracket may open a whole condition or just an arithmetic group; try the condition first.
    if (peek()?.t === "(") {
      const save = pos;
      try {
        pos++;
        const inner = orCond();
        if (peek()?.t === ")") { pos++; return inner; }
      } catch { /* fall back to arithmetic */ }
      pos = save;
    }
    const left = additive();
    const t = peek();
    if (!t || t.t !== "op" || !["<", "<=", ">", ">=", "=", "!="].includes(t.v)) return fail("Expected a comparison such as > or <=");
    pos++;
    return { type: "cmp", op: t.v as Cond extends { op: infer O } ? O : never, left, right: additive() } as Cond;
  };
  const notCond = (): Cond => {
    if (peek()?.t === "kw" && (peek() as { v: string }).v === "not") { pos++; return { type: "not", cond: notCond() }; }
    return comparison();
  };
  const andCond = (): Cond => {
    let left = notCond();
    while (peek()?.t === "kw" && (peek() as { v: string }).v === "and") { pos++; left = { type: "and", left, right: notCond() }; }
    return left;
  };
  const orCond = (): Cond => {
    let left = andCond();
    while (peek()?.t === "kw" && (peek() as { v: string }).v === "or") { pos++; left = { type: "or", left, right: andCond() }; }
    return left;
  };

  try {
    const cond = orCond();
    if (pos < tokens.length) fail("Unexpected text after the condition - join conditions with AND or OR");
    const metrics = [...new Set(tokens.filter((t): t is Extract<Token, { t: "metric" }> => t.t === "metric").map((t) => t.m))];
    return { ok: true, cond, metrics };
  } catch (e) {
    return { ok: false, error: (e as Error).message, at: (e as { at?: number }).at ?? 0 };
  }
}

function evalExpr(e: Expr, row: MetricRow): number | null {
  switch (e.type) {
    case "num": return e.value;
    case "metric": return e.metric.get(row);
    case "neg": { const v = evalExpr(e.expr, row); return v === null ? null : -v; }
    default: {
      const l = evalExpr(e.left, row);
      const r = evalExpr(e.right, row);
      if (l === null || r === null) return null;
      if (e.op === "/") return r === 0 ? null : l / r;
      return e.op === "+" ? l + r : e.op === "-" ? l - r : l * r;
    }
  }
}

/** True when the stock satisfies the condition; any comparison on a missing figure is false. */
export function evaluateQuery(cond: Cond, row: MetricRow | undefined): boolean {
  if (!row) return false;
  switch (cond.type) {
    case "and": return evaluateQuery(cond.left, row) && evaluateQuery(cond.right, row);
    case "or": return evaluateQuery(cond.left, row) || evaluateQuery(cond.right, row);
    case "not": {
      // "NOT RSI > 70" should not pass a stock whose RSI is unknown.
      return hasAllFigures(cond.cond, row) && !evaluateQuery(cond.cond, row);
    }
    default: {
      const l = evalExpr(cond.left, row);
      const r = evalExpr(cond.right, row);
      if (l === null || r === null) return false;
      switch (cond.op) {
        case ">": return l > r;
        case ">=": return l >= r;
        case "<": return l < r;
        case "<=": return l <= r;
        case "=": return Math.abs(l - r) < 1e-9;
        default: return Math.abs(l - r) >= 1e-9;
      }
    }
  }
}

function hasAllFigures(cond: Cond, row: MetricRow): boolean {
  const exprOk = (e: Expr): boolean => e.type === "num" ? true : e.type === "metric" ? e.metric.get(row) !== null : e.type === "neg" ? exprOk(e.expr) : exprOk(e.left) && exprOk(e.right);
  if (cond.type === "cmp") return exprOk(cond.left) && exprOk(cond.right);
  if (cond.type === "not") return hasAllFigures(cond.cond, row);
  return hasAllFigures(cond.left, row) && hasAllFigures(cond.right, row);
}

/** Metric names for autocomplete: the label, then the id when it differs. */
export const QUERY_SUGGESTIONS = METRICS.map((m) => ({ label: m.label, id: m.id, title: m.title, group: m.group }));

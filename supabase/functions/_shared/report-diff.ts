// What moved between a stock's previous AI report and today's. Computed from the
// quant-engine fields, which are deterministic, so a change here is a change in
// the data rather than in how a model happened to phrase it.

// deno-lint-ignore no-explicit-any
type Sd = any;

export type ReportChanges = { since: string; items: string[] };

const SCORE_MOVE = 3;
const TARGET_MOVE_PCT = 2;

export function reportChanges(
  prev: { sd: Sd; price: number | null; createdAt: string } | null,
  next: { sd: Sd; price: number | null },
): ReportChanges | null {
  if (!prev?.sd) return null;
  const a = prev.sd, b = next.sd;
  const items: string[] = [];

  if (a.action_verdict && b.action_verdict && a.action_verdict !== b.action_verdict) {
    items.push(`Verdict moved from ${a.action_verdict} to ${b.action_verdict}`);
  }
  const moved = (label: string, x: unknown, y: unknown) => {
    if (typeof x !== "number" || typeof y !== "number" || Math.abs(y - x) < SCORE_MOVE) return;
    items.push(`${label} ${y > x ? "rose" : "fell"} from ${Math.round(x)} to ${Math.round(y)}`);
  };
  moved("Composite score", a.sentiment_score, b.sentiment_score);
  moved("Technical score", a.score_breakdown?.technical, b.score_breakdown?.technical);
  moved("Fundamental score", a.score_breakdown?.fundamental, b.score_breakdown?.fundamental);
  moved("Confidence", a.confidence, b.confidence);

  const t0 = a.price_targets?.target_3m, t1 = b.price_targets?.target_3m;
  if (typeof t0 === "number" && typeof t1 === "number" && t0 > 0 && Math.abs((t1 - t0) / t0) * 100 >= TARGET_MOVE_PCT) {
    items.push(`3-month target ${t1 > t0 ? "raised" : "cut"} from ₹${Math.round(t0)} to ₹${Math.round(t1)}`);
  }
  if (prev.price && next.price) {
    const pct = ((next.price - prev.price) / prev.price) * 100;
    if (Math.abs(pct) >= 0.1) items.push(`Price ${pct > 0 ? "up" : "down"} ${Math.abs(pct).toFixed(1)}% since then (₹${prev.price} → ₹${next.price})`);
  }
  return { since: prev.createdAt, items: items.length ? items : ["No material change in the verdict, scores or targets"] };
}

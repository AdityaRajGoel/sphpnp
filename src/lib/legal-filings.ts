import { supabase } from "@/integrations/supabase/client";

export type LegalTopic = "Insolvency & tribunals" | "Court & litigation" | "Tax & penalties" | "Regulatory action" | "Auditor & governance" | "Credit rating" | "Disruption";

export type LegalFiling = {
  id: string;
  topic: LegalTopic;
  subject: string;
  summary: string | null;
  url: string | null;
  published_at: string | null;
  /** True when the filing's own text marks it as an adverse event rather than routine. */
  adverse: boolean;
};

type RawFiling = { news_id: string; subject: string | null; summary: string | null; subcategory?: string | null; attachment_url: string | null; published_at: string | null };

/**
 * Topic patterns, most specific first: a filing about an NCLT hearing on a
 * merger scheme is "Insolvency & tribunals", not "Court & litigation". Word
 * boundaries keep "fine" from matching "define" and "order" is deliberately
 * absent - "order" alone is far more often a sales order than a legal one.
 */
const TOPICS: { topic: LegalTopic; test: RegExp }[] = [
  { topic: "Insolvency & tribunals", test: /\b(NCLT|NCLAT|insolvency|IBC|CIRP|liquidat\w*|resolution professional|tribunal|DRT|SAT)\b/i },
  { topic: "Court & litigation", test: /\b(litigation|lawsuit|high court|supreme court|court|arbitra\w*|writ petition|petition|legal proceeding\w*|dispute\w*|FIR|summons)\b/i },
  { topic: "Tax & penalties", test: /\b(penalt\w*|fine[sd]?|show[- ]cause|demand notice|demand order|tax demand|GST|income[- ]tax|assessment order|search (and seizure|operation)|DGGI|enforcement directorate|ED)\b/i },
  { topic: "Regulatory action", test: /\b(SEBI order|adjudicat\w*|settlement order|warning letter|administrative warning|non[- ]compliance|debarr\w*|suspension of trading|RBI (penalty|action)|CCI|competition commission)\b/i },
  { topic: "Auditor & governance", test: /\b(resignation of (statutory )?auditor\w*|auditor\w* resign\w*|qualified opinion|forensic audit|fraud|whistle[- ]?blower|default\w*)\b/i },
  { topic: "Credit rating", test: /\b(credit rating|rating (downgrade|reaffirm\w*|revis\w*|withdraw\w*)|downgrad\w*)\b/i },
  { topic: "Disruption", test: /\b(strike\w*|lockout\w*|disturbance\w*|fire|accident|plant shutdown|cyber ?(attack|security incident)|ransomware)\b/i },
];

const ADVERSE = /\b(penalt\w*|fine[sd]?|show[- ]cause|demand|downgrad\w*|default\w*|fraud|resign\w*|insolvency|CIRP|liquidat\w*|debarr\w*|strike|lockout|fire|accident|search|seizure|ransomware|attack|qualified)\b/i;

/** Routine filings that mention a trigger word in passing: newspaper notices of AGMs, trading windows. */
const ROUTINE = /\b(trading window|analyst|investor meet|earnings call|record date|book closure|loss of share certificate)\b/i;

export function classifyFiling(f: RawFiling): LegalFiling | null {
  const text = [f.subject, f.subcategory, f.summary].filter(Boolean).join(" · ");
  if (!text || ROUTINE.test(text)) return null;
  const match = TOPICS.find((t) => t.test.test(text));
  if (!match) return null;
  return {
    id: f.news_id,
    topic: match.topic,
    subject: (f.subject ?? "").replace(/^Announcement under Regulation 30 \(LODR\)-/i, "").trim() || match.topic,
    summary: f.summary,
    url: f.attachment_url && /^https:\/\/(www\.)?bseindia\.com\//.test(f.attachment_url) ? f.attachment_url : null,
    published_at: f.published_at,
    adverse: ADVERSE.test(text),
  };
}

const table = (name: string) => supabase.from(name as never) as ReturnType<typeof supabase.from>;

/** Legal, tax, regulatory and governance filings for one listed symbol, newest first. */
export async function getLegalFilings(symbol: string, limit = 300): Promise<LegalFiling[]> {
  const { data, error } = await table("bse_announcements")
    .select("news_id,subject,summary,subcategory,attachment_url,published_at")
    .eq("symbol", symbol.toUpperCase())
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as RawFiling[]).map(classifyFiling).filter((f): f is LegalFiling => f !== null);
}

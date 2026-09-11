import { motion } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { revealSection } from "@/lib/motion";
import { webHref, type BseAnnouncement } from "@/lib/stock-disclosures";

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";

/** The company's latest announcements filed with BSE, each linking to its PDF at the exchange. */
export default function BseAnnouncements({ items, bseCode }: { items: BseAnnouncement[]; bseCode: string | null }) {
  if (items.length === 0) return null;
  return (
    <motion.section {...revealSection} aria-labelledby="announcements-heading">
      <h2 id="announcements-heading" className="text-2xl font-bold mb-4">Company announcements</h2>
      <Card className="divide-y">
        {items.map((a) => {
          const href = webHref(a.attachment_url);
          const body = (
            <>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                {a.category && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">{a.category}</span>}
                {a.critical && <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">Price-sensitive</span>}
                <time className="text-xs text-muted-foreground" dateTime={a.published_at ?? undefined}>{when(a.published_at)}</time>
              </div>
              <div className="font-medium text-sm flex items-start gap-1">
                <span className="group-hover:text-primary transition-colors">{a.subject}</span>
                {href && <ArrowUpRight className="w-3.5 h-3.5 mt-0.5 shrink-0 opacity-60" aria-hidden="true" />}
              </div>
              {a.summary && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.summary}</p>}
            </>
          );
          return href ? (
            <a key={a.news_id} href={href} target="_blank" rel="noopener noreferrer nofollow" className="group block p-4 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{body}</a>
          ) : <div key={a.news_id} className="p-4">{body}</div>;
        })}
      </Card>
      <p className="mt-3 text-xs text-muted-foreground">
        Filed with BSE{bseCode ? ` (scrip ${bseCode})` : ""}; the last 45 days. Documents open at bseindia.com.
      </p>
    </motion.section>
  );
}

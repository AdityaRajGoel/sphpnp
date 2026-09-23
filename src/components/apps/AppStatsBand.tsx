import { Star } from "lucide-react";
import { appById, STORE_STATS_AS_OF, totalPlayDownloads } from "@/lib/trading-apps";
import { useT } from "@/i18n/LanguageContext";
import { fill, HTML_LANG } from "@/i18n/config";

const money = appById("money");
const trade = appById("trade");
// Android, iPhone, web and the Windows desktop terminal.
const WAYS_TO_TRADE = 4;

/**
 * Both apps' real Google Play figures side by side: the combined download
 * floor, Parasram Trade's rating, Parasram Money's downloads. Parasram Money
 * has no rating yet, so no star figure is shown for it.
 */
const AppStatsBand = () => {
  const { t, lang } = useT();
  const date = new Date(`${STORE_STATS_AS_OF}T00:00:00+05:30`).toLocaleDateString(HTML_LANG[lang], {
    day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata",
  });
  const stats = [
    { value: totalPlayDownloads(), label: t("apps.stats.total") },
    {
      value: (
        <span className="inline-flex items-center gap-1.5">
          {trade.play.rating}
          <Star className="h-6 w-6 fill-brand-gold text-brand-gold md:h-7 md:w-7" aria-label="stars" />
        </span>
      ),
      label: fill(t("apps.stats.tradeRating"), { reviews: trade.play.reviews ?? 0 }),
    },
    { value: money.play.downloads, label: t("apps.stats.money") },
    { value: WAYS_TO_TRADE, label: t("apps.stats.ways") },
  ];

  return (
    <section aria-label={t("apps.stats.label")} className="border-b border-border bg-card">
      <div className="container mx-auto px-4 py-8 md:py-10">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-4">
          {stats.map((s, i) => (
            <div key={i} className="flex flex-col-reverse gap-1.5 border-l-2 border-secondary/60 pl-4">
              <dt className="text-sm text-muted-foreground">{s.label}</dt>
              <dd className="font-heading text-3xl font-bold tabular-nums text-foreground md:text-4xl">{s.value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-6 text-xs text-muted-foreground">{fill(t("apps.stats.asOf"), { date })}</p>
      </div>
    </section>
  );
};

export default AppStatsBand;

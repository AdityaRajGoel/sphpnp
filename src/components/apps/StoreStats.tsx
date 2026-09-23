import { Star } from "lucide-react";
import type { TradingApp } from "@/lib/trading-apps";
import { useT } from "@/i18n/LanguageContext";
import { fill } from "@/i18n/config";

type Props = { app: TradingApp; className?: string };

/**
 * The app's real Google Play figures (see STORE_STATS_AS_OF). An app with no
 * rating says so rather than showing an empty or invented star score.
 */
const StoreStats = ({ app, className = "" }: Props) => {
  const { t } = useT();
  const { downloads, rating, reviews } = app.play;
  return (
    <p className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-sm ${className}`}>
      {rating !== undefined && reviews !== undefined ? (
        <span className="inline-flex items-center gap-1 font-semibold">
          <Star className="h-4 w-4 fill-brand-gold text-brand-gold" aria-hidden />
          {fill(t("store.rating"), { rating, reviews })}
        </span>
      ) : (
        <span className="font-semibold">{t("store.notRated")}</span>
      )}
      <span aria-hidden className="opacity-40">·</span>
      <span className="opacity-80">{fill(t("store.downloads"), { downloads })}</span>
    </p>
  );
};

export default StoreStats;

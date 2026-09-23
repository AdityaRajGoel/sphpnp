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
        <span className="font-semibold">{fill(t("store.rating"), { rating, reviews })}</span>
      ) : (
        <span className="font-semibold">{t("store.notRated")}</span>
      )}
      <span aria-hidden className="opacity-40">·</span>
      <span className="opacity-80">{fill(t("store.downloads"), { downloads })}</span>
    </p>
  );
};

export default StoreStats;

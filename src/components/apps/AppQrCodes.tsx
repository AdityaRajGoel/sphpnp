import type { TradingApp } from "@/lib/trading-apps";
import { useT } from "@/i18n/LanguageContext";
import { fill } from "@/i18n/config";
import { APP_QR } from "./appMedia";

type Props = { app: TradingApp; className?: string };

/**
 * One code per store: a QR can't pick the store for the phone that scans it,
 * and a redirect page would need a server rule the static host doesn't have.
 * Hidden on phones, where the store buttons beside it are one tap away.
 */
const AppQrCodes = ({ app, className = "" }: Props) => {
  const { t } = useT();
  const codes = [
    { platform: t("store.android"), src: APP_QR[app.id].android, href: app.playHref },
    { platform: t("store.iphone"), src: APP_QR[app.id].ios, href: app.iosHref },
  ];
  return (
    <div className={`hidden md:flex gap-3 ${className}`}>
      {codes.map((c) => (
        <a
          key={c.platform}
          href={c.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={fill(t("store.scanAria"), { app: t(app.nameKey), platform: c.platform })}
          className="group flex flex-col items-center gap-1.5"
        >
          <span className="rounded-xl bg-white p-1.5 shadow-md ring-1 ring-black/5 transition-transform duration-fast ease-out group-hover:scale-105">
            <img src={c.src} alt={`QR code to download ${app.name} on ${c.href === app.playHref ? "Android (Google Play)" : "iPhone (App Store)"}`} width={84} height={84} loading="lazy" decoding="async" className="h-[84px] w-[84px]" />
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-wide opacity-80">{c.platform}</span>
        </a>
      ))}
    </div>
  );
};

export default AppQrCodes;

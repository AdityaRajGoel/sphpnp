import type { ReactNode } from "react";
import { Code2, Download, ExternalLink, FileText, Monitor, Smartphone, Sparkles } from "lucide-react";
import StoreButtons from "./StoreButtons";
import {
  appById, MONEYMAKER_DOWNLOAD_URL, MONEYMAKER_INSTALLER_URL, TRADE_GUIDES, TRADEX_DOCS_URL, XTS_DESKTOP,
} from "@/lib/trading-apps";
import { useT } from "@/i18n/LanguageContext";

const money = appById("money");
const trade = appById("trade");

const Row = ({ icon: Icon, label, children }: { icon: typeof Monitor; label: string; children: ReactNode }) => (
  <div className="flex gap-4 border-t border-border/70 py-5 first:border-0 first:pt-0">
    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground"><Icon className="h-4 w-4" aria-hidden /></span>
    <div className="min-w-0 flex-1">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <div className="mt-1.5">{children}</div>
    </div>
  </div>
);

const Ext = ({ href, children }: { href: string; children: ReactNode }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:text-secondary hover:underline">
    {children} <ExternalLink className="h-3 w-3" aria-hidden />
  </a>
);

/**
 * The two platforms as they are paired in practice: Parasram Money with the
 * MoneyMaker desktop and the TradeX API (new), Parasram Trade with the
 * Symphony XTS desktop (earlier). Both stay on offer; the new one leads.
 */
const PlatformLineup = () => {
  const { t } = useT();
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <article className="relative overflow-hidden rounded-3xl border-2 border-secondary/60 bg-card p-6 shadow-lg md:p-8">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-secondary-foreground">
          <Sparkles className="h-3 w-3" aria-hidden /> {t("apps.platforms.new")}
        </span>
        <h3 className="mt-3 font-heading text-2xl font-bold text-foreground">{t(money.nameKey)}</h3>
        <div className="mt-6">
          <Row icon={Smartphone} label={t("apps.platforms.mobile")}>
            <StoreButtons app={money} tone="onLight" size="sm" />
            <div className="mt-2"><Ext href={money.webHref}>money.parasramindia.com</Ext></div>
          </Row>
          <Row icon={Monitor} label={t("apps.platforms.desktop")}>
            <p className="font-semibold text-foreground">MoneyMaker</p>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
              <Ext href={MONEYMAKER_DOWNLOAD_URL}>{t("apps.desktop.download")}</Ext>
              <Ext href={MONEYMAKER_INSTALLER_URL}>{t("apps.platforms.mmInstaller")}</Ext>
            </div>
          </Row>
          <Row icon={Code2} label={t("apps.platforms.api")}>
            <p className="font-semibold text-foreground">TradeX API</p>
            <div className="mt-1"><Ext href={TRADEX_DOCS_URL}>{t("apps.platforms.tradexDocs")}</Ext></div>
          </Row>
        </div>
      </article>

      <article className="rounded-3xl border border-border bg-card p-6 md:p-8">
        <span className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{t("apps.platforms.classic")}</span>
        <h3 className="mt-3 font-heading text-2xl font-bold text-foreground">{t(trade.nameKey)}</h3>
        <div className="mt-6">
          <Row icon={Smartphone} label={t("apps.platforms.mobile")}>
            <StoreButtons app={trade} tone="onLight" size="sm" />
            <div className="mt-2"><Ext href={trade.webHref}>webtrade.parasramindia.com</Ext></div>
          </Row>
          <Row icon={Monitor} label={t("apps.platforms.desktop")}>
            <p className="font-semibold text-foreground">Symphony XTS</p>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
              <Ext href={XTS_DESKTOP.x64}><Download className="h-3.5 w-3.5" aria-hidden />{t("apps.platforms.xts64")}</Ext>
              <Ext href={XTS_DESKTOP.x32}>{t("apps.platforms.xts32")}</Ext>
            </div>
          </Row>
          <Row icon={FileText} label={t("apps.platforms.guides")}>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <Ext href={TRADE_GUIDES.app}>{t("apps.platforms.guideApp")}</Ext>
              <Ext href={TRADE_GUIDES.web}>{t("apps.platforms.guideWeb")}</Ext>
            </div>
          </Row>
        </div>
      </article>
    </div>
  );
};

export default PlatformLineup;

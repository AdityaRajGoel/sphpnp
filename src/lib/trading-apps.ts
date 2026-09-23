import { TRADING_PLATFORMS } from "@/lib/trading-platforms";

/**
 * The two mobile apps and their store listings. One list, read by the header's
 * Apps menu, the /apps page, the Services teaser, the footer and the floating
 * download button, so a changed listing is changed once.
 */
export type AppId = "money" | "trade";

export type TradingApp = {
  id: AppId;
  name: string;
  /** One line under the name. */
  tagline: string;
  playHref: string;
  iosHref: string;
  /** The same account in a browser - taken from the Web Trade menu's list. */
  webHref: string;
  /** i18n key for the name (the Hindi UI writes it in Devanagari). */
  nameKey: "cta.parasramMoney" | "cta.parasramTrade";
  isNew?: boolean;
  /** Google Play listing figures, read off the store page on STORE_STATS_AS_OF. */
  play: { downloads: string; rating?: number; reviews?: number };
};

/** When the store figures were read. Update the figures and this together. */
export const STORE_STATS_AS_OF = "2026-09-23";

/**
 * Desktop apps and developer links, all served by Parasram or its vendors
 * (checked live 2026-09-23). Two platforms: Parasram Money (new) pairs with
 * the MoneyMaker desktop and the TradeX API (Saral); Parasram Trade (the older
 * app) pairs with the Symphony XTS desktop.
 */
export const SOFTWARE_SETUPS_URL = "https://www.parasramindia.com/software-setups/";
export const MONEYMAKER_DOWNLOAD_URL = SOFTWARE_SETUPS_URL;
/** ClickOnce installer for MoneyMaker Solo - the setups page links the same file. */
export const MONEYMAKER_INSTALLER_URL = "https://money.parasramindia.com:8088/IBT/MoneyMakerSolo.application";
export const XTS_DESKTOP = {
  x64: "https://www.parasramindia.com/downloads/XTS-64bit.exe",
  x32: "https://www.parasramindia.com/downloads/XTS-32Bit.exe",
} as const;
export const TRADE_GUIDES = {
  app: "https://www.parasramindia.com/downloads/Parasram-Mobile-App-Overview.pdf",
  web: "https://www.parasramindia.com/downloads/Web-Trade-Overview.pdf",
} as const;
/** Saral's TradeX API reference (REST, JWT) for Parasram Money accounts. */
export const TRADEX_DOCS_URL = "https://www.saral-info.com/tradex";

const webHref = (labelKey: (typeof TRADING_PLATFORMS)[number]["labelKey"]) =>
  TRADING_PLATFORMS.find((p) => p.labelKey === labelKey)!.href;

export const TRADING_APPS: readonly TradingApp[] = [
  {
    id: "money",
    name: "Parasram Money",
    tagline: "Our new app: algo trading, instant pledge, option chain and more",
    playHref: "https://play.google.com/store/apps/details?id=com.saral_info.moneymakerapi.parasrammoney",
    iosHref: "https://apps.apple.com/in/app/parasram-money/id6753166585",
    webHref: webHref("cta.parasramMoney"),
    nameKey: "cta.parasramMoney",
    isNew: true,
    // No rating yet on either store (Play shows none; the App Store reports 0 ratings).
    play: { downloads: "1,000+" },
  },
  {
    id: "trade",
    name: "Parasram Trade",
    tagline: "The Symphony XTS app our clients have traded on for years",
    playHref: "https://play.google.com/store/apps/details?id=com.parasramindia.xts",
    iosHref: "https://apps.apple.com/us/app/parasram-trade/id1564728869",
    webHref: webHref("cta.parasramTrade"),
    nameKey: "cta.parasramTrade",
    play: { downloads: "10,000+", rating: 3.9, reviews: 256 },
  },
];

export const appById = (id: AppId): TradingApp => TRADING_APPS.find((a) => a.id === id)!;

/** "1,000+" -> 1000. Play shows download counts as floor buckets. */
const parseDownloads = (s: string) => Number(s.replace(/[^\d]/g, "")) || 0;

/** Both apps' Play download floors added up, formatted the way Play writes them: "11,000+". */
export const totalPlayDownloads = (apps: readonly TradingApp[] = TRADING_APPS): string =>
  `${apps.reduce((sum, a) => sum + parseDownloads(a.play.downloads), 0).toLocaleString("en-IN")}+`;

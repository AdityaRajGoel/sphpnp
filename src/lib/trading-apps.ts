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
  isNew?: boolean;
};

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
    isNew: true,
  },
  {
    id: "trade",
    name: "Parasram Trade",
    tagline: "The Symphony XTS app our clients have traded on for years",
    playHref: "https://play.google.com/store/apps/details?id=com.parasramindia.xts",
    iosHref: "https://apps.apple.com/us/app/parasram-trade/id1564728869",
    webHref: webHref("cta.parasramTrade"),
  },
];

export const appById = (id: AppId): TradingApp => TRADING_APPS.find((a) => a.id === id)!;

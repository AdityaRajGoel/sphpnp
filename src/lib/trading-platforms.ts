/**
 * The two trading platforms the Web Trade button offers. One list, read by the
 * header, the mobile menu and the hero, so the three cannot drift apart.
 */
export type TradingPlatform = {
  /** i18n key for the platform's name. */
  labelKey: "cta.parasramTrade" | "cta.parasramMoney";
  href: string;
  /** Shown under the name so the two are told apart at a glance. */
  host: string;
};

export const TRADING_PLATFORMS: readonly TradingPlatform[] = [
  { labelKey: "cta.parasramTrade", href: "https://webtrade.parasramindia.com/#!/app", host: "webtrade.parasramindia.com" },
  { labelKey: "cta.parasramMoney", href: "https://money.parasramindia.com:28001/", host: "money.parasramindia.com" },
];

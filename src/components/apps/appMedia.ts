import type { AppId } from "@/lib/trading-apps";

import moneyWatchlist from "@/assets/parasram-money/parasram-money-app-watchlist.webp";
import moneyWatchlistDark from "@/assets/parasram-money/parasram-money-app-watchlist-dark-mode.webp";
import moneyStockDetails from "@/assets/parasram-money/parasram-money-app-stock-market-depth.webp";
import moneyOptionChain from "@/assets/parasram-money/parasram-money-app-option-chain.webp";
import moneyTechnicals from "@/assets/parasram-money/parasram-money-app-technicals.webp";
import moneyDiscover from "@/assets/parasram-money/parasram-money-app-discover-top-gainers.webp";
import moneyTradetron from "@/assets/parasram-money/parasram-money-tradetron-algo-trading.webp";
import moneyPledge from "@/assets/parasram-money/parasram-money-instant-margin-pledge.webp";
import moneyDesktop from "@/assets/parasram-money/moneymaker-desktop-trading-terminal.webp";
import tradeMarket from "@/assets/parasram-trade/parasram-trade-app-market-overview.webp";
import tradeMarketWatch from "@/assets/parasram-trade/parasram-trade-app-market-watch.webp";
import tradeLadder from "@/assets/parasram-trade/parasram-trade-app-price-ladder.webp";
import tradeStockDetails from "@/assets/parasram-trade/parasram-trade-app-market-depth.webp";
import qrMoneyAndroid from "@/assets/qr/money-android.svg";
import qrMoneyIos from "@/assets/qr/money-ios.svg";
import qrTradeAndroid from "@/assets/qr/trade-android.svg";
import qrTradeIos from "@/assets/qr/trade-ios.svg";

export type Screen = { src: string; alt: string };

// Phone screenshots come from each app's App Store listing, 460 x 996.
export const SCREEN_SIZE = { width: 460, height: 996 } as const;

export const MONEY_HERO: Screen = { src: moneyWatchlist, alt: "Parasram Money app watchlist screen with Nifty 50 and Sensex prices and a Bank Nifty stock list" };
export const MONEY_HERO_BACK: Screen = { src: moneyOptionChain, alt: "Parasram Money app option chain for Reliance showing calls and puts with open interest and implied volatility" };

export const MONEY_SCREENS: Screen[] = [
  MONEY_HERO,
  { src: moneyWatchlistDark, alt: "Parasram Money app watchlist in dark mode" },
  { src: moneyStockDetails, alt: "Parasram Money app stock details screen with market depth and buy and sell buttons" },
  MONEY_HERO_BACK,
  { src: moneyTechnicals, alt: "Parasram Money app technicals tab with weekly to yearly price change and OHLC" },
  { src: moneyDiscover, alt: "Parasram Money app Discover tab with top gainers, IPO and back office shortcuts" },
];

export const TRADE_HERO: Screen = { src: tradeMarket, alt: "Parasram Trade (Symphony XTS) app market screen with Sensex, Nifty 50 and a sector performance heat map" };

export const TRADE_SCREENS: Screen[] = [
  TRADE_HERO,
  { src: tradeMarketWatch, alt: "Parasram Trade app market watch list with stocks, futures and options" },
  { src: tradeLadder, alt: "Parasram Trade app price ladder for placing one-tap buy and sell orders" },
  { src: tradeStockDetails, alt: "Parasram Trade app scrip screen with buy, sell, market depth and OHLC" },
];

// Launch posters, 1280 x 960.
export const MONEY_FEATURES = [
  {
    id: "tradetron",
    titleKey: "apps.feature.tradetron.title",
    bodyKey: "apps.feature.tradetron.body",
    image: { src: moneyTradetron, alt: "Tradetron no-code algo trading now available on the Parasram Money app: build, backtest, deploy and trade strategies" },
  },
  {
    id: "margin-pledge",
    titleKey: "apps.feature.pledge.title",
    bodyKey: "apps.feature.pledge.body",
    image: { src: moneyPledge, alt: "Instant margin pledge on the Parasram Money app: pledge holdings from the Portfolio screen without a back-office login" },
  },
] as const;

export const DESKTOP_SHOT = { src: moneyDesktop, width: 1600, height: 859 } as const;

export const DESKTOP_VIDEO = {
  hd: "/videos/moneymaker-desktop-1080.mp4",
  sd: "/videos/moneymaker-desktop-720.mp4",
  poster: "/videos/moneymaker-desktop-tour-thumbnail.webp",
  width: 1920,
  height: 1078,
} as const;

export const APP_QR: Record<AppId, { android: string; ios: string }> = {
  money: { android: qrMoneyAndroid, ios: qrMoneyIos },
  trade: { android: qrTradeAndroid, ios: qrTradeIos },
};

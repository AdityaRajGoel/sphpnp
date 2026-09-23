import type { AppId } from "@/lib/trading-apps";

import moneyWatchlist from "@/assets/parasram-money/watchlist.webp";
import moneyWatchlistDark from "@/assets/parasram-money/watchlist-dark.webp";
import moneyStockDetails from "@/assets/parasram-money/stock-details.webp";
import moneyOptionChain from "@/assets/parasram-money/option-chain.webp";
import moneyTechnicals from "@/assets/parasram-money/technicals.webp";
import moneyDiscover from "@/assets/parasram-money/discover.webp";
import moneyTradetron from "@/assets/parasram-money/tradetron.webp";
import moneyPledge from "@/assets/parasram-money/margin-pledge.webp";
import moneyDesktop from "@/assets/parasram-money/desktop.webp";
import tradeMarket from "@/assets/parasram-trade/market.webp";
import tradeMarketWatch from "@/assets/parasram-trade/market-watch.webp";
import tradeLadder from "@/assets/parasram-trade/ladder.webp";
import tradeStockDetails from "@/assets/parasram-trade/stock-details.webp";
import qrMoneyAndroid from "@/assets/qr/money-android.svg";
import qrMoneyIos from "@/assets/qr/money-ios.svg";
import qrTradeAndroid from "@/assets/qr/trade-android.svg";
import qrTradeIos from "@/assets/qr/trade-ios.svg";

export type Screen = { src: string; alt: string };

// Phone screenshots come from each app's App Store listing, 460 x 996.
export const SCREEN_SIZE = { width: 460, height: 996 } as const;

export const MONEY_HERO: Screen = { src: moneyWatchlist, alt: "Parasram Money watchlist with Nifty 50 and Sensex" };
export const MONEY_HERO_BACK: Screen = { src: moneyOptionChain, alt: "Parasram Money option chain with OI and IV" };

export const MONEY_SCREENS: Screen[] = [
  MONEY_HERO,
  { src: moneyWatchlistDark, alt: "Parasram Money watchlist in dark mode" },
  { src: moneyStockDetails, alt: "Stock details with market depth, buy and sell" },
  MONEY_HERO_BACK,
  { src: moneyTechnicals, alt: "Technicals tab with price changes and OHLC" },
  { src: moneyDiscover, alt: "Discover tab with top gainers, IPO and back office" },
];

export const TRADE_HERO: Screen = { src: tradeMarket, alt: "Parasram Trade market screen with Sensex, Nifty and sector performance" };

export const TRADE_SCREENS: Screen[] = [
  TRADE_HERO,
  { src: tradeMarketWatch, alt: "Parasram Trade market watch with futures and options" },
  { src: tradeLadder, alt: "Parasram Trade price ladder for one-tap orders" },
  { src: tradeStockDetails, alt: "Parasram Trade stock details with market depth" },
];

// Launch posters, 1280 x 960.
export const MONEY_FEATURES = [
  {
    id: "tradetron",
    title: "Tradetron algo trading, no code",
    body: "Build a strategy from if-then blocks, backtest it on past data, then let it run on your Parasram Money account 24x7.",
    image: { src: moneyTradetron, alt: "Tradetron is now available on Parasram Money: build, backtest, deploy and trade" },
  },
  {
    id: "margin-pledge",
    title: "Instant margin pledge",
    body: "Pledge holdings for margin straight from the Portfolio tab. No back-office login, no forms.",
    image: { src: moneyPledge, alt: "Instant margin pledge from the Holdings screen of Parasram Money" },
  },
] as const;

export const DESKTOP_SHOT = { src: moneyDesktop, width: 1600, height: 859 } as const;

export const DESKTOP_VIDEO = {
  hd: "/videos/moneymaker-desktop-1080.mp4",
  sd: "/videos/moneymaker-desktop-720.mp4",
  poster: "/videos/moneymaker-desktop-poster.webp",
  width: 1920,
  height: 1078,
} as const;

export const APP_QR: Record<AppId, { android: string; ios: string }> = {
  money: { android: qrMoneyAndroid, ios: qrMoneyIos },
  trade: { android: qrTradeAndroid, ios: qrTradeIos },
};

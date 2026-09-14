# Data sources

What the site reads, where from, and which free sources are worth adding next.
Written 2026-09-11. "Free" means no paid plan; a key may still be needed.

## In use

| Data | Source | Cost / limit | Where |
| --- | --- | --- | --- |
| Live quotes, 52-week range, market cap | Yahoo Finance chart / quote API | Free, unofficial | `fetch-stock-prices`, `fetch-screener-data` |
| Quarterly / annual statements, ratios, shareholding (80 stocks) | IndianAPI (`stock.indianapi.in`) | Key; HTTP 429 after ~480 calls | `sync-stock-statements` |
| Statements and key stats (163 stocks) | Google Finance via SerpApi | 250 searches/month (25 kept in reserve) | `sync-google-finance` |
| Screener fundamentals (ROE, ROCE, OPM, growth, D/E, P/B, yield) | Derived from the two above - no extra calls | Free | `build-screener-fundamentals` |
| Income from filings (XBRL) | NSE result-filing RSS + XBRL | Free | `sync-fundamentals` |
| Corporate actions, announcements, results feed | NSE RSS (browser User-Agent required) | Free | `sync-announcements` |
| Delivery %, circuit hitters | NSE bhavcopy (EOD) | Free | `sync-bhavcopy` |
| IPO catalogue, GMP | IPO Watch, InvestorGain, Chittorgarh | Free (scraped) | `sync-ipos` |
| IPO details, subscription, RHP/DRHP | Chittorgarh issue pages (Apify fallback) | Free / Apify credits | `sync-ipo-details` |
| IPO pipeline (DRHP/RHP filings) | SEBI filings pager | Free | `sync-ipo-pipeline` |
| SEBI orders, buybacks, open offers, rights | SEBI listing search | Free | `sync-sebi-actions` |
| Per-stock and per-IPO news; ticker headlines | Google News RSS search | Free, keyless | `stock-news`, `sync-ipo-details`, `ticker-feed` |
| Market news page | Publisher RSS feeds | Free | `fetch-news` |
| Mutual fund NAVs | AMFI NAVAll.txt | Free | `sync-market-feed` |
| Macro indicators, INR exchange rates | World Bank Open Data; Frankfurter (ECB rates) | Free, keyless | `sync-macro` |
| Statements, 12-quarter shareholding, ratios, growth, pros/cons, documents, BSE codes (every stock) | screener.in company pages | Free (scraped, ~3 s apart) | `sync-screener-in` |
| Corporate actions, shareholding-pattern filings, insider trades (every stock) | NSE JSON API (browser User-Agent) | Free | `sync-nse-disclosures` |
| Company announcements | BSE announcements API (by scrip code) | Free | `sync-bse-announcements` |
| Analyst coverage, MF/insurance holding split, top fund holders, scorecard | Tickertape stock pages | Free (scraped) | `sync-tickertape` |

## Worth adding (free)

Items 1-6 below were added on 2026-09-11 (see the table above; the NSE results sync now makes eight calls a run). Kept for the record.

1. **NSE financial results XBRL, all companies.** The result-filing RSS already
   gives an XBRL link per filing; parsing it for every tracked stock (not only
   the sync cursor's two per hour) would give fresh quarterly figures for all
   246 stocks without spending IndianAPI or SerpApi calls. Highest value.
2. **BSE corporate announcements API** (`api.bseindia.com/BseIndiaAPI/api/AnnSubCategoryGetData`).
   Covers BSE-only companies and carries a category per filing, which would
   sharpen the ticker's "material filing" filter. Needs a browser Referer.
3. **NSE corporate actions by symbol** (`/api/corporates-corporateActions?index=equities&symbol=`).
   82 of 246 stocks currently show no dividends or splits because the RSS
   names companies, not symbols; the per-symbol endpoint closes that gap.
4. **NSE shareholding pattern XBRL** (`/api/corporate-share-holdings-master`).
   Quarterly promoter / FII / DII / public split for every stock, where only
   IndianAPI's 80 have it today.
5. **NSE insider trading (PIT) and SAST disclosures** (`/api/corporates-pit`).
   Promoter buying and selling - a signal the stock page does not yet show.
6. **NSE bulk and block deals** (`/api/snapshot-capital-market-largedeal`) -
   already partly used on the screener; per-stock history would suit the stock page.
7. **AMFI monthly portfolio disclosures.** Which funds hold a stock and how
   holdings moved - "mutual fund interest" on the stock page.
8. **RBI DBIE** for bank-specific ratios (GNPA, CASA) not in any statement feed.

## Researched 2026-09-14: repos, libraries and sources to reuse

### koala73/worldmonitor - licence matters

The current repo is **AGPL-3.0**. Copying its code into this closed-source site
would oblige us to publish the site's source to its users. It was **MIT** from
`2b70374` (2026-02-13) until `be485ad` (2026-02-19); the last MIT tree is
commit `572f3808565d4312bcb8973c883b3a56fb5cb619`. Code from that snapshot may be
reused with its MIT notice kept. Nothing from later commits.

What that snapshot has that suits an Indian terminal (all keyless unless noted):

| Piece (MIT snapshot) | What it does | Indian adaptation |
| --- | --- | --- |
| `api/macro-signals.js` | Risk-on/off verdict from JPY 30d ROC (liquidity), QQQ/XLP 20d ROC (regime), BTC SMA50/200 + Mayer multiple, alternative.me Fear & Greed | Same shape on Yahoo symbols we already fetch: USDINR, ^INDIAVIX, Nifty vs Nifty FMCG (risk appetite), Brent, US 10Y, DXY |
| `api/stock-index.js` | Weekly change for ~45 countries' main index via Yahoo | Extends Global cues past EODHD's free tier |
| `api/etf-flows.js` | Estimated ETF flow direction from price × volume | Nifty BeES, Gold BeES, Bank BeES, PSU and Silver ETFs |
| `api/fred-data.js`, `api/eia/*` | FRED macro series; EIA oil inventories (EIA key, free) | US rates/oil inventories as global cues |
| `api/coingecko.js`, `api/stablecoin-markets.js` | Crypto prices, stablecoin supply | Only if a crypto page is wanted |
| `src/config/variants/finance.ts` | ~40 finance RSS / Google News feeds (central banks, bonds, commodities, IPO, M&A) | Swap the query terms for RBI, SEBI, Indian bonds, MCX, Indian IPOs |

### NSE/BSE data libraries (Python; run from the GitHub Actions producer, per HANDOFF §2)

- [nselib](https://github.com/RuchiTanmay/nselib) (Apache-2.0): option chain, FII derivatives statistics, F&O daily volatility, bhavcopies.
- [jugaad-data](https://github.com/jugaad-py/jugaad-data): historical stock/index data from the new NSE site, plus RBI data, with a built-in cache.
- [nsepython](https://github.com/aeron7/nsepython): successor to nsepy/nsetools; index, option-chain and FII/DII endpoints.
- [nsefin](https://pypi.org/project/nsefin/): option chains and FII/DII activity as DataFrames.
- ICICI [Breeze API](https://www.icicidirect.com/futures-and-options/api/breeze): three years of F&O historical OHLC/OI free with an ICICI account. The only free *historical option* source found.

### Verified 2026-09-14 (with agent-reach and direct requests)

- **NSE provisional FII/DII cash activity** - `https://www.nseindia.com/api/fiidiiTradeReact`. Works with a browser
  User-Agent after fetching the homepage for cookies; returns buy/sell/net ₹ crore for FII/FPI and DII. Used by
  `fetch-fii-dii` (needs deploying). A daily sync writing it to a table would give a flow history.
- **IPO listing prices are not collected.** All 68 listed IPOs in the catalogue have a listing date and size but no
  listing price or gain. Filling them from `eq_eod` (listing-day open/close) via `nse_ipos.symbol` would complete the
  IPO hub's listing-performance figures.
- **FBIL** (MIBOR, T-bill and G-sec benchmarks) and **RBI's reference-rate archive** render through JavaScript and
  ASP.NET postbacks; a reader gets no data. Both need a browser-driven job (Playwright on GitHub Actions) or RBI's
  DBIE downloads.
- **CCIL tenor-wise yields** URL now 404s.

### Research tooling: agent-reach

[agent-reach](https://github.com/Panniantong/agent-reach) (MIT) is installed for research only, in
`~/.agent-reach-venv` (`~/.agent-reach-venv/bin/agent-reach doctor`). Working with no setup: any web page via
Jina Reader (`curl https://r.jina.ai/<url>`), RSS, V2EX, Bilibili search. Exa web search needs
`agent-reach install --env=auto --system` (installs `mcporter` globally), and Twitter/Reddit need the user's own
cookies. It is an agent tool, not a production scraper: nothing on the site depends on it.

### Chart and indicator libraries

No new dependency added. KLineChart (already shipped) has ~26 built-in indicators, and the ones it lacks
(Supertrend, ATR, Donchian, Keltner, Ichimoku, rolling VWAP) are ~150 lines in `src/lib/chart-indicators.ts`.
If a backtest engine is ever needed: [trading-signals](https://github.com/bennycode/trading-signals) (streaming
indicators, MIT) or [indicatorts](https://github.com/cinar/indicatorts) (zero-dependency, includes backtesting).

screener.in and Tickertape are scraped at the owner's instruction (2026-09-11),
politely paced; both sites' terms restrict automated access, so if either
objects or blocks us, their syncs should be switched off. Tickertape's search
API answers 403 to Supabase's servers, so stock pages are found through a
resolved list (`_shared/tickertape-slugs.ts`) and the stocks sitemap. AMFI has
no per-stock holdings feed (only per-AMC monthly spreadsheets); fund holdings
come from Tickertape instead.

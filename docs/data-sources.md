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

screener.in and Tickertape are scraped at the owner's instruction (2026-09-11),
politely paced; both sites' terms restrict automated access, so if either
objects or blocks us, their syncs should be switched off. Tickertape's search
API answers 403 to Supabase's servers, so stock pages are found through a
resolved list (`_shared/tickertape-slugs.ts`) and the stocks sitemap. AMFI has
no per-stock holdings feed (only per-AMC monthly spreadsheets); fund holdings
come from Tickertape instead.

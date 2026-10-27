# Data feeds: what is collected, what is unused, what can be added

Written 27 October 2026, from the code and AnythingMCP's adapter catalog (v0.50.0). Live
checks of the source sites are pending: see "Still to measure".

## Collected but not shown

| Data | Written by | Read by | Feed it could become |
|---|---|---|---|
| `pledge_snapshots`: promoter pledges per shareholding filing | `sync-market-data` | nothing | Rising-pledge watch: companies whose pledged share of promoter holding went up since the last filing |
| `nse_result_filings`: every results filing with its XBRL link | `sync-announcements` | nothing | Results-filed-today feed, and a results calendar |
| `nse_announcements` | `sync-announcements` | the ticker strip only | Announcements page and per-company feed |
| `nse_corporate_actions` | `sync-announcements` | the ticker strip only | Ex-date calendar (dividend, bonus, split, buyback) |
| `shareholding_pattern` | nothing | nothing | Empty table; drop it or fill it |

All are already exposed as AnythingMCP tools (`infra/vps/anythingmcp/tools.json`), and
`stock_event_feed` joins them with insider trades, bulk/block deals, SEBI actions and
surveillance flags into one timeline per stock. The same SQL can back a page or a
Telegram alert.

## AnythingMCP adapters worth installing

From the 561 adapters in the catalog, the ones relevant to an Indian broker:

| Adapter | Key | What it adds | Note |
|---|---|---|---|
| `finnhub` | `FINNHUB_API_KEY`, already held | quotes, profiles, news, earnings, 22 tools | coverage of NSE symbols depends on the plan |
| `twelve-data` | `TWELVEDATA_API_KEY`, already held | quotes, time series, technical indicators, 19 tools | |
| `serpapi` | `SERPAPI_API_KEY`, already held | Google Finance and Google News results, 11 tools | metered; `sync-google-finance` already budgets it |
| `apify` | `APIFY_API_KEY`, already held | run ready-made scrapers, 12 tools | how `sync-ipo-details` already reads pages |
| `tradingview` | a TradingView login (OAuth) | screener for India, financial history, analyst forecasts, earnings, dividend and economic calendars, 35 tools | for research inside Claude; its terms are unlikely to allow republishing on the site |
| `fxmacrodata` | none for USD, key for INR | central-bank rates, macro release calendars | |
| `coingecko`, `binance`, `coinbase` | none | crypto prices | only if crypto content is wanted |

Installing one is a click in the AnythingMCP catalog, then assigning it to the `sphpnp`
MCP server; no code. These call the vendor directly, so they are research tools for an
AI client, not data the site stores.

## What the endpoint discovery found (27 Oct 2026)

`scripts/discover-endpoints.mts` loaded 23 source pages in Chromium from a residential IP,
recorded each page's own JSON requests (HARs analysed with REA), and re-requested every one
with a plain fetch. Findings that matter, each re-checked from the VPS:

| Source | Endpoint | Plain fetch | Use |
|---|---|---|---|
| InvestorGain GMP table | `webnodejs.investorgain.com/cloud/v2/report/data-read/331/...` | yes | **In use** by `sync-ipos`; the headless browser stays as its fallback |
| Chittorgarh IPO lists | `webnodejs.chittorgarh.com/cloud/report/data-read/82/.../{mainboard,sme}/0` | yes | **In use** by `sync-ipos`; the whole calendar year, not the first 50 rows |
| InvestorGain | `.../cloud/v2/ipo/ipo-url-lists` | yes | 2,175 IPOs since 2019 (name, slug, open/close dates): a backfill source |
| Stockify unlisted | `production.stockifyfintech.co.in/api/v1/company/top-gainer/un-listed?page=N` | yes | ~100 companies with ISIN, PAN, 52-week high/low, sector, DRHP status; `sync-unlisted-quotes` still parses the page's RSC payload |
| Screener.in | `/api/company/<id>/chart/?q=Price-DMA50-DMA200-Volume&days=365` | yes | price, 50/200-DMA and volume history per company |
| Tickertape | `gms-api.tickertape.in/quotes/IN/latest?sids=...` | yes | batch live quotes by Tickertape id |
| AMFI | `/api/latest-nav-category?mfid=all` | yes | category list only; NAVs still come from NAVAll.txt |

No JSON behind: SEBI offer documents, BSE (home, announcements, quote, public issues),
NSDL FPI, Moneycontrol IPO, MCX market watch (it needs full Chromium, see `host-mcx.mts`).
NSE pages refuse a headless browser outright (HTTP/2 protocol error); the NSE APIs the
syncs already call are unaffected. Nifty Indices timed out.

Re-run after a source breaks: `node --experimental-strip-types scripts/discover-endpoints.mts`
(or the `discover-endpoints.yml` workflow); `DISCOVERY_TARGETS` takes a JSON list of pages.

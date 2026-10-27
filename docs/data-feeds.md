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

## Still to measure

`scripts/discover-endpoints.mts` (workflow `discover-endpoints.yml`) loads each source
page (NSE, BSE, MCX, Nifty Indices, SEBI, NSDL, AMFI, the IPO and fundamentals sites,
and Moneycontrol and BSE public issues as new candidates), records the JSON each one
requests, checks whether a plain fetch gets the same JSON, and lists every host that
served data with whether a sync already uses it. REA analyses each capture. It has not
run yet: it needs the branch pushed (or the sites allowed from the dev environment).

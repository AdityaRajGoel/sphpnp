# AnythingMCP: the market data as MCP tools

[AnythingMCP](https://github.com/HelpCode-ai/anythingmcp) is a self-hosted MCP gateway.
Here it gives an AI client (Claude, ChatGPT, Cursor) read-only tools over the data the
syncs have already collected: IPOs and their GMP, the SEBI filing pipeline, fundamentals,
statements, a screener and the Kronos forecast bands.

It does not scrape. AnythingMCP turns REST, SOAP, GraphQL and SQL sources into tools and
has no HTML parser, so the scrapers stay where they are and this reads what they stored.

## Tools

| Tool | Reads |
|---|---|
| `ipo_list` | `ipos` + latest `ipo_gmp_snapshots`, by status and board |
| `ipo_details` | one IPO, its last 30 GMP readings and its `nse_ipos` record |
| `ipo_pipeline` | `ipo_pipeline` (DRHP / UDRHP / RHP filings) |
| `stock_fundamentals` | profile, quote, summary ratios, latest derived ratios and scores |
| `stock_financials` | `fundamentals_income` joined to balance sheet and derived ratios |
| `stock_statement` | one `stock_statements` grid |
| `screen_stocks` | `screener_stocks` + `stock_fundamentals_summary`, optional filters |
| `stock_forecast` | `stock_forecasts_latest`, with its disclaimer |
| `corporate_announcements` | `nse_announcements`, newest first |
| `corporate_actions_upcoming` | `nse_corporate_actions` by ex-date (IST) |
| `promoter_pledges` | `pledge_snapshots`, latest filing per company and the change since the one before |
| `insider_trades` | `nse_insider_trades` (SEBI PIT disclosures) |
| `bulk_block_deals` | `bulk_block_deals`, with value in crore |
| `results_filings` | `nse_result_filings` |
| `stock_event_feed` | one timeline per symbol across all of the above, SEBI actions and surveillance flags |

`pledge_snapshots` and `nse_result_filings` are collected nightly but nothing on the site
reads them yet, and announcements and corporate actions only feed the ticker strip; these
tools are the first consumers.

AnythingMCP adds `execute_query` (model-written SQL, single SELECT only),
`get_database_schema` and `get_example_queries` to every database connector. They run as
the same role.

The definitions are in `tools.json`. Each SQL template binds its parameters (`$symbol`
becomes `$1`); nothing is spliced into the text.

## Access

The connector logs in as `mcp_reader`, which `setup.sh` creates. It inherits `anon`, so it
reads exactly what the public anon key in the website bundle already reads, through the
same RLS policies, and nothing else. Every session is read-only; a write, including one
through a security-definer function, fails. Checked against a local copy of these
migrations: public tables read, `revoke`d tables refused, writes refused.

## Install

```sh
bash infra/vps/anythingmcp/setup.sh       # secrets, mcp_reader, containers
ssh -L 8460:127.0.0.1:8460 -L 8461:127.0.0.1:8461 sphpnp-vps
```

Open <http://localhost:8460> and register. The first account is the admin and
registration then closes. Then load the connector and tools, and issue a key:

```sh
cd /opt/sphpnp-anythingmcp
read -rs pw && printf '%s' "$pw" | AMCP_EMAIL=you@example.com node connect.mjs --new-key; unset pw
```

`connect.mjs` is safe to re-run after editing `tools.json`; it updates by name. It prints
the MCP endpoint (`/mcp/<server id>`) and, with `--new-key`, a key shown once.

## Connecting a client

Both ports are bound to 127.0.0.1. Through the SSH tunnel, a local client can use:

```json
{
  "mcpServers": {
    "sphpnp": {
      "type": "http",
      "url": "http://localhost:8461/mcp/<server id>",
      "headers": { "X-API-Key": "<key from connect.mjs>" }
    }
  }
}
```

A client in the cloud (claude.ai, ChatGPT) needs an HTTPS hostname: an nginx site for
`mcp.sphpnp.com` proxying to 127.0.0.1:8461, with `AMCP_PUBLIC_API_URL` and
`AMCP_PUBLIC_UI_URL` in `.env` set to the public URLs. That is not set up.

## Keep

`.env` holds `ENCRYPTION_KEY`, which decrypts the stored connection; without it the
connector must be re-created. `data/postgres` holds users, keys and the audit log of every
tool call.

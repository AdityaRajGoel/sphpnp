# Shri Parasram Holdings Panipat

Production website for **Shri Parasram Holdings Pvt. Ltd. Panipat**, a SEBI-registered stockbroker
operating in Panipat, Haryana since 1970.

**Live:** [www.sphpnp.com](https://www.sphpnp.com)

Beyond a marketing site, this is a client-facing market-data application: live NSE prices,
an AI-assisted equity research tool, a stock screener, an F&O dashboard, and a set of
investor calculators — backed by Supabase Postgres and Deno edge functions.

---

## Features

| Area | What it does |
|---|---|
| **AI stock analysis** | Multi-provider research reports and Q&A over live market data, with a fallback cascade across OpenRouter, Groq, Gemini and Cerebras |
| **Market data** | Live quotes, charts, F&O dashboard, circuit watch, bulk/block deals, FII/DII flows, IPO tracker, results calendar |
| **Screener** | Filterable equity screener over an EOD bhavcopy dataset synced nightly from NSE |
| **Calculators** | Brokerage, margin, and SIP calculators |
| **Content** | Blog/articles, learning centre, daily research, Telegram-driven announcements |
| **Compliance** | Investor Corner, SEBI disclosures, policy documents, holiday calendar |
| **Admin** | Password-gated panels for unlisted shares, banners, and site content |

The site is server-prerendered at build time for SEO, ships as a PWA, and supports
multiple languages.

---

## Tech stack

**Frontend** : Vite · React 18 · TypeScript · Tailwind CSS · shadcn/ui · React Router ·
TanStack Query · Recharts · Zod

**Backend** : Supabase (Postgres + Auth + Storage) and 14 Deno edge functions

**Infra** : Vercel (hosting) · GitHub Actions (CI + scheduled data syncs) · Docker + nginx
(self-host option)

---

## Getting started

Requires **Node.js 22+**.

```sh
git clone https://github.com/AdityaRajGoel/sphpnp
cd sphpnp
npm install
cp .env.example .env    # then fill in your Supabase values
npm run dev
```

The dev server runs on <http://localhost:8080>.

### Environment

Only `VITE_*` variables belong in `.env`. They are **embedded in the client bundle and are
public by design** — the Supabase anon key is safe to expose because every table is
protected by Row Level Security.

```sh
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-public-key
VITE_SUPABASE_PROJECT_ID=your-project-id
```

Server-side secrets are **never** stored in this repo or in `.env`. They are read via
`Deno.env` inside edge functions and set as Supabase secrets:

```sh
supabase secrets set OPENROUTER_API_KEY=...   # primary AI provider
supabase secrets set GROQ_API_KEY=...         # + _SECOND/_THIRD/_FOURTH for quota rotation
supabase secrets set GEMINI_API_KEY=...       # + _SECOND
supabase secrets set SYNC_SECRET=...          # guards the scheduled sync functions
supabase secrets set TELEGRAM_BOT_TOKEN=...
supabase secrets set TELEGRAM_WEBHOOK_SECRET=...
supabase secrets set ADMIN_PASSWORD=...
```

See [`.env.example`](.env.example) for the full annotated list.

---

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server with HMR |
| `npm run build` | Production build, then sitemap + prerender + IndexNow submit |
| `npm run preview` | Serve the production build locally |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | End-to-end tests (Playwright) |
| `npm run lint` | ESLint |
| `npm run analyze` | Build with bundle-size visualiser |

---

## Project structure

```
src/
├── components/        # 55 feature components + ui/ (49 shadcn primitives), admin/, header/
├── pages/             # 33 routed pages
├── hooks/             # shared React hooks
├── integrations/      # Supabase client + generated DB types
├── i18n/              # language context and config
└── lib/               # utilities

supabase/
├── functions/         # 14 Deno edge functions
└── migrations/        # SQL schema migrations

scripts/               # sitemap generation, prerendering, IndexNow
e2e/                   # Playwright specs
```

### Edge functions

Data fetchers (`fetch-*`) proxy and cache third-party market data. Sync jobs
(`sync-market-feed`, `sync-bhavcopy`) are triggered on a cron by GitHub Actions and write
with the service-role key — both are guarded by `SYNC_SECRET`. `ai-stock-analysis` runs the
provider cascade and is rate-limited per client. `telegram-webhook` ingests channel posts
and verifies Telegram's `X-Telegram-Bot-Api-Secret-Token`.

---

## Testing & CI

CI runs on every push to `main` and on pull requests: typecheck, unit tests, production
build, Playwright smoke tests, and a Docker image build. Two scheduled workflows trigger
the NSE data syncs on weekday evenings (IST).

```sh
npm test           # unit
npm run test:e2e   # e2e (builds first)
npx tsc --noEmit   # typecheck
```

---

## Self-hosting

```sh
docker compose up --build   # → http://localhost:8090
```

Builds the Vite app and serves it via nginx.

---

## Security

- Every Postgres table has **Row Level Security** enabled; the anon key grants no
  privileged access.
- Privileged work happens in edge functions using the service-role key, which is injected
  by the Supabase runtime and never committed.
- Functions running with `verify_jwt = false` (`telegram-webhook`, `sync-*`) authenticate
  via their own shared secrets and **fail closed** if those secrets are unset.
- No credentials belong in this repository. `.env` is gitignored, and a pre-commit hook
  (`scripts/check-secrets.mjs`) blocks staged credentials before they can reach history.

Found a security issue? Report it privately to
[contact@adityarajgoel.com](mailto:contact@adityarajgoel.com) — see [`SECURITY.md`](SECURITY.md).
Please don't open a public issue.

---

## Regulatory & compliance

Operated by **Shri Parasram Holdings Pvt. Ltd.** (trading as *Parasram India*) : Panipat
branch, Shakuntala Complex, Palika Bazaar, Panipat, Haryana.

### Registrations

| Body | Registration |
|---|---|
| SEBI : Stock Broker (NSE, BSE, MCX & MSEI) | INZ000220838 |
| SEBI : Commodity (MCX & NCDEX) | INZ000033839 |
| CDSL (Depository Participant) | IN-DP-47-2015 · DP ID 12058200 |
| NSDL (Depository Participant) | IN-DP-NSDL-194-2001 · DP ID IN302365 |
| AMFI (Mutual Fund Distributor) | ARN-35616 |
| CIN | U67120DL1994PTC060726 |

Verified against the official disclosure published on
[parasramindia.com](https://www.parasramindia.com).

### Compliance officer

**Mr. Vivek Sheel Aggarwal** · [compliance@sphpl.com](mailto:compliance@sphpl.com)
011-47000044 / 9999796260 (Corporate Office) · Mon–Sat, 9:00–18:00 IST

### Investor grievance redressal

Escalate in order:

1. **Branch / Compliance Officer** : [compliance@sphpl.com](mailto:compliance@sphpl.com)
2. **Stock exchange** : [NSE Investor Helpline](https://investorhelpline.nseindia.com/) ·
   [BSE Investor Services](https://www.bseindia.com/investor.html)
3. **SEBI SCORES** : [scores.sebi.gov.in](https://scores.sebi.gov.in) (if unresolved after 30 days)
4. **Online Dispute Resolution** : [smartodr.in](https://smartodr.in/login)

Other channels: KYC helpdesk 011-4700-0000 (ext. 64/65/66) ·
[kyc@sphpl.com](mailto:kyc@sphpl.com) · trading-account freeze:
[stoptrade@sphpl.com](mailto:stoptrade@sphpl.com)

The site's [Investor Corner](https://www.sphpnp.com/investor-corner) carries the full
SEBI-mandated disclosures, investor charter, and firm-level policy documents. See also
[Terms of Use](https://www.sphpnp.com/terms), [Privacy Policy](https://www.sphpnp.com/privacy-policy),
[Disclaimer](https://www.sphpnp.com/disclaimer), and [Cookie Policy](https://www.sphpnp.com/cookie-policy).

### Risk disclosure

> Investments in the securities market are subject to market risks. Read all related
> documents carefully before investing.

Nothing in this repository including any content, calculator, market data, or AI-generated
output constitutes investment advice or a recommendation to buy or sell any security.
Market data may be delayed, incomplete, or inaccurate. Past performance is not indicative of
future results. No assured returns are guaranteed.

> **Note:** the identifiers above were cross-checked against the official disclosure on
> [parasramindia.com](https://www.parasramindia.com). They are reproduced here for reference
> only — the authoritative versions remain those published by the firm and by the respective
> regulator and exchange websites.

---

## License

**Proprietary all rights reserved.** See [`LICENSE`](LICENSE).

> This repository is **publicly viewable but not open source.**

You may read the source and examine it for security research. You may **not** copy, deploy,
modify, redistribute, reproduce its look and feel, or use it to train machine-learning
models. The Licensor's regulatory identifiers and trade marks are reserved and may not be
reused. Third-party dependencies remain under their own licenses.

Licensing enquiries: [contact@adityarajgoel.com](mailto:contact@adityarajgoel.com)

Nothing here constitutes investment advice.

---

## Contact

| Topic | Contact |
|---|---|
| This repository — security, licensing, corrections | [contact@adityarajgoel.com](mailto:contact@adityarajgoel.com) |
| Panipat branch — accounts, services, general queries | [anil@sphpnp.com](mailto:anil@sphpnp.com) |
| Compliance Officer — Mr. Vivek Sheel Aggarwal | [compliance@sphpl.com](mailto:compliance@sphpl.com) |

Contributions: see [`CONTRIBUTING.md`](CONTRIBUTING.md) — external pull requests are not
accepted. Security: see [`SECURITY.md`](SECURITY.md).

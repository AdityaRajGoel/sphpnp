# Handoff — where the work stands and how to continue

**Last updated:** 2026-09-11 (see §0 for what changed since 2026-09-09)
**Purpose:** Let a different model or session (Codex, a fresh Claude session, a human) pick this up
without re-deriving context or re-litigating settled decisions.

Read this file top to bottom before touching anything. The "Settled decisions" section exists
specifically so you don't reopen questions the user has already answered.

---

## 0. Update 2026-09-11 - data sources and what is live

Everything below §0 predates this update; where they disagree, §0 wins.

**Stock fundamentals** no longer come from NSE XBRL (frozen at Dec 2024) or Yahoo:
- `sync-stock-statements` (IndianAPI, primary) -> `stock_statements` + `stock_profiles`.
  Screener-layout quarterly/annual/balance/cash flow/ratios, key metrics, DMAs,
  shareholding. Identity-guarded (NSE code + revenue or all-quarter EPS). Its
  plan returned HTTP 429 after ~480 requests; schedule is commented out in
  `stock-statements-sync.yml` until the user states the plan's limit.
- `sync-google-finance` (SerpApi, fallback) -> `gf_*` statements + key stats for
  stocks IndianAPI missed. 250 searches/month, keeps 25 in reserve.
- Stock pages show IndianAPI's statements if present, else Google's; the NSE
  tables are the last fallback.

**IPOs**: status is derived from dates (`_shared/ipo-status.ts`); one row per
issue via `ipoMatchKey` + self-healing merges (`_shared/ipo-identity.ts`);
`sync-ipo-details` reads each live issue's Chittorgarh page (minimum investment
as published - SME minimum is two lots - plus every section), Apify's
rag-web-browser as the fallback fetch.

**Fixed traps**: NSE feeds need a browser UA (a `+https://` bot UA makes Deno
report an HTTP/2 stream error); every `onConflict` is checked against the
migrations by `src/test/upsert-conflict-keys.test.ts`; the Docker HEALTHCHECK
now probes 127.0.0.1 and CI smoke-tests the image on every push.

## 1. What this repo is

Production site for **Shri Parasram Holdings Pvt. Ltd. Panipat**, a SEBI-registered stockbroker.
Live at `www.sphpnp.com`. It is not just a marketing site — it is a client-facing market-data
application (live NSE quotes, AI equity research, screener, F&O dashboard, calculators).

- **Frontend:** Vite · React 18 · TypeScript · Tailwind · shadcn/ui · React Router · TanStack Query
- **Backend:** Supabase (Postgres + Auth + Storage) + ~20 Deno edge functions in `supabase/functions/`
- **Infra:** Vercel · GitHub Actions for scheduled data syncs · prerendered at build time for SEO

**The larger goal the user has stated:** build this into a Screener.in + Bloomberg hybrid for Indian
markets (NSE/BSE/MCX) — a large analytics suite plus broad exchange data ingestion.

---

## 2. Settled decisions — do NOT reopen these

The user has already decided these. Treat them as constraints, not as open questions.

| Decision | Value | Why it matters |
|---|---|---|
| **Python runtime** | **GitHub Actions runners** | Scrapling / TradingAgents / FinceptTerminal are Python; Deno edge functions cannot run Python. The user chose GH Actions over Vercel Python Functions or a separate service. Consequence: **Python is a scheduled producer only** — no on-demand or interactive Python. Anything user-triggered stays in Deno/TS. |
| **IPO page scope** | **Full build** | Both tables + sync workflow + `/ipo` hub + `/ipo/:slug` detail. Chosen specifically because GMP history cannot be backfilled — it only accrues once you start recording. |
| **Build order** | Animation bug first (done), then the rest **side by side** | User explicitly asked for parallel progress across remaining tracks. |
| **Scope of the platform ask** | Not to be re-litigated | The user was told once that the ~25-module ask is multi-quarter and reaffirmed it twice. Do not repeat the "this is very large" caution. Decompose and build. |

### Track decomposition (agreed)

| Track | What | Depends on |
|---|---|---|
| A | Python data service (GitHub Actions ingestion) | — (gate) |
| B | NSE/BSE/MCX + news scraper coverage | A |
| C | Fundamentals-derived tools (ratios, DCF, comps, working capital, unit economics) | existing data |
| D | Derivatives & risk (options pricing/Greeks, vol surface, Breeden–Litzenberger) | clean options chain |
| E | Portfolio & backtest (stat arb, risk, backtest-overfitting / PBO) | C + D |
| F | AI research layer (multi-agent reports, earnings revision, macro regime) | A + C |

**MCX is a separate problem from NSE/BSE.** It has no bhavcopy equivalent to reuse from
`sync-bhavcopy`, and its public endpoints are more restrictive. Scope it on its own.

---

## 3. Current track status

### ✅ Track 0 — Reduced-motion bug (COMPLETE, uncommitted)

**Symptom:** "animations don't work on Linux and some machines."

**Root cause:** `src/index.css` had a blanket
`*, ::before, ::after { transition-duration: 0.01ms !important }` under
`prefers-reduced-motion: reduce`. GNOME's "Reduce Animation" toggle and GTK
`enable-animations=false` (default in several distros and most VMs) make browsers report `reduce`,
so those users got a fully static site. Measured: **477 live transitions → 0**.

**Fix shipped (working tree, not committed):**
- `src/index.css` — animations still stop under `reduce`; transitions no longer do. Two branches so
  `data-motion` beats the media query in both directions.
- `src/lib/motion-preference.ts` — three-state preference (`auto`/`on`/`off`) in `localStorage`.
- `src/contexts/MotionPreferenceContext.tsx` — provider + `usePrefersReducedMotion()`.
- `src/components/MotionToggle.tsx` — user-facing toggle, sits beside `ThemeToggle` in `Header.tsx`.
- `src/main.tsx` — stamps `data-motion` on `<html>` before first paint.
- 11 components swapped off Motion's `useReducedMotion()` onto `usePrefersReducedMotion()`.
- `e2e/reduced-motion.spec.ts` — 11 tests, stable across 3 consecutive runs.

**Verified:** 304/304 unit · 11/11 reduced-motion e2e · lint clean.

### 🔴 Track SEO — "Crawled - currently not indexed" (DIAGNOSED, not fixed)

**Numbers:** `public/sitemap.xml` has **197 URLs, 159 of them `/stock/SYMBOL`** — 81% of the sitemap
is one programmatic template with swapped numbers, on a regional brokerage domain.

This matches Google's documented reason almost exactly: many pages competing for the same purpose,
generated at scale, judged not valuable enough to index. It is **not** primarily a rendering bug —
the prerender pipeline is good (see §5) and fails closed rather than shipping skeletons.

**Aggravating factor:** `scripts/prerender.js` deliberately permits the `unsynced` state
("Financials not yet synced"). Any stock lacking synced fundamentals ships a genuinely thin page
*and* is listed in the sitemap. Those are the ones Google is most likely rejecting.

**Recommended direction (NOT yet approved by the user — get approval first):**
1. Stop listing unsynced stock pages in the sitemap; add them only once they carry real financials.
2. Make stock pages earn their place — each needs something not present on 158 sibling pages.
3. Consider `noindex` for the thin tail and keep the sitemap to genuinely substantive pages.

Do not mass-validate in Search Console; per Google's own guidance that rarely changes the outcome
without substantive page improvements.

### ✅ Track 1 — IPO page (implemented locally, deployment pending)

Design approved in full. Build:
- **Tables:** `ipos` (identity, price band, lot size, dates, registrar, RHP/DRHP, subscription by
  QIB/NII/Retail, listing price/gain) and `ipo_gmp_snapshots` (`ipo_id, captured_at, gmp,
  est_listing_price`, append-only).
- **Sync:** new `sync-ipos` edge function + scheduled GitHub Action, following the existing pattern
  in `sync-bhavcopy` / `sync-macro` / `market-feed`.
- **Pages:** `/ipo` hub + `/ipo/:slug` detail (GMP curve, subscription breakdown, issue details,
  financials, IPO-tagged news from `fetch-news`, registrar/allotment links).
- **Reuse:** `lightweight-charts` (already a dep) for GMP series, Recharts for subscription bars.
  No new dependencies.
- **Original implementation:** `supabase/functions/fetch-ipos/index.ts` live-scraped IPOWatch and
  InvestorGain on every request and stored nothing. It has now been replaced by the persisted
  read-only endpoint; `src/components/IPOTracker.tsx` remains the homepage teaser.

**This is also the pilot for the GitHub Actions ingestion pattern that Tracks A/B will depend on.**
Prove the shape here before betting the exchange scrapers on it.

**Compliance requirement:** SEBI-registered broker. IPO pages need an explicit
informational-not-advice disclaimer, and GMP needs its own — grey market premium is unofficial and
unregulated. Treat as a requirement, not a footnote.

**Implemented, uncommitted (2026-09-09):**
- Migration `20260909000000_ipo_data.sql` creates public read-only `ipos` and append-only
  `ipo_gmp_snapshots` tables with indexes and RLS. GMP snapshots are never updated in place.
- `sync-ipos` is a SYNC_SECRET-protected, service-role Edge Function. It parses IPO Watch, upserts
  the catalogue and writes one GMP observation per issue/run. `.github/workflows/ipo-sync.yml`
  triggers it three times daily Mon–Sat; `supabase/config.toml` declares `verify_jwt = false`.
- `fetch-ipos` is now read-only. Visitors no longer invoke an upstream scrape; it returns the
  persisted catalogue plus GMP history.
- Added `/ipo` and `/ipo/:slug`, GMP chart, disclaimer, subscription/issue detail slots and
  matching current-feed news. The home tracker, Markets menu and footer link to the hub.

**Deployment status (2026-09-09):** migration `20260909000000_ipo_data.sql`, `fetch-ipos` and
`sync-ipos` are deployed to production. The public reader returned `success: true` with an empty
catalogue before its first collection, as expected. The workflow file is still only in the local
working tree: commit/push it to GitHub to schedule collections. It uses the existing
`SUPABASE_ANON_KEY` and `MARKET_SYNC_SECRET` Actions secrets.

### ⏳ Track 2 — NSE/BSE/MCX ingestion (confirmed priority, needs design)

Not started. Needs a design + user approval before implementation.

### 🔍 Track 3 — Screener data quality (investigation dispatched)

User report: *"the data for individual stock we have in screener is incorrect and not up to the mark."*

Primary hypothesis: `sync-fundamentals` and `sync-fundamentals-yahoo` both write the same
`fundamentals_*` tables, with two separate GitHub Actions workflows — possible last-writer-wins race
and unit mismatches (Yahoo reports in different units than Indian filings; crore/lakh confusion is
the classic Indian-market bug).

**Argued build order:** do this *before* Track 1, because the same fundamentals tables feed IPO
financials and most of Track C. The user chose to run tracks side by side instead.

### 🔍 Track 4 — screener.in research (investigation dispatched)

Competitive research on information architecture, the custom query language, and rendering approach.

---

## 4. Gotchas — things that cost time to discover

Read these before you trip over them again.

1. **`test.use({ reducedMotion })` is a silent no-op in Playwright 1.61.1.** It sets nothing and
   fails open, so a suite written against it *looks* like it covers the reduce path while testing
   the default one. Use `page.emulateMedia({ reducedMotion })` and assert the emulation took.

2. **`npm run build` triggers `postbuild`, which runs `scripts/submit-indexnow.js`** — a real
   outbound ping to search engines. **Use `npx vite build` while iterating.** Only run the full
   `npm run build` when you actually intend to publish.

3. **Prerender and sitemap generation both call Supabase** (`scripts/lib/stock-routes.mjs` fetches
   `screener_stocks`). They fail closed on an empty response, by design. So a build that skips
   `postbuild` produces a `dist/` with only one `index.html` — that is expected, not a bug.

4. **Motion's `useReducedMotion()` does NOT read `MotionConfig`.** `MotionConfig reducedMotion`
   governs Motion's declarative animations only. Components branching on the preference must use
   `usePrefersReducedMotion()` from `src/contexts/MotionPreferenceContext.tsx`.

5. **`e2e/smoke.spec.ts:8` is genuinely flaky and pre-existing.** The CTA text comes from
   `t("cta.openAccount")` (`Header.tsx:218`), so the test races `LanguageProvider` loading
   translations. ~2 failures in 3 runs. Not caused by recent work — verified against a pre-change
   build. Worth fixing; it guards the primary conversion path.

6. **`tsc --noEmit -p tsconfig.app.json` reports 5 pre-existing errors** in `src/test/*` files
   (missing `@types/node`). Not yours; don't chase them.

7. **There is a CSP in `vercel.json`** with no script nonce, so **no inline `<script>` in
   `index.html`**. Early-boot work goes in `src/main.tsx` instead (the static splash covers the gap).

---

## 5. Architecture notes worth knowing

- **The prerender pipeline (`scripts/prerender.js`) is good — don't casually "improve" it.** It
  asserts each stock page captured real financial figures and refuses to ship skeletons, after a
  real incident where 126 skeleton files shipped silently. It retries 3× and runs without
  concurrency because parallelism above 4 pages silently degraded capture completeness.
- **`supabase/functions/_shared/`** holds `nse.ts` and `yahoo.ts` — the shared upstream clients.
  New scrapers should live alongside these, not reimplement fetching.
- **Existing scheduled workflows:** `bhavcopy-sync`, `fundamentals-sync`, `fundamentals-yahoo-sync`,
  `macro-sync`, `market-feed`, `unlisted-quotes`. Copy this shape for new ingestion.

---

## 6. Standing constraints from the user

- **Do not make outbound calls that spend the user's provider API keys** (OpenRouter, Groq, Gemini,
  Cerebras, Bytez, NVIDIA), even read-only. Ask first.
- **Verify upstream feeds from the deployed edge function, not from local curl** — local network
  results do not predict edge egress. Report failures per-source with a reason.
- **Commit only when asked.** Work is left in the working tree by default.
- Attribution lines for commits/PRs are supplied by the session; follow whatever the active session
  specifies.

---

## 7. How to verify you haven't broken anything

```bash
npx vitest run                                  # expect 304/304
npx vite build                                  # NOT `npm run build` (see gotcha 2)
npx playwright test e2e/reduced-motion.spec.ts  # expect 11/11
npx playwright test                             # 22 total; smoke.spec.ts:8 is a known flake
npx eslint src/                                 # expect clean
```

---

## 8. Uncommitted state as of this writing

Modified: `src/App.tsx`, `src/index.css`, `src/main.tsx`, `src/components/Header.tsx`,
and 9 components swapped onto the new motion hook.

New (untracked): `e2e/reduced-motion.spec.ts`, `src/components/MotionToggle.tsx`,
`src/contexts/MotionPreferenceContext.tsx`, `src/lib/motion-preference.ts`, `docs/HANDOFF.md`.

Nothing is committed. Track 0 is complete and verified; the rest is open.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { fetchStockRoutes, assertStockPageCaptured } from './lib/stock-routes.mjs';
import { fetchIpoRoutes, assertIpoPageCaptured } from './lib/ipo-routes.mjs';
import { fetchMarketListRoutes, assertListPageCaptured } from './lib/market-list-routes.mjs';
import { routeToFilePath } from './lib/route-paths.mjs';
import { assertHeadCaptured, cleanCapturedHtml, expectedCanonical } from './lib/prerender-html.mjs';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(__dirname, '../dist');

// Article routes are derived from the content file rather than hardcoded. Since
// unmatched paths now return a real 404, an article present in learnContent.ts
// but missing here would hard-404 instead of quietly falling back to the SPA.
// Deriving the list makes that drift impossible.
const learnArticleSlugs = [
  ...new Set(
    Array.from(
      fs
        .readFileSync(path.resolve(__dirname, '../src/data/learnContent.ts'), 'utf-8')
        .matchAll(/slug:\s*"([a-z0-9-]+)"/g),
      (match) => match[1]
    )
  ),
];
const learnArticleRoutes = learnArticleSlugs.map((slug) => `/learn/${slug}`);

if (learnArticleSlugs.length === 0) {
  console.error('No article slugs found in learnContent.ts - refusing to prerender an incomplete site.');
  process.exit(1);
}

// Define all routes we want to prerender (matching our sitemap)
const routes = [
  '/',
  '/about',
  '/services',
  '/apps',
  '/unlisted-space',
  '/open-account',
  '/pricing',
  '/screener',
  '/ipo',
  '/ipo-pipeline',
  '/fno',
  '/learn',
  '/learn/recommendations',
  ...learnArticleRoutes,
  '/52-week-tracker',
  '/market-pulse',
  '/compare',
  '/products',
  '/depository-services',
  '/fund-transfer',
  '/downloads',
  '/brokerage-calculator',
  '/margin-calculator',
  '/sip-calculator',
  '/team',
  '/contact',
  '/holidays',
  '/help',
  // Per-browser and noindex, so absent from the sitemap - but prerendered so a
  // direct visit or refresh gets a real page instead of the static 404.
  '/watchlist',
  '/reports',
  '/careers',
  '/privacy-policy',
  '/cookie-policy',
  '/terms',
  '/disclaimer',
  '/investor-corner'
];

// Prerendered but deliberately absent from the sitemap. Vercel serves
// dist/404.html for any path matching no static file and no rewrite, replacing
// the old catch-all rewrite that answered every unknown URL with 200 + the
// homepage (a soft 404 that burns crawl budget). The route hits the React
// Router catch-all, so it renders NotFound -> SEOHead noindex and the file
// ships noindex,nofollow even if the status code ever regresses to 200.
const ERROR_ROUTE = '/404';

// Bounded on purpose. Two flakes in four back-to-back 169-route runs - a
// capture in neither state on ABB, a `ProtocolError: Runtime.callFunctionOn
// timed out` on BEL - both cleared on a second try, and 169 routes now gate a
// production deploy. A route that fails every attempt still fails the build, so
// this buys back transient puppeteer noise without becoming a way to mask a
// genuine capture failure. No concurrency: above 4 parallel pages capture
// completeness was measured to collapse silently.
// Four on the VPS: capture shares 4 vCPUs with the database and edge functions,
// and a busy moment can starve one page twice in a row.
const CAPTURE_ATTEMPTS = 4;
/**
 * With several pages open only one is in the foreground, and Chrome throttles
 * timers and animation frames in the rest. react-helmet-async flushes <head>
 * changes on a frame, so a background IPO page reached "ready" while still
 * carrying its noindex tag and failed every retry. Capture pages are never
 * really in the background, so nothing should be throttled.
 */
const NO_BACKGROUND_THROTTLING = [
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
];
/** Pages captured at once. Overridable for a slow machine: PRERENDER_CONCURRENCY=1. */
const CONCURRENCY = Math.max(1, Math.min(4, Number(process.env.PRERENDER_CONCURRENCY) || 3));
/** A short breather before a retry lets a momentarily busy server catch up. */
const RETRY_DELAY_MS = 3000;
/** How long the head (canonical + title) may take after the body is ready. */
const HEAD_WAIT_MS = 30000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The raw build output of index.html, read before any capture. Captures overwrite
 * dist/index.html with the prerendered homepage, and serving THAT to every later
 * route booted each page with the homepage's head - its title and its canonical -
 * which Helmet only replaces a frame later. Every route now boots from this.
 */
let RAW_SHELL = '';
/** The <title> the raw shell ships with; only "/" may be captured with it. */
let GENERIC_TITLE = '';

/** One attempt on a fresh page. The page is always closed, success or not. */
async function captureOnce(browser, port, route) {
  const page = await browser.newPage();
  // Suppress console logs from the page
  page.on('console', () => {});
  // Tells the app it is being captured (src/lib/prerender.ts): interactive,
  // query-heavy panels stay out of the static HTML and off the database.
  await page.evaluateOnNewDocument(() => {
    window.__PRERENDER__ = true;
    // react-helmet-async writes <head> inside requestAnimationFrame, and headless
    // Chrome gives animation frames only to the tab in front. With several pages
    // captured at once the others rendered their body but never their head (no
    // title, no canonical) - the flags in NO_BACKGROUND_THROTTLING keep timers
    // running but not frames. Timers are never paused, so run frames on them.
    window.requestAnimationFrame = (callback) => setTimeout(() => callback(performance.now()), 16);
    window.cancelAnimationFrame = (id) => clearTimeout(id);
  });

  try {
    try {
      await page.goto(`http://localhost:${port}${route}`, {
        waitUntil: 'networkidle2', // More resilient than networkidle0
        timeout: 30000,
      });
    } catch (e) {
      console.warn(`Timeout or error on ${route}, proceeding to capture current DOM...`);
    }

    // networkidle2 is a heuristic about sockets, not about whether this page
    // has its data yet, and on a cold container the two come apart: the build
    // that broke shipped nothing because /stock/ABB - the FIRST stock route,
    // so the one paying for the cold JS parse and the first Supabase
    // round-trip - was still on its skeleton when the socket count went quiet.
    //
    // So wait for the condition the assertion below actually checks. The wait
    // is deliberately swallowed: when the state never settles we want
    // assertStockPageCaptured's specific message ("no data ... refusing to ship
    // a skeleton"), not a generic selector timeout that says nothing about why.
    if (route.startsWith('/stock/')) {
      await page
        .waitForSelector('[data-stock-state="ready"], [data-stock-state="unsynced"]', {
          timeout: 25000,
        })
        .catch(() => {});
    }

    // The IPO pages render from fetch-ipos and mark themselves ready; the
    // detail page is noindex until then, so capturing early would ship noindex.
    if (route === '/ipo' || route === '/ipo-pipeline' || route.startsWith('/ipo/')) {
      await page.waitForSelector('[data-ipo-state="ready"]', { timeout: 25000 }).catch(() => {});
      // The data marker is set in the same render that drops noindex, but the
      // <head> update lands a frame later. Wait for it rather than capturing the
      // stale robots tag; a genuine failure still fails the assertion below.
      await page
        .waitForFunction(() => !/noindex/i.test(document.querySelector('meta[name="robots"]')?.getAttribute('content') ?? ''), { timeout: 10000 })
        .catch(() => {});
    }

    if (route === '/indices' || route.startsWith('/indices/') || route.startsWith('/sectors/')) {
      await page.waitForSelector('[data-list-state="ready"]', { timeout: 25000 }).catch(() => {});
    }
    // Panels below the page's own data (results, red flags, peers, news) load
    // on their own queries. Wait until none is in flight so each is captured
    // with its content, not its skeleton. Swallowed like the waits above: a
    // panel that never loads simply renders nothing, which is safe to ship.
    await page
      .waitForFunction(() => {
        const qc = window.__PRERENDER_QC__;
        return !qc || (qc.isFetching() === 0 && qc.isMutating() === 0);
      }, { timeout: 20000, polling: 250 })
      .catch(() => {});
    // Helmet writes <head> a frame after the body settles. Wait until the head
    // names THIS page: its own canonical URL and a title other than the shell's.
    // A page that never gets there fails the assertion below and is retried.
    const checkCanonical = route !== ERROR_ROUTE;
    await page
      .waitForFunction(
        (wantCanonical, genericTitle, isHome, check) => {
          const link = document.querySelector('link[rel="canonical"]');
          if (!link) return false;
          if (check && decodeURIComponent(link.href) !== decodeURIComponent(wantCanonical)) return false;
          return isHome || document.title.trim() !== genericTitle.trim();
        },
        { timeout: HEAD_WAIT_MS },
        expectedCanonical(route),
        GENERIC_TITLE,
        route === '/',
        checkCanonical,
      )
      .catch(() => {});

    const html = cleanCapturedHtml(await page.content(), port, route);
    assertHeadCaptured(route, html, { genericTitle: GENERIC_TITLE, checkCanonical });
    if (route.startsWith('/stock/')) {
      assertStockPageCaptured(route, html);
    }
    if (route === '/ipo' || route === '/ipo-pipeline' || route.startsWith('/ipo/')) {
      assertIpoPageCaptured(route, html);
    }
    if (route === '/indices' || route.startsWith('/indices/') || route.startsWith('/sectors/')) {
      assertListPageCaptured(route, html);
    }
    return html;
  } finally {
    // A page left open after a ProtocolError leaks a renderer for the rest of
    // the run, so this closes on the failure path too - which is also what
    // makes the next attempt a genuinely fresh one.
    await page.close().catch(() => {});
  }
}

async function captureWithRetry(browser, port, route) {
  let lastError;
  for (let attempt = 1; attempt <= CAPTURE_ATTEMPTS; attempt += 1) {
    try {
      return await captureOnce(browser, port, route);
    } catch (error) {
      lastError = error;
      if (attempt < CAPTURE_ATTEMPTS) {
        console.warn(
          `Attempt ${attempt}/${CAPTURE_ATTEMPTS} failed for ${route}: ${error.message} - retrying on a fresh page.`,
        );
        await sleep(RETRY_DELAY_MS);
      }
    }
  }
  throw new Error(
    `Prerender failed for ${route} after ${CAPTURE_ATTEMPTS} attempts: ${lastError.message}`,
  );
}

async function prerender() {
  console.log('Starting prerendering process...');

  // 1. Start a local static server to serve the built SPA
  RAW_SHELL = fs.readFileSync(path.join(DIST_DIR, 'index.html'), 'utf8');
  GENERIC_TITLE = RAW_SHELL.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? '';
  const app = express();
  // index: false - "/" must boot from the raw shell too, never a captured page.
  app.use(express.static(DIST_DIR, { index: false }));
  // Fallback for SPA routing: always the raw shell read above, never the
  // dist/index.html the "/" capture overwrites (see RAW_SHELL).
  app.use((req, res) => {
    // A missing file (e.g. /insights.js, served by nginx in production, not from
    // dist/) must not get the HTML shell: the page would try to run HTML as a script.
    if (/\.[a-z0-9]+$/i.test(req.path)) {
      res.status(404).end();
      return;
    }
    res.type('html').send(RAW_SHELL);
  });

  const server = app.listen(0, async () => {
    const port = server.address().port;
    console.log(`Static server running on port ${port}`);

    try {
      // 2. Launch Puppeteer dynamically based on environment
      let browser;
      if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_VERSION) {
        console.log('Running on Vercel/Lambda, using @sparticuz/chromium');
        const puppeteer = (await import('puppeteer-core')).default;
        const chromium = (await import('@sparticuz/chromium')).default;
        browser = await puppeteer.launch({
          args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox', ...NO_BACKGROUND_THROTTLING],
          defaultViewport: chromium.defaultViewport,
          executablePath: await chromium.executablePath(),
          headless: chromium.headless,
        });
      } else {
        console.log('Running locally, using standard puppeteer');
        const puppeteer = (await import('puppeteer')).default;
        browser = await puppeteer.launch({
          headless: "new",
          args: ['--no-sandbox', '--disable-setuid-sandbox', ...NO_BACKGROUND_THROTTLING]
        });
      }

      const stockRoutes = await fetchStockRoutes();
      console.log(`Derived ${stockRoutes.length} stock routes from screener_stocks.`);
      const ipoRoutes = await fetchIpoRoutes();
      console.log(`Derived ${ipoRoutes.length} IPO routes from ipos.`);
      const listRoutes = await fetchMarketListRoutes();
      console.log(`Derived ${listRoutes.length} index and sector list routes.`);

      // New IPOs arrive several times a day, but pages are only prerendered on
      // deploy. vercel.json rewrites any /ipo/:slug without a file to this shell,
      // so an issue added since the last deploy is a 200 that renders in the
      // browser, not a 404. It is the raw build output - no canonical - copied
      // now, before the "/" capture below overwrites it. It carries noindex: the
      // same shell also answers mistyped or retired slugs, and without it every
      // one was an indexable copy of the homepage (a soft 404). A real new issue
      // becomes an indexable page at the next build (infra/vps/jobs/build-site.sh).
      const shell = RAW_SHELL.replace('<head>', '<head>\n    <meta name="robots" content="noindex, follow" />');
      fs.writeFileSync(path.join(DIST_DIR, 'ipo-shell.html'), shell);

      // Serial capture ran out Vercel's 45-minute build limit once the universe
      // reached 246 stocks and 105 IPOs (~397 routes at ~7s each: killed at
      // 394). A small worker pool brings that back to a fraction. It stays at 3:
      // above 4 parallel pages capture completeness was measured to collapse, and
      // every page still passes the same state assertions and bounded retries,
      // so a page that is not ready fails the build rather than shipping.
      const queue = [...routes, ...listRoutes, ...stockRoutes, ...ipoRoutes, ERROR_ROUTE];
      const total = queue.length;
      let next = 0;
      let done = 0;
      const started = Date.now();

      const worker = async () => {
        while (next < queue.length) {
          const route = queue[next++];
          console.log(`Prerendering ${route}...`);

          const html = await captureWithRetry(browser, port, route);

          // 3. Save to file. routeToFilePath decodes each segment so the file a
          // static host looks for after decoding the request path is the file we
          // actually wrote - see route-paths.mjs.
          const filePath = path.join(DIST_DIR, routeToFilePath(route));
          const dir = path.dirname(filePath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }

          fs.writeFileSync(filePath, html);
          done += 1;
          console.log(`Saved ${filePath} (${done}/${total})`);
        }
      };

      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, total) }, worker));
      console.log(`Captured ${total} routes in ${Math.round((Date.now() - started) / 1000)}s.`);

      await browser.close();
      console.log('Prerendering completed successfully.');
    } catch (error) {
      console.error('Error during prerendering:', error);
      process.exit(1);
    } finally {
      server.close();
    }
  });
}

prerender();

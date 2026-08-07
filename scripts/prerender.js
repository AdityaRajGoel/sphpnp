import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { fetchStockRoutes } from './lib/stock-routes.mjs';
import { routeToFilePath } from './lib/route-paths.mjs';
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
  '/unlisted-space',
  '/open-account',
  '/pricing',
  '/screener',
  '/fno',
  '/learn',
  '/learn/recommendations',
  ...learnArticleRoutes,
  '/52-week-tracker',
  '/compare',
  '/products',
  '/depository-services',
  '/brokerage-calculator',
  '/margin-calculator',
  '/sip-calculator',
  '/team',
  '/contact',
  '/holidays',
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

// Only the income statement renders a <td> on a stock page, so a table cell
// holding a signed number - "₹1,28,260.00 Cr", "₹6.44", "0.41" - is a real
// financial figure and nothing else on the page can forge one.
const FINANCIAL_FIGURE = /<td[^>]*>\s*-?(?:₹\s*)?\d/;

/**
 * The catch around page.goto swallows a timeout and proceeds, so without this a
 * slow response silently ships a loading skeleton to crawlers. Measured: at high
 * concurrency this produced 126 well-formed skeleton files with timeouts=0 and
 * nothing in the log to distinguish it from a clean run.
 *
 * The state attribute alone is not enough. An RLS regression on
 * fundamentals_income returns an empty array with no error object - PostgREST
 * resolves rather than throwing, so the hook's .error checks never fire - and
 * every page would render "Financials not yet synced" and pass. So a page that
 * claims `ready` has to show a figure, and a page that claims `unsynced` has to
 * say so in words. Unsynced is legitimate while the backfill is mid-flight.
 */
function assertStockPageCaptured(route, html) {
  const ready = html.includes('data-stock-state="ready"');
  const unsynced = html.includes('data-stock-state="unsynced"');

  if (ready === unsynced) {
    throw new Error(
      ready
        ? `Prerender captured both states for ${route} - the state marker is ambiguous.`
        : `Prerender captured no data for ${route} - got a loading or error state. ` +
          `Refusing to ship a skeleton page.`,
    );
  }

  if (ready && !FINANCIAL_FIGURE.test(html)) {
    throw new Error(
      `Prerender captured ${route} as ready but its income table holds no figures. ` +
      `Refusing to ship an empty financials table.`,
    );
  }

  if (unsynced && !html.includes('Financials not yet synced')) {
    throw new Error(
      `Prerender captured ${route} as unsynced but the page does not say so. ` +
      `Refusing to ship a page whose state marker does not match its content.`,
    );
  }
}

// Bounded on purpose. Two flakes in four back-to-back 169-route runs - a
// capture in neither state on ABB, a `ProtocolError: Runtime.callFunctionOn
// timed out` on BEL - both cleared on a second try, and 169 routes now gate a
// production deploy. A route that fails every attempt still fails the build, so
// this buys back transient puppeteer noise without becoming a way to mask a
// genuine capture failure. No concurrency: above 4 parallel pages capture
// completeness was measured to collapse silently.
const CAPTURE_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** One attempt on a fresh page. The page is always closed, success or not. */
async function captureOnce(browser, port, route) {
  const page = await browser.newPage();
  // Suppress console logs from the page
  page.on('console', () => {});

  try {
    try {
      await page.goto(`http://localhost:${port}${route}`, {
        waitUntil: 'networkidle2', // More resilient than networkidle0
        timeout: 15000,
      });
    } catch (e) {
      console.warn(`Timeout or error on ${route}, proceeding to capture current DOM...`);
    }

    const html = await page.content();
    if (route.startsWith('/stock/')) {
      assertStockPageCaptured(route, html);
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
  const app = express();
  app.use(express.static(DIST_DIR));
  // Fallback for SPA routing
  app.use((req, res) => {
    // `send`'s dotfile guard rejects the whole path when any segment starts with a
    // dot, so path.join() 404s every route from a checkout under e.g. .claude/.
    // Rooting the call scopes that check to the filename.
    res.sendFile('index.html', { root: DIST_DIR });
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
          args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox'],
          defaultViewport: chromium.defaultViewport,
          executablePath: await chromium.executablePath(),
          headless: chromium.headless,
        });
      } else {
        console.log('Running locally, using standard puppeteer');
        const puppeteer = (await import('puppeteer')).default;
        browser = await puppeteer.launch({
          headless: "new",
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
      }

      const stockRoutes = await fetchStockRoutes();
      console.log(`Derived ${stockRoutes.length} stock routes from screener_stocks.`);

      for (const route of [...routes, ...stockRoutes, ERROR_ROUTE]) {
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
        console.log(`Saved ${filePath}`);
      }

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

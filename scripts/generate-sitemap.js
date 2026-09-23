import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchStockRoutes } from './lib/stock-routes.mjs';
import { fetchIpoRoutes } from './lib/ipo-routes.mjs';
import { fetchMarketListRoutes } from './lib/market-list-routes.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const today = new Date().toISOString().split('T')[0];

// Derived from the content file for the same reason as in prerender.js: an
// article that exists but is missing from this list would now be a hard 404.
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

// Each article's own `updated` date, so its lastmod moves only when the article does.
const learnUpdated = new Map(
  Array.from(
    fs
      .readFileSync(path.resolve(__dirname, '../src/data/learnContent.ts'), 'utf-8')
      .matchAll(/slug:\s*"([a-z0-9-]+)",[\s\S]*?updated:\s*"(\d{4}-\d{2}-\d{2})"/g),
    (m) => [m[1], m[2]],
  ),
);

if (learnArticleSlugs.length === 0) {
  console.error('No article slugs found in learnContent.ts - refusing to write an incomplete sitemap.');
  process.exit(1);
}

// Derived from the live universe for the same reason the slugs above are derived
// from the content file: a stock the app serves but the sitemap omits is a page
// search engines never find. fetchStockRoutes throws on an empty or failed
// fetch, so a bad response fails the build rather than silently shrinking it.
const stockRoutes = await fetchStockRoutes();
// Every IPO page in the catalogue - they were all answering crawlers with the
// 404 page before the prerender learned about them.
const ipoRoutes = await fetchIpoRoutes();
// Index constituent and sector lists, plus their /indices hub.
const listRoutes = await fetchMarketListRoutes();

// Google uses <lastmod> only while it stays accurate, and ignores priority and
// changefreq. So only pages whose content really changes daily (market data,
// stock, IPO and list pages) carry today's date; articles carry their own
// `updated`; pages with no reliable date leave lastmod out rather than claim
// a change on every build.
const urls = [
  { loc: '/',                    changefreq: 'daily',   priority: '1.0',  lastmod: today },
  { loc: '/unlisted-space',      changefreq: 'weekly',  priority: '0.9',  lastmod: null },
  { loc: '/open-account',        changefreq: 'monthly', priority: '0.9',  lastmod: null },
  { loc: '/pricing',             changefreq: 'monthly', priority: '0.85', lastmod: null },
  { loc: '/fno',                 changefreq: 'daily',   priority: '0.9',  lastmod: today },
  { loc: '/services',            changefreq: 'weekly',  priority: '0.85', lastmod: null },
  { loc: '/apps',                changefreq: 'monthly', priority: '0.8',  lastmod: null },
  { loc: '/depository-services', changefreq: 'weekly',  priority: '0.85', lastmod: null },
  { loc: '/about',               changefreq: 'monthly', priority: '0.8',  lastmod: null },
  { loc: '/screener',            changefreq: 'daily',   priority: '0.8',  lastmod: today },
  { loc: '/ipo',                 changefreq: 'daily',   priority: '0.85', lastmod: today },
  { loc: '/ipo-pipeline',        changefreq: 'daily',   priority: '0.8',  lastmod: today },
  ...ipoRoutes.map(route => ({ loc: route, changefreq: 'daily', priority: '0.6', lastmod: today })),
  ...listRoutes.map(route => ({ loc: route, changefreq: 'daily', priority: route === '/indices' ? '0.8' : '0.75', lastmod: today })),
  // Per-symbol stock pages (the screener's children)
  ...stockRoutes.map(route => ({ loc: route, changefreq: 'weekly', priority: '0.6', lastmod: today })),
  { loc: '/learn',               changefreq: 'weekly',  priority: '0.8',  lastmod: null },
  { loc: '/learn/recommendations', changefreq: 'daily', priority: '0.8',  lastmod: today },
  // Learning Center articles (original content)
  ...learnArticleSlugs.map(slug => ({ loc: `/learn/${slug}`, changefreq: 'monthly', priority: '0.7', lastmod: learnUpdated.get(slug) ?? null })),
  { loc: '/52-week-tracker',     changefreq: 'daily',   priority: '0.8',  lastmod: today },
  { loc: '/market-pulse',        changefreq: 'daily',   priority: '0.9',  lastmod: today },
  { loc: '/compare',             changefreq: 'weekly',  priority: '0.7',  lastmod: null },
  { loc: '/products',            changefreq: 'monthly', priority: '0.7',  lastmod: null },
  { loc: '/brokerage-calculator', changefreq: 'monthly', priority: '0.7', lastmod: null },
  { loc: '/margin-calculator',   changefreq: 'monthly', priority: '0.7',  lastmod: null },
  { loc: '/sip-calculator',      changefreq: 'monthly', priority: '0.7',  lastmod: null },
  { loc: '/contact',             changefreq: 'monthly', priority: '0.7',  lastmod: null },
  { loc: '/team',                changefreq: 'monthly', priority: '0.6',  lastmod: null },
  { loc: '/holidays',            changefreq: 'monthly', priority: '0.6',  lastmod: today },
  { loc: '/reports',             changefreq: 'weekly',  priority: '0.7',  lastmod: today },
  { loc: '/help',                changefreq: 'monthly', priority: '0.6',  lastmod: '2026-09-15' },
  { loc: '/careers',             changefreq: 'monthly', priority: '0.5',  lastmod: null },
  { loc: '/privacy-policy',      changefreq: 'yearly',  priority: '0.3',  lastmod: '2026-01-01' },
  { loc: '/cookie-policy',       changefreq: 'yearly',  priority: '0.3',  lastmod: '2026-01-01' },
  { loc: '/terms',               changefreq: 'yearly',  priority: '0.3',  lastmod: '2026-01-01' },
  { loc: '/disclaimer',          changefreq: 'yearly',  priority: '0.3',  lastmod: '2026-01-01' },
  { loc: '/investor-corner',     changefreq: 'monthly', priority: '0.5',  lastmod: '2026-07-18' },
];

const BASE = 'https://www.sphpnp.com';

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${BASE}${u.loc}</loc>
${u.lastmod ? `    <lastmod>${u.lastmod}</lastmod>\n` : ''}    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;

// Write to public/ (source of truth for next build) and dist/ (already-copied
// build output - Vite copies public/ into dist/ *before* this postbuild script
// runs, so dist/sitemap.xml must be written directly or the deploy ships stale dates).
fs.writeFileSync(path.resolve(__dirname, '../public/sitemap.xml'), xml);
const distDir = path.resolve(__dirname, '../dist');
if (fs.existsSync(distDir)) {
  fs.writeFileSync(path.join(distDir, 'sitemap.xml'), xml);
}
console.log(`Sitemap generated with lastmod=${today} for ${urls.length} URLs.`);

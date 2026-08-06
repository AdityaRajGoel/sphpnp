import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchStockRoutes } from './lib/stock-routes.mjs';

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

if (learnArticleSlugs.length === 0) {
  console.error('No article slugs found in learnContent.ts - refusing to write an incomplete sitemap.');
  process.exit(1);
}

// Derived from the live universe for the same reason the slugs above are derived
// from the content file: a stock the app serves but the sitemap omits is a page
// search engines never find. fetchStockRoutes throws on an empty or failed
// fetch, so a bad response fails the build rather than silently shrinking it.
const stockRoutes = await fetchStockRoutes();

const urls = [
  { loc: '/',                    changefreq: 'daily',   priority: '1.0',  lastmod: today },
  { loc: '/unlisted-space',      changefreq: 'weekly',  priority: '0.9',  lastmod: today },
  { loc: '/open-account',        changefreq: 'monthly', priority: '0.9',  lastmod: today },
  { loc: '/pricing',             changefreq: 'monthly', priority: '0.85', lastmod: today },
  { loc: '/fno',                 changefreq: 'daily',   priority: '0.9',  lastmod: today },
  { loc: '/services',            changefreq: 'weekly',  priority: '0.85', lastmod: today },
  { loc: '/depository-services', changefreq: 'weekly',  priority: '0.85', lastmod: today },
  { loc: '/about',               changefreq: 'monthly', priority: '0.8',  lastmod: today },
  { loc: '/screener',            changefreq: 'daily',   priority: '0.8',  lastmod: today },
  // Per-symbol stock pages (the screener's children)
  ...stockRoutes.map(route => ({ loc: route, changefreq: 'weekly', priority: '0.6', lastmod: today })),
  { loc: '/learn',               changefreq: 'weekly',  priority: '0.8',  lastmod: today },
  { loc: '/learn/recommendations', changefreq: 'daily', priority: '0.8',  lastmod: today },
  // Learning Center articles (original content)
  ...learnArticleSlugs.map(slug => ({ loc: `/learn/${slug}`, changefreq: 'monthly', priority: '0.7', lastmod: today })),
  { loc: '/52-week-tracker',     changefreq: 'daily',   priority: '0.8',  lastmod: today },
  { loc: '/compare',             changefreq: 'weekly',  priority: '0.7',  lastmod: today },
  { loc: '/products',            changefreq: 'monthly', priority: '0.7',  lastmod: today },
  { loc: '/brokerage-calculator', changefreq: 'monthly', priority: '0.7', lastmod: today },
  { loc: '/margin-calculator',   changefreq: 'monthly', priority: '0.7',  lastmod: today },
  { loc: '/sip-calculator',      changefreq: 'monthly', priority: '0.7',  lastmod: today },
  { loc: '/contact',             changefreq: 'monthly', priority: '0.7',  lastmod: today },
  { loc: '/team',                changefreq: 'monthly', priority: '0.6',  lastmod: today },
  { loc: '/holidays',            changefreq: 'monthly', priority: '0.6',  lastmod: today },
  { loc: '/reports',             changefreq: 'weekly',  priority: '0.7',  lastmod: today },
  { loc: '/careers',             changefreq: 'monthly', priority: '0.5',  lastmod: today },
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
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
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

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { readSupabaseConfig } from './stock-routes.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Same rule as listSlug in src/lib/market-lists.ts - a test holds them together. */
export function slugify(name) {
  return name.toLowerCase().replace(/&/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** INDEX_NAMES from src/lib/market-lists.ts, read as text the way learnContent.ts slugs are. */
export function indexNames(source = fs.readFileSync(path.resolve(__dirname, '../../src/lib/market-lists.ts'), 'utf-8')) {
  const block = source.match(/export const INDEX_NAMES = \[([\s\S]*?)\];/)?.[1];
  const names = block ? [...block.matchAll(/"([^"]+)"/g)].map((m) => m[1]) : [];
  if (names.length === 0) throw new Error('No INDEX_NAMES found in src/lib/market-lists.ts');
  return names;
}

/** /indices, one page per index, and one per sector in the tracked universe ("General" is no sector). */
export async function fetchMarketListRoutes() {
  const { url, key } = readSupabaseConfig();
  const res = await fetch(`${url}/rest/v1/screener_stocks?select=sector`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`screener_stocks sectors fetch failed: HTTP ${res.status}`);
  const rows = await res.json();
  const sectors = [...new Set(rows.map((r) => String(r.sector || '').trim()).filter((s) => s && s !== 'General'))];
  if (sectors.length === 0) throw new Error('screener_stocks returned no sectors - refusing to build an incomplete site');
  return [
    '/indices',
    ...indexNames().map((n) => `/indices/${slugify(n)}`),
    ...sectors.sort().map((s) => `/sectors/${slugify(s)}`),
  ];
}

/** A list page captured before its rows arrived would ship a skeleton table to crawlers. */
export function assertListPageCaptured(route, html) {
  if (!html.includes('data-list-state="ready"')) {
    throw new Error(`Prerender captured ${route} without its list - refusing to ship a skeleton page.`);
  }
  if (route !== '/indices' && !/<tbody[^>]*>\s*<tr/.test(html)) {
    throw new Error(`Prerender captured ${route} as ready but its table has no rows.`);
  }
}

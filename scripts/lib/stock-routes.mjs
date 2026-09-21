import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Stock routes come from the live universe rather than a checked-in list, so
 * the sitemap and the prerendered set can never drift from what the app serves.
 *
 * The key is read from the client module, where it already lives as a hardcoded
 * fallback and is shipped in the browser bundle - so this adds no exposure.
 */
export function readSupabaseConfig() {
  const src = fs.readFileSync(
    path.resolve(__dirname, '../../src/integrations/supabase/client.ts'),
    'utf-8',
  );
  const url = src.match(/FALLBACK_SUPABASE_URL = '([^']+)'/)?.[1];
  const key = src.match(/FALLBACK_SUPABASE_PUBLISHABLE_KEY =\s*'([^']+)'/)?.[1];
  if (!url || !key) {
    throw new Error('Could not read Supabase config from client.ts');
  }
  return {
    url: process.env.VITE_SUPABASE_URL || url,
    key: process.env.VITE_SUPABASE_PUBLISHABLE_KEY || key,
  };
}

export async function fetchStockRoutes() {
  const { url, key } = readSupabaseConfig();
  const res = await fetch(
    `${url}/rest/v1/screener_stocks?select=symbol&order=symbol`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  );
  if (!res.ok) {
    throw new Error(`screener_stocks fetch failed: HTTP ${res.status}`);
  }
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    // Fails closed, exactly as prerender.js already does when learnContent.ts
    // yields no slugs. Shipping a site with every stock page missing is worse
    // than not shipping.
    throw new Error('screener_stocks returned no symbols - refusing to build an incomplete site');
  }
  return rows
    .map((r) => String(r.symbol || '').trim().toUpperCase())
    .filter(Boolean)
    .map((s) => `/stock/${encodeURIComponent(s)}`);
}

// Only the financial tables render a <td> on a stock page - the NSE income
// table, or the IndianAPI statements, shareholding and moving averages - so a
// table cell holding a signed number ("₹1,28,260.00 Cr", "3,09,468", "50.48%")
// is a real financial figure. The peer comparison also renders number cells,
// so its section is cut out first - it must not vouch for an empty income table.
const PEER_SECTION = /<section[^>]*aria-labelledby="peers-heading"[\s\S]*?<\/section>/;
const withoutPeers = (html) => html.replace(PEER_SECTION, '');
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
export function assertStockPageCaptured(route, html) {
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

  if (ready && !FINANCIAL_FIGURE.test(withoutPeers(html))) {
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

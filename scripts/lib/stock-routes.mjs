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
function readSupabaseConfig() {
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

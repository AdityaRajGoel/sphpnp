// Submits all site URLs to IndexNow (Bing, Yandex, etc.) after every production deploy.
// Google does not use IndexNow; it reads sitemap.xml (declared in robots.txt).

import fs from 'fs';

const HOST = 'www.sphpnp.com';
const KEY  = 'f9f4dc4ccac44b7ba7c91c6bce9d00c1';
const BASE = `https://${HOST}`;

// Every URL in the sitemap (stock and IPO pages included), not a hand-kept list.
// generate-sitemap.js runs just before this in postbuild.
const sitemap = fs.readFileSync(new URL('../public/sitemap.xml', import.meta.url), 'utf8');
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);

async function submit() {
  try {
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: HOST,
        key: KEY,
        keyLocation: `${BASE}/${KEY}.txt`,
        urlList: urls,
      }),
    });
    console.log(`IndexNow: ${res.ok ? `${urls.length} URLs submitted ✅` : `Error ${res.status}`}`);
  } catch (e) {
    console.warn('IndexNow submission failed (non-fatal):', e.message);
  }
}

submit();

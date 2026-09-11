// Submits all site URLs to IndexNow (Bing, Yandex, etc.) after every production deploy.
// Google picks up IndexNow submissions via Bing's shared feed.

const HOST = 'www.sphpnp.com';
const KEY  = 'f9f4dc4ccac44b7ba7c91c6bce9d00c1';
const BASE = `https://${HOST}`;

const urls = [
  '/', '/about', '/services', '/unlisted-space', '/open-account',
  '/screener', '/fno', '/learn', '/learn/recommendations',
  '/learn/demat-account', '/learn/pe-ratio', '/learn/sip-vs-lumpsum',
  '/learn/power-of-compounding', '/learn/mutual-funds-guide', '/learn/ipo-guide',
  '/52-week-tracker', '/market-pulse', '/compare', '/products', '/depository-services',
  '/brokerage-calculator', '/margin-calculator', '/team', '/contact',
  '/holidays', '/careers', '/privacy-policy', '/cookie-policy',
].map(p => `${BASE}${p}`);

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
    console.log(`IndexNow: ${res.status === 200 ? 'All URLs submitted ✅' : `Error ${res.status}`}`);
  } catch (e) {
    console.warn('IndexNow submission failed (non-fatal):', e.message);
  }
}

submit();

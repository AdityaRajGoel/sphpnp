/**
 * Clean-up applied to every page the prerender captures, before it is written.
 *
 * page.content() serialises the LIVE DOM, which by then carries two artefacts
 * of having been rendered against a local static server:
 *
 *  - Vite's lazy-chunk preloader inserts <link rel="modulepreload"> elements
 *    with absolute URLs on the capture server's origin
 *    (http://localhost:43395/assets/...). Shipped as-is, every production visit
 *    asked the browser to fetch scripts from localhost - blocked by the CSP and
 *    logged as console errors on every page (Lighthouse, Sept 2026).
 *
 *  - Helmet writes <head> on (shimmed) animation frames, and a capture can
 *    land with a stale JSON-LD block from an earlier render still in place:
 *    stock and IPO pages shipped two BreadcrumbLists, the loading-state one
 *    ("TCS share price and financials") beside the real one.
 *
 *  - Every lazy chunk the page imported during capture was also recorded as a
 *    <link rel="modulepreload" as="script">: 45 of them on "/", chart
 *    libraries and dialogs included, all fetched at high priority before first
 *    paint. On a throttled phone that held first paint at 5-7 s; without them
 *    1.7 s. The build's own entry preloads (no `as` attribute) stay.
 *
 *  - index.html preloads the homepage hero image, and every route is captured
 *    from that same shell. Only "/" renders the hero, so on every other page the
 *    preload was a wasted high-priority download (and a console warning).
 */

/** Makes any URL on the capture server's origin relative to the site root. */
export function stripCaptureOrigin(html, port) {
  const origin = new RegExp(`https?://(?:localhost|127\\.0\\.0\\.1)${port ? `:${port}` : "(?::\\d+)?"}(?=/)`, "g");
  return html.replace(origin, "");
}

/** Removes the hero image preload from routes that do not render the hero. */
export function dropHeroPreload(html, route) {
  if (route === "/") return html;
  return html.replace(/<link\b[^>]*\brel="preload"[^>]*\/hero-bg[^>]*>/g, "");
}

const LD_JSON = /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;

/** Keeps only the last JSON-LD block of each @type: Helmet appends the current one after any stale copy. */
export function dedupeJsonLd(html) {
  const lastIndexByType = new Map();
  for (const m of html.matchAll(LD_JSON)) {
    let type;
    try { type = JSON.stringify(JSON.parse(m[1])['@type']); } catch { continue; }
    lastIndexByType.set(type, m.index);
  }
  return html.replace(LD_JSON, (block, body, index) => {
    let type;
    try { type = JSON.stringify(JSON.parse(body)['@type']); } catch { return block; }
    return lastIndexByType.get(type) === index ? block : '';
  });
}

/** Removes the lazy-chunk preloads Vite's runtime injected while the page was captured. */
export function dropRuntimePreloads(html) {
  return html.replace(/<link\b[^>]*\brel="modulepreload"[^>]*\bas="script"[^>]*>/g, "");
}

export function cleanCapturedHtml(html, port, route) {
  return dedupeJsonLd(dropRuntimePreloads(dropHeroPreload(stripCaptureOrigin(html, port), route)));
}

export const SITE_ORIGIN = "https://www.sphpnp.com";

/** The canonical URL SEOHead writes for a route: the origin plus the path, no trailing slash. */
export function expectedCanonical(route) {
  const path = route.length > 1 && route.endsWith("/") ? route.slice(0, -1) : route;
  return `${SITE_ORIGIN}${path}`;
}

function headOf(html) {
  const end = html.search(/<\/head>/i);
  return end === -1 ? html : html.slice(0, end);
}

function decode(value) {
  try {
    return decodeURIComponent(value.replace(/&amp;/g, "&"));
  } catch {
    return value;
  }
}

/**
 * Every routed page renders SEOHead, which writes the page's own title and a
 * canonical link through react-helmet-async - and Helmet flushes <head> a frame
 * after the body settles. A capture taken too early keeps whatever head the page
 * booted with. Two builds shipped that way: 290 pages with index.html's generic
 * head, then 247 pages whose canonical pointed at the homepage (telling Google
 * they were duplicates of it). So the head must name THIS page: its canonical is
 * its own URL, and its title is not the generic homepage title.
 *
 * options.genericTitle - the <title> index.html ships with (only "/" may keep it)
 * options.checkCanonical - false for the 404 route, whose URL is not a real page
 */
export function assertHeadCaptured(route, html, { genericTitle, checkCanonical = true } = {}) {
  const head = headOf(html);
  const canonical = head.match(/<link\b[^>]*\brel="canonical"[^>]*>/i)?.[0]?.match(/\bhref="([^"]*)"/i)?.[1];
  if (!canonical) {
    throw new Error(
      `Prerender captured ${route} before its page head was written (no canonical link). ` +
        `Refusing to ship a page with the generic title and no meta tags.`,
    );
  }
  if (checkCanonical && decode(canonical) !== decode(expectedCanonical(route))) {
    throw new Error(
      `Prerender captured ${route} with canonical ${canonical}, expected ${expectedCanonical(route)} - ` +
        `the head still belongs to another page. Refusing to ship it.`,
    );
  }
  const title = head.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim();
  if (genericTitle && route !== "/" && title === genericTitle.trim()) {
    throw new Error(
      `Prerender captured ${route} with the generic homepage title. Refusing to ship it.`,
    );
  }
}

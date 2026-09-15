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
 *  - index.html loads Google Fonts non-blocking: rel="preload" with an onload
 *    that flips it to rel="stylesheet". The flip happens during capture, so the
 *    written HTML contained a render-blocking stylesheet (~0.9s on mobile).
 */

/** Makes any URL on the capture server's origin relative to the site root. */
export function stripCaptureOrigin(html, port) {
  const origin = new RegExp(`https?://(?:localhost|127\\.0\\.0\\.1)${port ? `:${port}` : "(?::\\d+)?"}(?=/)`, "g");
  return html.replace(origin, "");
}

/** Turns the fonts stylesheet the onload handler flipped back into its non-blocking preload. */
export function restoreNonBlockingFonts(html) {
  return html.replace(/<link\b[^>]*>/g, (tag) => {
    if (!/fonts\.googleapis\.com/.test(tag) || !/\bas="style"/.test(tag) || !/\bonload=/.test(tag)) return tag;
    return tag.replace(/\brel="stylesheet"/, 'rel="preload"');
  });
}

export function cleanCapturedHtml(html, port) {
  return restoreNonBlockingFonts(stripCaptureOrigin(html, port));
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

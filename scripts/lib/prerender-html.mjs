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

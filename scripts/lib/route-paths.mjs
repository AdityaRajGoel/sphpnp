/**
 * The advertised URL and the file on disk have to be the same thing.
 *
 * Stock routes are percent-encoded (see stock-routes.mjs), and that encoding is
 * load-bearing in two places: <loc> in sitemap.xml is written without XML entity
 * escaping, so a raw `&` would produce an invalid sitemap; and the canonical tag
 * comes from react-router's location.pathname, which preserves percent-encoding.
 * So the URL stays encoded everywhere it is advertised.
 *
 * The filename is the one place that must not be. A static host decodes the
 * request path once before the filesystem lookup, so `/stock/M%26M` resolves to
 * `stock/M&M.html`. Writing the literal `M%26M.html` - as this used to - left
 * both M&M and M&MFIN hard-404ing for every crawler that followed the sitemap.
 */
export function routeToFilePath(route) {
  if (route === '/') return 'index.html';

  const segments = route.replace(/^\//, '').split('/');
  const decoded = segments.map((segment) => {
    let value;
    try {
      value = decodeURIComponent(segment);
    } catch {
      throw new Error(`Route ${route} contains invalid percent-encoding: "${segment}"`);
    }
    // A segment that decodes into a separator or a traversal would escape
    // dist/ and write somewhere nobody asked for. No legitimate symbol does
    // this, so refuse rather than sanitise into a silently wrong filename.
    if (value === '' || value === '.' || value === '..' || /[/\\]/.test(value)) {
      throw new Error(`Route ${route} decodes to an unsafe path segment: "${value}"`);
    }
    return value;
  });

  return `${decoded.join('/')}.html`;
}

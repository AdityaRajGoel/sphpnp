/**
 * URL classification for values that arrive from the database rather than from
 * this repo.
 *
 * `blog_articles.source_url` is written by whoever can write that table, and it
 * reaches two sinks in the Learning Center: react-router's `navigate()` for
 * internal paths and `window.open()` for external ones. Both sinks are unsafe
 * with an unvalidated string:
 *
 *  - `navigate()`: a `startsWith("/")` test is the exact guard React Router's
 *    open-redirect advisory describes bypassing (GHSA-wrjc-x8rr-h8h6). `/\evil`
 *    and `//evil` both pass it and are then resolved as protocol-relative, so
 *    the reader lands off-site on a page that still looks like our navigation.
 *  - `window.open()`: opens whatever scheme it is handed. `javascript:` there
 *    executes in the opened document.
 *
 * So neither sink is fed a raw string any more - both go through this, and
 * anything that is not provably one of the two safe shapes returns "none" and
 * simply does not navigate.
 */

export type ArticleTarget =
  | { kind: "internal"; path: string }
  | { kind: "external"; url: string }
  | { kind: "none" };

/** Schemes allowed to reach window.open. Deliberately an allowlist. */
const SAFE_PROTOCOLS = new Set(["http:", "https:"]);

/**
 * U+0000-U+0020 covers every C0 control plus the space. Browsers discard tabs
 * and newlines anywhere inside a URL and trim the ends, so stripping them here
 * makes this check operate on the same string the sink will: `java\tscript:`
 * is a working javascript: URL to a browser and would survive a naive scheme
 * test performed before stripping.
 */
function normalize(raw: string): string {
  // eslint-disable-next-line no-control-regex
  return raw.replace(/[\u0000-\u0020]/g, "");
}

export function classifyArticleUrl(raw: string | null | undefined): ArticleTarget {
  if (!raw) return { kind: "none" };

  const value = normalize(raw);
  if (!value) return { kind: "none" };

  if (value.startsWith("/")) {
    // A backslash has no legitimate place in one of our paths, and it is the
    // whole mechanism of the advisory - rejected wherever it appears, not just
    // in position 1. "//" is rejected for the same reason: protocol-relative.
    if (value.includes("\\") || value.startsWith("//")) return { kind: "none" };
    return { kind: "internal", path: value };
  }

  try {
    const parsed = new URL(value);
    if (!SAFE_PROTOCOLS.has(parsed.protocol)) return { kind: "none" };
    return { kind: "external", url: parsed.toString() };
  } catch {
    // Not parseable as absolute, and not one of our paths. Nothing safe to do.
    return { kind: "none" };
  }
}

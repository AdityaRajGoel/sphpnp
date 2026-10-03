/**
 * HTML entities decoded in ONE pass. Chained replaces that turned "&amp;" into
 * "&" first decoded "&amp;lt;" twice, into "<" instead of the "&lt;" the page
 * actually showed (code scanning js/double-escaping, 3 Oct 2026).
 */
const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

const fromCode = (n: number) => (Number.isInteger(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "");

export function decodeEntities(value: string): string {
  return value.replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/gi, (whole, dec?: string, hex?: string, name?: string) => {
    if (dec) return fromCode(Number(dec));
    if (hex) return fromCode(parseInt(hex, 16));
    return NAMED[(name ?? "").toLowerCase()] ?? whole;
  });
}

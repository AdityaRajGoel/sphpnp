/**
 * Illustration pipeline: turns the large source PNGs in "new asset/" into
 * responsive, content-hashed AVIF + WebP files under public/illustrations/ and
 * writes src/data/illustrations.generated.ts, the manifest <Illustration> reads.
 *
 *   node scripts/optimize-images.mjs
 *
 * The sources (2-4.6 MB each, ~70 MB total) stay out of git; the outputs are
 * committed. Filenames carry a hash of the source and crop, so they are safe to
 * cache immutably, and re-running with unchanged inputs rewrites nothing.
 *
 * Every image was reviewed at full size before it was listed here. Crops, as
 * fractions of the source, remove what should not ship:
 *  - generated card borders that would read as a frame inside our own frame
 *  - the empty half some hero compositions leave for text we set in HTML
 *  - the demat diagram's labels, which invent a third depository
 *    ("Repository") and garble the BSE mark - only the account and investor stay
 * The team scene with a generated map of India is deliberately absent: map
 * boundaries are legally sensitive in India and a generated one cannot be
 * trusted to be correct.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DIR = path.join(ROOT, "new asset");
const OUT_DIR = path.join(ROOT, "public", "illustrations");
const MANIFEST = path.join(ROOT, "src", "data", "illustrations.generated.ts");
const WIDTHS = [640, 1024, 1600];

/** slug -> source, alt text (empty = decorative) and an optional crop {x, y, w, h} in fractions. */
const ILLUSTRATIONS = {
  "advisor-consultation": {
    file: "parasram-website-hero-refined.png",
    crop: { x: 0.37, y: 0.06, w: 0.63, h: 0.94 },
    alt: "A Parasram advisor walking a client through a portfolio plan on screen",
  },
  "analyst-charts": {
    file: "parasram-website-hero.png",
    crop: { x: 0.42, y: 0.06, w: 0.545, h: 0.89 },
    alt: "An analyst reviewing market charts, dashboards and growth trends",
  },
  "horizon-figure": { file: "parasram-website-hero-2.png", alt: "" },
  "orbit-lines": { file: "parasram-website-hero-3.png", alt: "" },
  "research-lens": { file: "parasram-research-4.png", alt: "" },
  "ipo-guidance": {
    file: "parasram-ipo-refined.png",
    crop: { x: 0.065, y: 0.124, w: 0.872, h: 0.743 },
    alt: "An advisor guiding an investor from the offer document to a UPI-authorised IPO application",
  },
  "ipo-journey": {
    file: "parasram-ipo.png",
    crop: { x: 0.065, y: 0.124, w: 0.87, h: 0.74 },
    alt: "The steps of an IPO application, from reading the offer document to confirmation",
  },
  "derivatives-desk": { file: "parasram-equity-derivatives-refined.png", alt: "A senior advisor mentoring a trader through candlestick charts at a multi-screen desk" },
  "mutual-funds-planning": { file: "parasram-mutual-funds-refined.png", alt: "An advisor mapping mutual fund investments to a client's goals such as home, education and retirement" },
  "insurance-family": { file: "parasram-insurance-refined.png", alt: "An advisor explaining health, home and vehicle insurance cover to an Indian family" },
  "demat-network": {
    file: "parasram-demat-depository.png",
    // Ends above the source's white footer band (from y 0.787).
    crop: { x: 0.24, y: 0.14, w: 0.53, h: 0.64 },
    alt: "An investor managing a secure demat account holding shares and statements from a tablet",
  },
  "market-bridge": {
    file: "parasram-trust-about.png",
    crop: { x: 0.08, y: 0.09, w: 0.838, h: 0.82 },
    alt: "A path of investors and advisors leading to the stock exchange",
  },

  // Dark still-lifes for the tool-page banners. Full frame on purpose: the
  // banner art-directs them with object-position - subject to the right of the
  // copy on desktop, centred in the band above it on a phone - so the negative
  // space around the subject is part of the composition.
  "lens-bars": { file: "parasram-research-2.png", alt: "" },
  "lens-glow": { file: "parasram-research_1.png", alt: "" },
  "lens-rise": { file: "parasram-research-3.png", alt: "" },
  "steps-glow": { file: "parasram-ipo_1.png", alt: "" },
  "steps-stack": { file: "parasram-ipo-2.png", alt: "" },
  "steps-light": { file: "parasram-ipo-3.png", alt: "" },
  "steps-gold": { file: "parasram-ipo-4.png", alt: "" },
  "figure-light": { file: "parasram-website-hero_1.png", alt: "" },
  "figure-line": { file: "parasram-website-hero-4.png", alt: "" },
  "orbit-arc": { file: "parasram-trust-about_1.png", alt: "" },
  // Ends before the pale disc that intrudes on the bottom-right corner.
  "orbit-rings": { file: "parasram-trust-about-3.png", crop: { x: 0, y: 0, w: 0.78, h: 0.82 }, alt: "" },

  // Light icon art for product cards: square crops centred on the small subject.
  "art-pie": { file: "parasram-mutual-funds-2.png", crop: { x: 0.25, y: 0.166, w: 0.5, h: 0.668 }, alt: "" },
  "art-shield": { file: "parasram-insurance-3.png", crop: { x: 0.25, y: 0.166, w: 0.5, h: 0.668 }, alt: "" },
  "art-vault": { file: "parasram-demat-depository-2.png", crop: { x: 0.25, y: 0.166, w: 0.5, h: 0.668 }, alt: "" },
  "art-candles": { file: "parasram-equity-derivatives_1.png", crop: { x: 0.25, y: 0.166, w: 0.5, h: 0.668 }, alt: "" },
};

const kb = (n) => `${Math.round(n / 1024)} KB`;

fs.mkdirSync(OUT_DIR, { recursive: true });
const manifest = {};
let before = 0;
let after = 0;

for (const [slug, { file, alt, crop }] of Object.entries(ILLUSTRATIONS)) {
  const src = path.join(SOURCE_DIR, file);
  if (!fs.existsSync(src)) throw new Error(`Missing source for ${slug}: ${file}`);
  const input = fs.readFileSync(src);
  const hash = crypto.createHash("sha256").update(input).update(JSON.stringify(crop ?? null)).digest("hex").slice(0, 8);
  const meta = await sharp(input).metadata();
  const region = crop
    ? { left: Math.round(crop.x * meta.width), top: Math.round(crop.y * meta.height), width: Math.round(crop.w * meta.width), height: Math.round(crop.h * meta.height) }
    : { left: 0, top: 0, width: meta.width, height: meta.height };
  region.width = Math.min(region.width, meta.width - region.left);
  region.height = Math.min(region.height, meta.height - region.top);
  // Never upscale: a 1232px source stops at 1232.
  const widths = [...new Set(WIDTHS.map((w) => Math.min(w, region.width)))];
  before += input.length;

  for (const w of widths) {
    const base = path.join(OUT_DIR, `${slug}-${hash}-${w}`);
    const pipeline = () => sharp(input).extract(region).resize({ width: w, withoutEnlargement: true });
    if (!fs.existsSync(`${base}.avif`)) await pipeline().avif({ quality: 50, effort: 6 }).toFile(`${base}.avif`);
    if (!fs.existsSync(`${base}.webp`)) await pipeline().webp({ quality: 74, effort: 6 }).toFile(`${base}.webp`);
    after += fs.statSync(`${base}.avif`).size + fs.statSync(`${base}.webp`).size;
  }

  manifest[slug] = { hash, width: region.width, height: region.height, widths, alt };
  console.log(`${slug.padEnd(24)} ${kb(input.length).padStart(8)} -> ${region.width}x${region.height}, ${widths.join("/")}w`);
}

// Outputs from older sources, older crops, or slugs no longer listed.
const keep = new Set(Object.entries(manifest).flatMap(([slug, m]) => m.widths.flatMap((w) => [`${slug}-${m.hash}-${w}.avif`, `${slug}-${m.hash}-${w}.webp`])));
for (const name of fs.readdirSync(OUT_DIR)) if (!keep.has(name)) fs.unlinkSync(path.join(OUT_DIR, name));

fs.writeFileSync(
  MANIFEST,
  `// Generated by scripts/optimize-images.mjs - do not edit by hand.
export type IllustrationMeta = { hash: string; width: number; height: number; widths: number[]; alt: string };

export const ILLUSTRATIONS = ${JSON.stringify(manifest, null, 2)} as const satisfies Record<string, IllustrationMeta>;

export type IllustrationSlug = keyof typeof ILLUSTRATIONS;
`,
);
console.log(`\n${Object.keys(manifest).length} illustrations: ${kb(before)} of PNG -> ${kb(after)} across all AVIF + WebP sizes`);

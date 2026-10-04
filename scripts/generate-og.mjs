/**
 * The site-wide link preview: the 1200x630 image WhatsApp, LinkedIn, X and
 * Facebook show when www.sphpnp.com is shared.
 *
 *   node scripts/generate-og.mjs
 *
 * Rendered as HTML in Playwright's Chromium so it sets in IBM Plex Sans, the
 * site's own face (librsvg, used before, could only reach system Helvetica).
 * Same navy band as the site hero (--gradient-hero) and one accent, the green
 * the site uses as text on navy.
 *
 * JPEG on purpose - several link unfurlers still reject WebP and AVIF - and
 * kept well under WhatsApp's ~300 KB preview limit. The filename is versioned:
 * platforms cache previews by URL, so a new file is the only reliable way to
 * make them fetch the new artwork. Older files stay in public/ so previews
 * already cached against them keep resolving. Copy is factual (no
 * superlatives), as broker advertising should be.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public", "og-sphpnp-2026-10.jpg");
const W = 1200;
const H = 630;

const ART_SRC = path.join(ROOT, "new asset", "parasram-website-hero-refined.png");
const LOGO_SRC = path.join(ROOT, "src", "assets", "logo.png");
const FONT_SRC = path.join(ROOT, "node_modules", "@fontsource-variable", "ibm-plex-sans", "files", "ibm-plex-sans-latin-wght-normal.woff2");

const dataUri = (buf, type) => `data:${type};base64,${buf.toString("base64")}`;

// The advisor scene from the hero art, cropped off its left-hand empty space.
const art = await sharp(ART_SRC)
  .extract({ left: Math.round(0.37 * 2560), top: Math.round(0.02 * 1440), width: Math.round(0.63 * 2560), height: Math.round(0.98 * 1440) })
  .resize(1000, 808, { fit: "cover", position: "centre" })
  .png()
  .toBuffer();
// Trimmed: the source PNG carries its own white margin, which shrank the mark inside the chip.
const logo = await sharp(LOGO_SRC).flatten({ background: "#ffffff" }).trim().resize({ height: 96 }).png().toBuffer();

const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  @font-face { font-family: "Plex"; src: url(${dataUri(fs.readFileSync(FONT_SRC), "font/woff2")}) format("woff2"); font-weight: 100 700; }
  * { margin: 0; box-sizing: border-box; }
  body { width: ${W}px; height: ${H}px; overflow: hidden; font-family: "Plex", sans-serif; color: #fff;
         background: linear-gradient(180deg, hsl(213 70% 15%) 0%, hsl(210 100% 20%) 100%);
         display: grid; grid-template-columns: 1fr 500px; gap: 56px; align-items: center; padding: 0 64px; }
  .copy { display: flex; flex-direction: column; height: 502px; }
  .logo { align-self: flex-start; height: 68px; border-radius: 14px; background: #fff; padding: 10px 16px; }
  .logo img { height: 100%; width: auto; display: block; }
  .eyebrow { margin-top: 34px; font-size: 17px; font-weight: 600; letter-spacing: 0.14em; color: hsl(150 60% 55%); }
  h1 { margin-top: 14px; font-size: 58px; line-height: 1.08; font-weight: 700; letter-spacing: -0.015em; }
  .creds { margin-top: 22px; font-size: 21px; font-weight: 500; color: rgb(255 255 255 / 0.82); }
  .foot { margin-top: auto; padding-top: 20px; border-top: 1px solid rgb(255 255 255 / 0.16);
          display: flex; justify-content: space-between; align-items: baseline; font-size: 17px; }
  .url { font-weight: 600; }
  .tags { color: rgb(255 255 255 / 0.62); }
  .art { width: 500px; height: 404px; border-radius: 20px; overflow: hidden; border: 1px solid rgb(255 255 255 / 0.14);
         box-shadow: 0 28px 56px -16px rgb(0 0 0 / 0.5); }
  .art img { width: 100%; height: 100%; display: block; }
</style></head><body>
  <div class="copy">
    <div class="logo"><img src="${dataUri(logo, "image/png")}" alt=""></div>
    <div class="eyebrow">SHRI PARASRAM HOLDINGS · PANIPAT</div>
    <h1>Research, trade and invest with Parasram</h1>
    <div class="creds">SEBI-registered · NSE · BSE · MCX · Since 1970</div>
    <div class="foot"><span class="url">www.sphpnp.com</span><span class="tags">Screener · IPOs · F&amp;O · Free demat</span></div>
  </div>
  <div class="art"><img src="${dataUri(art, "image/png")}" alt=""></div>
</body></html>`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  const png = await page.screenshot({ type: "png" });
  await sharp(png).jpeg({ quality: 86, mozjpeg: true, chromaSubsampling: "4:4:4" }).toFile(OUT);
} finally {
  await browser.close();
}

console.log(`${path.relative(ROOT, OUT)}: ${Math.round(fs.statSync(OUT).size / 1024)} KB`);

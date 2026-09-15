/**
 * The site-wide link preview: the 1200x630 image WhatsApp, LinkedIn, X and
 * Facebook show when www.sphpnp.com is shared.
 *
 *   node scripts/generate-og.mjs
 *
 * JPEG on purpose - several link unfurlers still reject WebP and AVIF - and
 * kept well under WhatsApp's ~300 KB preview limit. The filename is versioned:
 * platforms cache previews by URL, so a new file is the only reliable way to
 * make them fetch the new artwork. Copy is factual (no superlatives), as broker
 * advertising should be.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public", "og-sphpnp-2026.jpg");
const W = 1200;
const H = 630;

const ART_SRC = path.join(ROOT, "new asset", "parasram-website-hero-refined.png");
const LOGO_SRC = path.join(ROOT, "src", "assets", "logo.png");

const escape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

// Background, copy and frame as one SVG layer. System sans only: this renders
// server-side through librsvg, which has no access to web fonts.
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0b2344"/>
      <stop offset="0.55" stop-color="#0d3157"/>
      <stop offset="1" stop-color="#11553f"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.82" cy="0.2" r="0.6">
      <stop offset="0" stop-color="#2fb36f" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#2fb36f" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <rect x="0" y="0" width="${W}" height="6" fill="#e0a526"/>
  <rect x="0" y="${H - 6}" width="${W}" height="6" fill="#2fb36f"/>

  <!-- outer tray of the illustration frame -->
  <rect x="628" y="118" width="520" height="420" rx="30" fill="#ffffff" fill-opacity="0.08" stroke="#ffffff" stroke-opacity="0.18"/>

  <g font-family="Helvetica Neue, Helvetica, Arial, sans-serif">
    <text x="64" y="176" font-size="20" font-weight="700" fill="#9fe3bf" letter-spacing="3">${escape("SHRI PARASRAM HOLDINGS · PANIPAT")}</text>
    <text x="64" y="252" font-size="58" font-weight="700" fill="#ffffff">${escape("Research, trade")}</text>
    <text x="64" y="322" font-size="58" font-weight="700" fill="#ffffff">${escape("& invest with")}</text>
    <text x="64" y="392" font-size="58" font-weight="700" fill="#3ccf86">Parasram</text>
    <text x="64" y="452" font-size="23" font-weight="600" fill="#f3cf7a">${escape("SEBI-registered · NSE · BSE · MCX · Since 1970")}</text>
    <text x="64" y="530" font-size="21" fill="#d6e2f0">${escape("Screener · Market Pulse · IPOs · F&O · Free demat")}</text>
    <text x="64" y="566" font-size="21" font-weight="700" fill="#ffffff">www.sphpnp.com</text>
  </g>
</svg>`;

const art = await sharp(ART_SRC)
  .extract({ left: Math.round(0.37 * 2560), top: Math.round(0.02 * 1440), width: Math.round(0.63 * 2560), height: Math.round(0.98 * 1440) })
  .resize(504, 404, { fit: "cover", position: "centre" })
  .composite([{ input: Buffer.from(`<svg width="504" height="404"><rect width="504" height="404" rx="23" fill="#fff"/></svg>`), blend: "dest-in" }])
  .png()
  .toBuffer();

// Top-left, above the eyebrow: clear of the illustration and of the brand bars at the edges.
const logoSize = 76;
const logo = await sharp(LOGO_SRC).resize(logoSize, logoSize, { fit: "contain", background: "#ffffff" }).flatten({ background: "#ffffff" }).png().toBuffer();
const logoChip = await sharp({ create: { width: logoSize + 16, height: logoSize + 16, channels: 4, background: "#ffffff" } })
  .composite([
    { input: logo, top: 8, left: 8 },
    { input: Buffer.from(`<svg width="${logoSize + 16}" height="${logoSize + 16}"><rect width="${logoSize + 16}" height="${logoSize + 16}" rx="22" fill="#fff"/></svg>`), blend: "dest-in" },
  ])
  .png()
  .toBuffer();

await sharp(Buffer.from(svg))
  .composite([
    { input: art, left: 636, top: 126 },
    { input: logoChip, left: 64, top: 44 },
  ])
  .jpeg({ quality: 86, mozjpeg: true, chromaSubsampling: "4:4:4" })
  .toFile(OUT);

console.log(`${path.relative(ROOT, OUT)}: ${Math.round(fs.statSync(OUT).size / 1024)} KB`);

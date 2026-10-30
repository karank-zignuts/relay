// Generates every Relay brand asset from one geometry. Run: node brand/build-assets.mjs
// Output: brand/<folder>/…, plus the copies the app serves (public/, src/app/).
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const brand = path.join(root, "brand");
const word = JSON.parse(fs.readFileSync(path.join(brand, "source/wordmark.json"), "utf8"));
const loaderCss = fs.readFileSync(path.join(brand, "source/loader.css"), "utf8");

const EMBER = "#ff4704";
const INK = "#000000";
const EGG = "#fdfcfc";

// Mark geometry on an 88 x 88 grid: three tiles and a diagonal leg, which together read as an R.
const tiles = (c) => `<rect class="rl-ember" x="0" y="0" width="40" height="40" rx="11" fill="${c.tl}"/>
<rect class="rl-ink-tr" x="48" y="0" width="40" height="40" rx="11" fill="${c.tr}"/>
<rect class="rl-ink-bl" x="0" y="48" width="40" height="40" rx="11" fill="${c.bl}"/>
<path class="rl-leg" d="M58 57L77 77" pathLength="100" stroke="${c.leg}" stroke-width="20" stroke-linecap="round" fill="none" stroke-dasharray="100 100"/>`;
const onLight = { tl: EMBER, tr: INK, bl: INK, leg: EMBER };
const onDark = { tl: EMBER, tr: EGG, bl: EGG, leg: EMBER };
const onEmber = { tl: EGG, tr: INK, bl: INK, leg: EGG };

const svg = (vb, body, extra = "") => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" fill="none"${extra}>${body}</svg>\n`;

// Lockup: cap height 60 on the 88 grid, baseline at 72, 26 gap.
const S = 60 / word.capHeight;
const wx = 88 + 26 - word.bbox.x1 * S;
const lockup = (c, text) => svg("0 0 318 90", `${tiles(c)}<path transform="translate(${wx.toFixed(2)} 72) scale(${S.toFixed(4)})" d="${word.d}" fill="${text}"/>`, ' role="img" aria-label="Relay"');

const mark = (c) => svg("0 0 88 88", tiles(c), ' role="img" aria-label="Relay"');

// Badge: Ember squircle with the mark inset. `square` is full bleed for iOS, which applies its own mask.
const badge = (size, { square = false, inset = 0.53 } = {}) => {
  const g = size * inset;
  const o = (size - g) / 2;
  const r = square ? 0 : size * 0.225;
  return svg(`0 0 ${size} ${size}`, `<rect width="${size}" height="${size}" rx="${r}" fill="${EMBER}"/><g transform="translate(${o} ${o}) scale(${g / 88})">${tiles(onEmber)}</g>`, ' role="img" aria-label="Relay"');
};

const outline = svg(
  "0 0 1024 1024",
  `<rect x="14" y="14" width="996" height="996" rx="228" stroke="${INK}" stroke-width="28"/><g transform="translate(252 252) scale(${520 / 88})">${tiles(onLight)}</g>`,
  ' role="img" aria-label="Relay"',
);

// Browser tabs can be dark, so the Ink tiles flip to Eggshell there.
const faviconSvg = svg(
  "-6 -6 100 100",
  `<style>.ink{fill:${INK}}@media (prefers-color-scheme:dark){.ink{fill:${EGG}}}</style>
<rect x="0" y="0" width="40" height="40" rx="11" fill="${EMBER}"/><rect class="ink" x="48" y="0" width="40" height="40" rx="11"/><rect class="ink" x="0" y="48" width="40" height="40" rx="11"/><path d="M58 57L77 77" stroke="${EMBER}" stroke-width="20" stroke-linecap="round"/>`,
  ' role="img" aria-label="Relay"',
);

const loaderSvg = svg("-6 -6 100 100", `<style>${loaderCss}</style><g class="rl-anim">${tiles(onLight)}</g>`, ' role="img" aria-label="Relay loading"');

const write = (rel, data) => {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
  return file;
};
const png = async (svgText, size, rel, fit = {}) => {
  const buf = await sharp(Buffer.from(svgText), { density: 384 }).resize({ ...(typeof size === "number" ? { width: size, height: size } : size), fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 }, ...fit }).png().toBuffer();
  write(rel, buf);
  return buf;
};

// SVG sources
write("brand/logo/relay-logo.svg", lockup(onLight, INK));
write("brand/logo/relay-logo-on-dark.svg", lockup(onDark, EGG));
write("brand/mark/relay-mark.svg", mark(onLight));
write("brand/mark/relay-mark-on-dark.svg", mark(onDark));
write("brand/app-icon/relay-app-icon.svg", badge(1024));
write("brand/app-icon/relay-app-icon-square.svg", badge(1024, { square: true }));
write("brand/icon-outline/relay-icon-outline.svg", outline);
write("brand/favicon/favicon.svg", faviconSvg);
write("brand/animation/relay-loader.svg", loaderSvg);

// PNGs, all transparent
await png(lockup(onLight, INK), { width: 1800, height: 720 }, "brand/logo/relay-logo-2000x800.png");
await png(lockup(onDark, EGG), { width: 1800, height: 720 }, "brand/logo/relay-logo-on-dark-2000x800.png");
for (const f of ["relay-logo-2000x800.png", "relay-logo-on-dark-2000x800.png"]) {
  // Pad to the exact 2000 x 800 canvas.
  const p = path.join(brand, "logo", f);
  const b = await sharp(p).extend({ top: 40, bottom: 40, left: 100, right: 100, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  fs.writeFileSync(p, b);
}
await png(mark(onLight), 512, "brand/mark/relay-mark-512.png");
await png(mark(onDark), 512, "brand/mark/relay-mark-on-dark-512.png");
await png(badge(1024), 1024, "brand/app-icon/relay-app-icon-1024.png");
await png(badge(1024, { square: true }), 1024, "brand/app-icon/relay-app-icon-square-1024.png");
await png(outline, 1024, "brand/icon-outline/relay-icon-outline-1024.png");
await png(faviconSvg, 512, "brand/favicon/favicon-512.png");

// Favicon fallbacks use the badge so they stay legible on any tab colour.
const badgeSmall = badge(512, { inset: 0.62 });
const sizes = { "favicon-16.png": 16, "favicon-32.png": 32, "favicon-48.png": 48, "favicon-192.png": 192 };
const small = {};
for (const [name, s] of Object.entries(sizes)) small[s] = await png(badgeSmall, s, `brand/favicon/${name}`);
const apple = await png(badge(512, { square: true, inset: 0.6 }), 180, "brand/favicon/apple-touch-icon.png");
const maskable = await png(badge(512, { square: true, inset: 0.46 }), 512, "brand/favicon/maskable-512.png");
const icon512 = await png(badge(1024), 512, "brand/favicon/icon-512.png");

// favicon.ico with embedded PNGs (16, 32, 48)
const icoSizes = [16, 32, 48];
const head = Buffer.alloc(6);
head.writeUInt16LE(1, 2);
head.writeUInt16LE(icoSizes.length, 4);
let offset = 6 + 16 * icoSizes.length;
const entries = icoSizes.map((s) => {
  const e = Buffer.alloc(16);
  e.writeUInt8(s, 0);
  e.writeUInt8(s, 1);
  e.writeUInt16LE(1, 4);
  e.writeUInt16LE(32, 6);
  e.writeUInt32LE(small[s].length, 8);
  e.writeUInt32LE(offset, 12);
  offset += small[s].length;
  return e;
});
const ico = Buffer.concat([head, ...entries, ...icoSizes.map((s) => small[s])]);
write("brand/favicon/favicon.ico", ico);

// Loader frames, captured from the real animation so they match it exactly.
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 512, height: 512 } });
await page.setContent(`<style>html,body{margin:0;background:transparent}svg{width:512px;height:512px;display:block}</style>${loaderSvg}`);
const frames = [["01-start", 0.14], ["02-build", 0.4], ["03-form", 0.68], ["04-final", 0.84]];
for (const [name, t] of frames) {
  await page.evaluate((ms) => document.getAnimations().forEach((a) => { a.pause(); a.currentTime = ms; }), t * 3200);
  await page.screenshot({ path: path.join(brand, `animation/frames/${name}.png`), omitBackground: true });
}
await browser.close();

// Copies the app serves
write("src/app/icon.svg", faviconSvg);
write("src/app/favicon.ico", ico);
write("src/app/apple-icon.png", apple);
write("public/icons/icon-192.png", small[192]);
write("public/icons/icon-512.png", icon512);
write("public/icons/maskable-512.png", maskable);
write("public/brand/relay-logo.svg", lockup(onLight, INK));
// Tight crop at 2x for emails (shown at 120 x 34).
write("public/brand/relay-logo.png", await sharp(Buffer.from(lockup(onLight, INK)), { density: 384 }).resize({ width: 636 }).png().toBuffer());

// Wordmark path for the React components
write(
  "src/components/brand/wordmark.ts",
  `// Generated by brand/build-assets.mjs. Do not edit by hand.\nexport const WORDMARK_PATH = "${word.d}";\nexport const WORDMARK_TRANSFORM = "translate(${wx.toFixed(2)} 72) scale(${S.toFixed(4)})";\n`,
);
console.log("brand assets built");

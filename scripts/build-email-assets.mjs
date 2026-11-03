// Renders the images used by the auth emails into public/brand/email/ (hero illustrations, light logo, small icons).
// Run: npm run emails:build (it runs this first). Emails load them from {{ .SiteURL }}/brand/email/…, so the app must be deployed for them to show.
import { mkdirSync, readFileSync } from "node:fs";
import sharp from "sharp";

const OUT = "public/brand/email";
mkdirSync(OUT, { recursive: true });

const INK = "#000000";
const GRAPHITE = "#44403b";
const SMOKE = "#777169";
const EMBER = "#ff4704";
const EGGSHELL = "#fdfcfc";
const NIGHT = "#171615";

/** Lucide icon nodes, read from the installed package so the emails use the same icon set as the app. */
function iconNodes(name) {
  const src = readFileSync(`node_modules/lucide-react/dist/esm/icons/${name}.mjs`, "utf8");
  const start = src.indexOf("[", src.indexOf("node:"));
  let depth = 0;
  let end = start;
  for (; end < src.length; end++) {
    if (src[end] === "[") depth++;
    if (src[end] === "]" && --depth === 0) break;
  }
  if (start < 0) throw new Error(`Cannot read icon ${name}`);
  return new Function(`return ${src.slice(start, end + 1)}`)();
}

const icon = (name, { x = 0, y = 0, size = 24, stroke = GRAPHITE, width = 2 } = {}) =>
  `<g transform="translate(${x} ${y}) scale(${size / 24})" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round">${iconNodes(name)
    .map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).filter(([key]) => key !== "key").map(([key, value]) => `${key}="${value}"`).join(" ")}/>`)
    .join("")}</g>`;

const save = (svg, file, width) => sharp(Buffer.from(svg)).resize({ width }).png().toFile(`${OUT}/${file}`);

// ---------- Hero: a dark band, a soft Ember glow, a glossy tile carrying one icon, and a curved edge into the card ----------
const W = 560;
const H = 250;

const heroFrame = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * 2}" height="${H * 2}">
<defs>
  <radialGradient id="glow" cx="50%" cy="58%" r="50%"><stop offset="0" stop-color="${EMBER}" stop-opacity="0.38"/><stop offset="1" stop-color="${EMBER}" stop-opacity="0"/></radialGradient>
  <linearGradient id="tile" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e4dfd9"/></linearGradient>
  <linearGradient id="rim" x1="0" y1="0" x2="1" y2="1"><stop offset="0.45" stop-color="${EMBER}" stop-opacity="0"/><stop offset="1" stop-color="${EMBER}"/></linearGradient>
  <filter id="lift" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="16" stdDeviation="14" flood-color="#000" flood-opacity="0.55"/></filter>
</defs>
<rect width="${W}" height="${H}" fill="${NIGHT}"/>
<ellipse cx="${W / 2}" cy="${H * 0.62}" rx="230" ry="120" fill="url(#glow)"/>
${inner}
<path d="M0 ${H} L0 ${H - 46} Q${W / 2} ${H + 24} ${W} ${H - 46} L${W} ${H} Z" fill="${EGGSHELL}"/>
</svg>`;

/** The glossy tile with one icon, a darker plate behind it, and an optional round badge on its corner. */
const tileHero = (name, badge) =>
  heroFrame(`
<g transform="rotate(-9 246 124)"><rect x="180" y="62" width="132" height="132" rx="32" fill="#2c2926" opacity="0.95"/></g>
<g transform="rotate(6 280 106)" filter="url(#lift)">
  <rect x="214" y="40" width="132" height="132" rx="32" fill="url(#tile)"/>
  <rect x="215.5" y="41.5" width="129" height="129" rx="30.5" fill="none" stroke="url(#rim)" stroke-width="3"/>
  ${icon(name, { x: 237, y: 63, size: 86, width: 1.7 })}
</g>
${badge ? `<g><circle cx="352" cy="52" r="21" fill="${EMBER}"/>${icon(badge, { x: 340, y: 40, size: 24, stroke: "#fff", width: 2.6 })}</g>` : ""}`);

/** Invite hero: a slanted board with a highlighted request, and a Slack-style tile feeding into it. */
const boardHero = () =>
  heroFrame(`
<g transform="rotate(-5 290 118)" filter="url(#lift)">
  <rect x="160" y="30" width="290" height="176" rx="20" fill="#f1eeea"/>
  <rect x="172" y="42" width="58" height="152" rx="13" fill="#e6e1db"/>
  <circle cx="186" cy="58" r="5" fill="${INK}"/><rect x="196" y="55" width="26" height="6" rx="3" fill="#bdb6ae"/>
  <circle cx="186" cy="82" r="4" fill="#cfc9c1"/><rect x="196" y="79" width="22" height="6" rx="3" fill="#d6d0c9"/>
  <circle cx="186" cy="104" r="4" fill="#cfc9c1"/><rect x="196" y="101" width="26" height="6" rx="3" fill="#d6d0c9"/>
  <circle cx="186" cy="126" r="4" fill="#cfc9c1"/><rect x="196" y="123" width="20" height="6" rx="3" fill="#d6d0c9"/>
  <rect x="244" y="46" width="84" height="9" rx="4.5" fill="${GRAPHITE}" opacity="0.85"/>
  <rect x="366" y="40" width="72" height="22" rx="11" fill="#ffd8cb"/><circle cx="378" cy="51" r="4" fill="${EMBER}"/><rect x="388" y="48" width="40" height="6" rx="3" fill="${EMBER}"/>
  <rect x="244" y="74" width="194" height="120" rx="14" fill="${EGGSHELL}"/>
  <rect x="256" y="88" width="14" height="14" rx="4" fill="none" stroke="#bdb6ae" stroke-width="2"/><rect x="280" y="90" width="92" height="6" rx="3" fill="#cfc9c1"/><rect x="396" y="90" width="30" height="6" rx="3" fill="#e2ddd7"/>
  <rect x="250" y="112" width="182" height="34" rx="9" fill="#f3f0ec"/>
  <circle cx="263" cy="129" r="6" fill="${EMBER}"/><rect x="280" y="124" width="104" height="6" rx="3" fill="#a59f97"/><rect x="280" y="134" width="60" height="5" rx="2.5" fill="#d6d0c9"/><rect x="396" y="126" width="30" height="6" rx="3" fill="#cfc9c1"/>
  <rect x="256" y="162" width="14" height="14" rx="4" fill="none" stroke="#bdb6ae" stroke-width="2"/><rect x="280" y="165" width="82" height="6" rx="3" fill="#cfc9c1"/><rect x="396" y="165" width="30" height="6" rx="3" fill="#e2ddd7"/>
</g>
<g filter="url(#lift)"><rect x="96" y="70" width="56" height="56" rx="16" fill="url(#tile)"/>${icon("hash", { x: 110, y: 84, size: 28, width: 2 })}</g>
<path d="M124 134 C126 172 150 184 188 180" fill="none" stroke="#8d867e" stroke-width="2" stroke-dasharray="4 5" stroke-linecap="round"/>
<path d="M180 173 L190 180 L180 187" fill="none" stroke="#8d867e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`);

const heroes = {
  invite: boardHero(),
  recovery: tileHero("lock"),
  confirmation: tileHero("mail", "check"),
  magic_link: tileHero("link"),
  email_change: tileHero("mail", "arrow-right"),
  reauthentication: tileHero("shield-check"),
};
for (const [key, svg] of Object.entries(heroes)) await save(svg, `hero-${key}.png`, W * 2);

// ---------- Logo for the dark band: the same mark and wordmark with a light wordmark ----------
const logo = readFileSync("public/brand/relay-logo.svg", "utf8").replace(/#000000/g, EGGSHELL);
await save(logo, "logo-light.png", 636);

// ---------- Small icons ----------
const small = (name, stroke, file, size = 96) =>
  save(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}">${icon(name, { stroke, width: 1.8 })}</svg>`, file, size);
await small("hash", GRAPHITE, "ico-hash.png");
await small("layers", GRAPHITE, "ico-layers.png");
await small("bell-ring", GRAPHITE, "ico-bell.png");
await small("info", SMOKE, "ico-info.png", 64);

// The mark alone, for the footer.
const mark = readFileSync("public/brand/relay-logo.svg", "utf8").replace(/viewBox="0 0 318 90"/, 'viewBox="0 0 88 88"');
await save(mark, "mark.png", 88);

console.log(`Wrote email images to ${OUT}/`);

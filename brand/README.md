# Relay brand assets

The mark is three rounded tiles and a diagonal leg that together read as an R. Ember `#ff4704` is the accent, Ink `#000000` the second color. Rules: `docs/ai-context/DESIGN_SYSTEM.md` §5.13.

Everything here is generated. Change the geometry in `build-assets.mjs`, then run:

```bash
node brand/build-assets.mjs
```

| Folder | Contents |
|---|---|
| `logo/` | Full lockup. `relay-logo.svg` and a 2000 x 800 transparent PNG, plus `-on-dark` versions for dark backgrounds |
| `mark/` | The mark alone, SVG and 512 PNG, light and on-dark |
| `app-icon/` | Ember squircle badge, 1024 PNG with transparent corners. `-square` is full bleed for iOS |
| `icon-outline/` | Outlined badge, 1024 PNG, transparent inside |
| `favicon/` | `favicon.svg` (adapts to dark tabs), `.ico`, 16/32/48/192/512 PNG, apple-touch, maskable |
| `animation/` | `relay-loader.svg` (animated, loops, transparent) and the four sheet frames as transparent PNGs |
| `source/` | Wordmark outlines, loader CSS, and the original concept sheet |
| `explorations/` | Earlier concept rounds, kept for reference. Not used by the app |

The build also writes the copies the app serves: `src/app/icon.svg`, `favicon.ico`, `apple-icon.png`, `public/icons/*`, `public/brand/relay-logo.*` (used by the auth emails) and `src/components/brand/wordmark.ts`. Do not edit those by hand.

If the geometry changes, update `src/components/brand/relay-brand.tsx` and `brand/source/loader.css` (and its copy in `src/app/globals.css`) to match.
